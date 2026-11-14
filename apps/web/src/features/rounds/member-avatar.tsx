import type { PlayerAvatar } from '@fut-stats/shared';
import { FaceDisc, type AvatarSize } from '../../components/ui/avatar';
import { PixelText } from '../../components/ui/pixel-text';

/** Avatar sem time (a lista de presença ainda não tem times): o rosto com a camisa neutra; "G" no goleiro contratado. */
export function MemberAvatar({
  nickname,
  avatar,
  goalkeeper,
  size = 40,
}: {
  nickname: string;
  avatar: PlayerAvatar;
  goalkeeper?: boolean;
  size?: AvatarSize;
}) {
  return (
    <span className="relative inline-flex shrink-0" role="img" aria-label={nickname}>
      <FaceDisc avatar={avatar} team={null} size={size} />
      {goalkeeper && (
        <span
          aria-hidden
          className="absolute -right-2 -bottom-2 inline-flex size-5 items-center justify-center rounded-full bg-text pl-px text-team-black shadow-[0_0_0_2px_var(--color-surface)]"
        >
          <PixelText className="leading-none">G</PixelText>
        </span>
      )}
    </span>
  );
}
