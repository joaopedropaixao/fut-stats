import { createGroupSchema } from '@fut-stats/shared';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { TextField } from '../../components/ui/text-field';
import { extractInviteCode } from '../../features/group/invite-code';
import { usePlayerFields } from '../../features/group/player-fields';
import { enterGroupErrorMessage, useCreateGroup } from '../../features/group/use-enter-group';
import { cn } from '../../lib/cn';

type Path = 'create' | 'invite';

const PATHS: { value: Path; label: string }[] = [
  { value: 'create', label: 'Criar pelada' },
  { value: 'invite', label: 'Usar convite' },
];

/** Logado e sem grupo: criar a pelada ou entrar por um convite. */
export function StartPage() {
  const [path, setPath] = useState<Path>('create');

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pt-6 pb-10">
      <title>Começar · Fut Stats</title>
      <header className="flex flex-col gap-2">
        <PixelText as="h1" size={24} wrap className="outline-none">
          Bora começar
        </PixelText>
        <p className="text-base text-text-muted">
          Crie a sua pelada ou entre numa que já existe com o link de convite.
        </p>
      </header>
      <PathSwitch value={path} onChange={setPath} />
      {/* As duas ficam montadas: trocar de aba não apaga o que a pessoa já digitou */}
      <div hidden={path !== 'create'}>
        <CreateGroupForm />
      </div>
      <div hidden={path !== 'invite'}>
        <PasteInvite />
      </div>
    </div>
  );
}

/** As duas portas de entrada, como as abas Branco | Preto da folha. Rádio nativo: setas trocam. */
function PathSwitch({ value, onChange }: { value: Path; onChange: (path: Path) => void }) {
  const name = useId();
  return (
    <fieldset className="grid grid-cols-2 bg-surface p-1 shadow-card">
      <legend className="sr-only">O que você quer fazer</legend>
      {PATHS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex h-12 cursor-pointer items-center justify-center px-2',
              'transition-colors duration-(--duration-fast) ease-out',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-text',
              selected ? 'bg-text text-bg' : 'text-text-muted',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <PixelText>{option.label}</PixelText>
          </label>
        );
      })}
    </fieldset>
  );
}

function CreateGroupForm() {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const { fields, validate } = usePlayerFields();
  const create = useCreateGroup();

  function submit(event: FormEvent) {
    event.preventDefault();
    const player = validate();
    const nameResult = createGroupSchema.shape.name.safeParse(name);
    setNameError(nameResult.success ? undefined : nameResult.error.issues[0]?.message);
    if (!player || !nameResult.success) return;
    create.mutate({ name: nameResult.data, ...player });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-label="Criar a pelada">
      <TextField
        label="Nome da pelada"
        hint="Você vira o admin e também joga."
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(undefined);
        }}
        error={nameError}
        autoComplete="off"
        autoCapitalize="words"
        placeholder="Ex.: Pelada do Zé"
      />
      {fields}
      {create.isError && (
        <p role="alert" className="text-sm text-[#fca5a5]">
          {enterGroupErrorMessage(create.error)}
        </p>
      )}
      <Button type="submit" label="Criar pelada" block loading={create.isPending} />
    </form>
  );
}

function PasteInvite() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = extractInviteCode(value);
    if (!code) {
      setError('Cole o link ou o código que o admin mandou');
      return;
    }
    void navigate(`/convite/${code}`);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6"
      aria-label="Entrar por convite"
    >
      <TextField
        label="Link ou código"
        hint="O admin manda o link no grupo do WhatsApp. Cole o link inteiro ou só o código."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(undefined);
        }}
        error={error}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Cole aqui"
      />
      <Button type="submit" label="Ver convite" block />
    </form>
  );
}
