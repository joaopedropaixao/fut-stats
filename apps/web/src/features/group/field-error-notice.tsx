import { Icon } from '../../components/ui/icons';

/** O aviso curto logo acima do botão: texto (não toast), fica até o erro ser corrigido. */
export function FieldErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 bg-surface p-3 text-sm text-[#fca5a5] shadow-[inset_0_0_0_2px_var(--color-danger)]"
    >
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
