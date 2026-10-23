import { useNavigate } from 'react-router';
import { ButtonLink } from '../../components/ui/button';

type RouterButtonLinkProps = Omit<Parameters<typeof ButtonLink>[0], 'href' | 'onClick'> & {
  to: string;
};

/** ButtonLink que navega pelo router (sem recarregar a página), mantendo o `<a href>` real. */
export function RouterButtonLink({ to, ...props }: RouterButtonLinkProps) {
  const navigate = useNavigate();
  return (
    <ButtonLink
      {...props}
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        void navigate(to);
      }}
    />
  );
}
