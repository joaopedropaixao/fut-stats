import { inviteSchema } from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState } from '../../components/ui/states';
import { apiGet, apiPost } from '../../lib/api';
import { cn } from '../../lib/cn';
import { inviteUrl, whatsappShareUrl } from './invite-code';

/** Aviso curto embaixo do link, depois de copiar ou gerar outro. */
type Notice = 'copied' | 'copy-failed' | 'regenerated';

const NOTICE_TEXT: Record<Notice, string> = {
  copied: 'Link copiado',
  'copy-failed': 'Não deu para copiar. Toque e segure o link para copiar.',
  regenerated: 'Link novo pronto. O antigo parou de funcionar.',
};

/** Link de convite do admin: copiar, mandar no WhatsApp e gerar um novo (com confirmação). */
export function InviteCard({ groupId, groupName }: { groupId: string; groupName: string }) {
  const queryClient = useQueryClient();
  const key = ['group', groupId, 'invite'] as const;
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number>(undefined);
  const invite = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiGet(`/groups/${groupId}/invite`, inviteSchema, { signal }),
  });
  const regenerate = useMutation({
    mutationFn: () => apiPost(`/groups/${groupId}/invite`, inviteSchema),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      setConfirming(false);
      showNotice('regenerated');
    },
  });

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  function showNotice(next: Notice) {
    setNotice(next);
    window.clearTimeout(noticeTimer.current);
    // O erro de cópia fica até a pessoa fazer outra coisa; os avisos de sucesso somem sozinhos
    if (next !== 'copy-failed')
      noticeTimer.current = window.setTimeout(() => setNotice(null), 3000);
  }

  return (
    <section aria-labelledby="convite-titulo" className="flex flex-col gap-3">
      <h2 id="convite-titulo" className="text-text-muted">
        <PixelText>Convite da pelada</PixelText>
      </h2>
      {invite.isPending && (
        <div
          role="status"
          aria-label="Carregando convite"
          className="flex flex-col gap-4 bg-surface p-4 shadow-card"
        >
          <div className="h-5 w-4/5 bg-surface-3 shadow-card" />
          <div className="h-11 bg-surface-3 shadow-card" />
          <div className="h-14 bg-surface-3 shadow-card" />
        </div>
      )}
      {invite.isError && (
        <ErrorState
          title="Não deu para abrir o convite"
          message="Tente de novo em instantes."
          onRetry={() => void invite.refetch()}
          retrying={invite.isFetching}
        />
      )}
      {invite.data && (
        <InviteLink
          link={inviteUrl(window.location.origin, invite.data.code)}
          groupName={groupName}
          notice={notice}
          onCopied={showNotice}
          confirming={confirming}
          onConfirmingChange={(value) => {
            setConfirming(value);
            regenerate.reset();
          }}
          regenerating={regenerate.isPending}
          regenerateFailed={regenerate.isError}
          onRegenerate={() => regenerate.mutate()}
        />
      )}
    </section>
  );
}

type InviteLinkProps = {
  link: string;
  groupName: string;
  notice: Notice | null;
  onCopied: (notice: Notice) => void;
  confirming: boolean;
  onConfirmingChange: (confirming: boolean) => void;
  regenerating: boolean;
  regenerateFailed: boolean;
  onRegenerate: () => void;
};

function InviteLink({
  link,
  groupName,
  notice,
  onCopied,
  confirming,
  onConfirmingChange,
  regenerating,
  regenerateFailed,
  onRegenerate,
}: InviteLinkProps) {
  const askRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // O botão some ao abrir a confirmação (e volta ao fechar): o foco acompanha, para não cair no <body>
  useEffect(() => {
    if (confirming) backRef.current?.focus();
    else if (opened.current) askRef.current?.focus();
    opened.current = confirming;
  }, [confirming]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      onCopied('copied');
    } catch {
      onCopied('copy-failed');
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-surface p-4 shadow-card">
      <p className="text-sm text-text-muted">
        Quem abrir este link entra na pelada como jogador. Mande no grupo da galera.
      </p>
      <div className="flex flex-col">
        <div className="flex gap-3">
          <p className="flex min-h-11 min-w-0 flex-1 items-center bg-track px-3 py-2 text-sm break-all shadow-card select-all">
            {link}
          </p>
          <IconButton
            icon={notice === 'copied' ? 'check' : 'copy'}
            label={notice === 'copied' ? 'Link copiado' : 'Copiar link'}
            onClick={() => void copy()}
          />
        </div>
        {/* Vazio não ocupa espaço, mas continua na página para o leitor de tela anunciar o aviso */}
        <p
          role="status"
          className={cn(
            'mt-2 text-caption empty:mt-0',
            notice === 'copy-failed' && 'text-[#fca5a5]',
          )}
        >
          {notice && notice !== 'copy-failed' && (
            <Icon
              name="check"
              size={14}
              strokeWidth={2.6}
              className="mr-1.5 inline-block align-[-2px] text-success"
            />
          )}
          {notice && NOTICE_TEXT[notice]}
        </p>
      </div>
      <Button
        label="Mandar no WhatsApp"
        icon="share"
        block
        onClick={() => window.open(whatsappShareUrl(groupName, link), '_blank', 'noopener')}
      />
      {confirming ? (
        <div className="flex flex-col gap-3 bg-warning/8 p-4 shadow-[inset_0_0_0_2px_var(--color-warning)]">
          <div className="flex gap-3">
            <Icon name="alert" size={22} strokeWidth={2.2} className="shrink-0 text-warning" />
            <div className="flex flex-col gap-1">
              <PixelText as="p" wrap>
                Gerar novo link?
              </PixelText>
              <p className="text-sm text-text-muted">
                O link atual para de funcionar na hora. Quem ainda não entrou vai precisar do novo.
              </p>
            </div>
          </div>
          {regenerateFailed && (
            <p role="alert" className="text-sm text-[#fca5a5]">
              Não deu para gerar agora. Tente de novo.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              ref={backRef}
              variant="outline"
              size={48}
              label="Voltar"
              onClick={() => onConfirmingChange(false)}
            />
            <Button
              variant="danger"
              size={48}
              icon="redo"
              label="Gerar"
              loading={regenerating}
              onClick={onRegenerate}
            />
          </div>
        </div>
      ) : (
        <Button
          ref={askRef}
          variant="outline"
          size={48}
          icon="redo"
          label="Gerar novo link"
          block
          onClick={() => onConfirmingChange(true)}
        />
      )}
    </div>
  );
}
