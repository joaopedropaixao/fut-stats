import { PixelText } from '../../components/ui/pixel-text';

/** Avatar sem time (a lista de presença ainda não tem times): as 2 primeiras letras do apelido; "G" no goleiro contratado. */
export function MemberAvatar({ nickname, goalkeeper }: { nickname: string; goalkeeper?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" role="img" aria-label={nickname}>
      <span
        aria-hidden
        className="inline-flex size-10 items-center justify-center rounded-full bg-surface-3 pl-0.5 text-text shadow-[inset_0_0_0_2px_var(--color-border-strong)]"
      >
        <PixelText className="leading-none">
          {[...nickname.trim()].slice(0, 2).join('').toUpperCase()}
        </PixelText>
      </span>
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
