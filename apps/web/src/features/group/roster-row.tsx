import { POSITION_LABELS, type RosterMember } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { RowMenu, MenuItem } from '../../components/ui/row-menu';
import { formatRating } from '../../lib/rating-format';
import { MemberAvatar } from '../rounds/member-avatar';
import { YouTag } from '../lineup/you-tag';

type RosterRowProps = {
  member: RosterMember;
  /** É a linha de quem está vendo: etiqueta "VOCÊ" e menu só com "Editar jogador". */
  mine: boolean;
  onEdit: () => void;
  onToggleAdmin: () => void;
  onRemove: () => void;
  onReactivate: () => void;
};

/**
 * Uma linha do Elenco (72 px no mínimo): o bonequinho, o apelido, a posição e o selo do papel, a nota em
 * dígitos pixel e o menu ⋯ de 44 x 44. Sem o ⋯ de remover ou tirar admin na própria linha.
 */
export function RosterRow({
  member,
  mine,
  onEdit,
  onToggleAdmin,
  onRemove,
  onReactivate,
}: RosterRowProps) {
  const admin = member.role === 'ADMIN';
  return (
    <li className="relative flex h-18 items-center gap-2 py-1 pr-2 pl-2.5 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none">
      <MemberAvatar
        nickname={member.nickname}
        avatar={member.avatar}
        goalkeeper={member.isHiredGoalkeeper}
      />
      {/* Três linhas fixas (apelido, posição, selo): a linha tem sempre 72 px, em qualquer largura */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate">
          <PixelText>{member.nickname}</PixelText>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="min-w-0 truncate">
            <PixelText className="text-text-muted">
              {POSITION_LABELS[member.primaryPosition]}
            </PixelText>
          </div>
          {mine && <YouTag />}
        </div>
        <div className="flex items-center overflow-hidden">
          <Badge
            label={admin ? 'Admin' : 'Jogador'}
            variant={admin ? 'admin' : 'neutral'}
            className="h-6 shrink-0 px-2"
          />
        </div>
      </div>
      <PixelDigits
        value={formatRating(member.initialRating)}
        scale={2}
        label={`Nota inicial ${formatRating(member.initialRating)}`}
        className="text-text"
      />
      <RowMenu label={`Mais opções de ${member.nickname}`}>
        {(close) => (
          <>
            <MenuItem
              icon="pencil"
              label="Editar jogador"
              onClick={() => {
                close();
                onEdit();
              }}
            />
            {!mine && member.active && (
              <MenuItem
                icon="profile"
                label={admin ? 'Tirar admin' : 'Tornar admin'}
                onClick={() => {
                  close();
                  onToggleAdmin();
                }}
              />
            )}
            {!mine && member.active && (
              <MenuItem
                icon="trash"
                label="Remover jogador"
                className="text-[#fca5a5]"
                onClick={() => {
                  close();
                  onRemove();
                }}
              />
            )}
            {!mine && !member.active && (
              <MenuItem
                icon="redo"
                label="Reativar"
                onClick={() => {
                  close();
                  onReactivate();
                }}
              />
            )}
          </>
        )}
      </RowMenu>
    </li>
  );
}
