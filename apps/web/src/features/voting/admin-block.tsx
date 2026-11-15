import type { VotingPlayer } from '@fut-stats/shared';
import { useState } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';

type AdminBlockProps = {
  /** Quem ainda não votou (só o admin recebe). */
  pending: readonly VotingPlayer[] | null;
  /** Pode encerrar (admin e votação aberta). */
  canClose: boolean;
  onClose: () => void;
  closing: boolean;
};

/**
 * O que só o admin vê (folha: Gaveta/Encerrar votação): quem ainda não votou, com rosto e apelido, para cobrar
 * no grupo (o voto em si nunca aparece), e a tecla de contorno "Encerrar votação", que pede confirmação.
 */
export function AdminBlock({ pending, canClose, onClose, closing }: AdminBlockProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Para o admin" className="animate-row-in flex flex-col gap-4">
      {pending && pending.length > 0 && (
        <div className="flex flex-col gap-3 bg-surface p-4 shadow-card">
          <PixelText as="h2">{`Faltam votar · ${pending.length}`}</PixelText>
          <ul className="flex flex-wrap gap-x-4 gap-y-3">
            {pending.map((player) => (
              <li key={player.membershipId} className="flex min-h-10 items-center gap-2.5">
                <Avatar
                  nickname={player.nickname}
                  avatar={player.avatar}
                  team={player.team === 'WHITE' ? 'white' : 'black'}
                  size={32}
                  gap="surface"
                  className="m-1"
                />
                <PixelText>{player.nickname}</PixelText>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canClose && (
        <Button
          variant="outline"
          size={52}
          icon="lock"
          label="Encerrar votação"
          block
          loading={closing}
          onClick={() => setConfirming(true)}
        />
      )}
      {confirming && (
        <Sheet
          title="Encerrar votação?"
          onClose={() => setConfirming(false)}
          actions={(close) => (
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={close}
              />
              <Button
                size={52}
                label="Encerrar"
                className="flex-1"
                // Fecha na hora e deixa a chamada seguir (o erro, se vier, aparece no aviso)
                onClick={() => {
                  onClose();
                  close();
                }}
              />
            </>
          )}
        >
          <p>Os votos enviados até agora valem, e ninguém mais poderá votar nesta rodada.</p>
        </Sheet>
      )}
    </section>
  );
}
