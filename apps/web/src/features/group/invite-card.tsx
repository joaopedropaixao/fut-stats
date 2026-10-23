import { inviteSchema } from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { Surface } from '../../components/ui/surface';
import { PixelText } from '../../components/ui/pixel-text';
import { apiGet, apiPost } from '../../lib/api';
import { inviteUrl, whatsappShareUrl } from './invite-code';

/** Link de convite do admin: copiar, mandar no WhatsApp e gerar um novo (com confirmação). */
export function InviteCard({ groupId, groupName }: { groupId: string; groupName: string }) {
  const queryClient = useQueryClient();
  const key = ['group', groupId, 'invite'] as const;
  const invite = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiGet(`/groups/${groupId}/invite`, inviteSchema, { signal }),
  });
  const regenerate = useMutation({
    mutationFn: () => apiPost(`/groups/${groupId}/invite`, inviteSchema),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      setConfirming(false);
    },
  });
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  if (invite.isPending) return <SkeletonList rows={1} label="Carregando convite" />;
  if (invite.isError) {
    return (
      <ErrorState
        title="Não deu para abrir o convite"
        message="Tente de novo em instantes."
        onRetry={() => void invite.refetch()}
        retrying={invite.isFetching}
      />
    );
  }

  const link = inviteUrl(window.location.origin, invite.data.code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o link aparece na tela para copiar na mão.
    }
  }

  return (
    <Surface level={2} className="flex flex-col gap-4 p-4">
      <PixelText size={16}>Link de convite</PixelText>
      <p className="text-sm break-all text-text-muted select-all">{link}</p>
      <Button
        label="Compartilhar no WhatsApp"
        block
        className="px-2"
        onClick={() => window.open(whatsappShareUrl(groupName, link), '_blank', 'noopener')}
      />
      <Button
        variant="secondary"
        label={copied ? 'Copiado' : 'Copiar'}
        icon={copied ? 'check' : undefined}
        block
        onClick={() => void copy()}
      />
      <p role="status" className="sr-only">
        {copied ? 'Link copiado' : ''}
      </p>
      {confirming ? (
        <Surface level={3} className="flex flex-col gap-3 p-4">
          <PixelText as="p" size={16} wrap>
            Gerar novo link?
          </PixelText>
          <p className="text-sm text-text-muted">O link antigo deixa de funcionar na hora.</p>
          {regenerate.isError && (
            <p role="alert" className="text-sm text-[#fca5a5]">
              Não deu para gerar agora. Tente de novo.
            </p>
          )}
          <Button
            variant="danger"
            icon="redo"
            label="Gerar novo link"
            block
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          />
          <Button variant="outline" label="Cancelar" block onClick={() => setConfirming(false)} />
        </Surface>
      ) : (
        <Button
          variant="outline"
          icon="redo"
          label="Gerar novo link"
          block
          onClick={() => setConfirming(true)}
        />
      )}
    </Surface>
  );
}
