import { createGroupSchema } from '@fut-stats/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { TextField } from '../../components/ui/text-field';
import { extractInviteCode } from '../../features/group/invite-code';
import { usePlayerFields } from '../../features/group/player-fields';
import { enterGroupErrorMessage, useCreateGroup } from '../../features/group/use-enter-group';

/** Logado e sem grupo: criar a pelada ou entrar por um convite. */
export function StartPage() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pt-6 pb-10">
      <title>Começar · Fut Stats</title>
      <header className="flex flex-col gap-2">
        <PixelText as="h1" size={24} wrap className="outline-none">
          Bora começar
        </PixelText>
        <p className="text-base text-text-muted">
          Crie a sua pelada ou entre numa que já existe com o link de convite.
        </p>
      </header>
      <CreateGroupForm />
      <PasteInvite />
    </div>
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Criar a pelada">
      <PixelText as="h2" size={16} className="text-text-muted">
        Criar a pelada
      </PixelText>
      <TextField
        label="Nome da pelada"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        autoComplete="off"
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
      className="flex flex-col gap-4 pt-2"
      aria-label="Entrar por convite"
    >
      <PixelText as="h2" size={16} className="text-text-muted">
        Tenho um convite
      </PixelText>
      <TextField
        label="Link ou código"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(undefined);
        }}
        error={error}
        autoComplete="off"
        autoCapitalize="off"
        placeholder="Cole aqui"
      />
      <Button type="submit" variant="secondary" label="Ver convite" block />
    </form>
  );
}
