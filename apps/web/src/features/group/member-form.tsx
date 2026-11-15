import {
  updateMemberSchema,
  type Member,
  type RosterMember,
  type UpdateMemberInput,
} from '@fut-stats/shared';
import { useRef, useState, type FormEvent } from 'react';
import { useBlocker } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { Switch } from '../../components/ui/switch';
import { TextField } from '../../components/ui/text-field';
import { apiErrorMessage } from '../../lib/api';
import { AvatarBuilder } from './avatar-builder';
import { FieldErrorNotice } from './field-error-notice';
import { nicknameErrorFromIssues } from './field-errors';
import { memberChanges, type MemberFormValues } from './member-changes';
import { useUpdateMember } from './members';
import { PositionPicker, type Position } from './position-picker';
import { RatingStepper } from './rating-stepper';
import { SecondaryPicker } from './secondary-picker';
import { secondariesAfterPrimary, type PositionsError } from './secondary-positions';
import { nicknameTakenMessage } from './use-enter-group';
import { useRevealFieldError } from './use-reveal-field-error';

type MemberFormProps = {
  groupId: string;
  member: Member | RosterMember;
  /** `true` na edição pelo Elenco: aparece o bloco "Só o admin" (nota, goleiro contratado, papel). */
  adminFields: boolean;
  /** É o membro que está vendo: o papel fica travado ("Você não muda o próprio papel"). */
  isMe: boolean;
  /** Depois de salvar: a tela volta para a lista (e mostra o aviso). */
  onSaved: () => void;
};

function initialValues(member: Member | RosterMember): MemberFormValues {
  return {
    nickname: member.nickname,
    avatar: member.avatar,
    primaryPosition: member.primaryPosition,
    secondaryPositions: member.secondaryPositions,
    initialRating: 'initialRating' in member ? member.initialRating : 6,
    isHiredGoalkeeper: member.isHiredGoalkeeper,
    isAdmin: member.role === 'ADMIN',
  };
}

/**
 * O formulário de perfil: apelido, bonequinho, posição principal e secundárias (até 2). No Elenco ganha o bloco
 * "Só o admin". "Salvar" é a única tecla amarela e só acende com mudança. Sair com mudança abre "Sair sem salvar?".
 * Os erros vêm da API com o texto do shared (apelido em uso aparece no campo do apelido).
 */
export function MemberForm({ groupId, member, adminFields, isMe, onSaved }: MemberFormProps) {
  const [initial] = useState(() => initialValues(member));
  const [values, setValues] = useState<MemberFormValues>(initial);
  const [nicknameError, setNicknameError] = useState<string>();
  const [positionsError, setPositionsError] = useState<PositionsError | null>(null);
  const update = useUpdateMember(groupId, member.id);
  const saved = useRef(false);
  // Apelido em uso (409 NICKNAME_TAKEN) é erro do campo, não da tela
  const takenMessage = nicknameTakenMessage(update.error);
  const { formRef, failed, notice } = useRevealFieldError(
    ['nickname'],
    { nickname: nicknameError ?? takenMessage },
    takenMessage ? update.error : null,
  );

  const changes = memberChanges(initial, values, { adminFields, isMe });
  const dirty = Object.keys(changes).length > 0;

  // Sair com mudança (voltar, outra aba): pergunta antes; depois de salvar, passa direto
  const blocker = useBlocker(() => dirty && !saved.current);

  const patch = (next: Partial<MemberFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    update.reset();
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    const parsed = updateMemberSchema.safeParse(changes satisfies UpdateMemberInput);
    if (!parsed.success) {
      setNicknameError(nicknameErrorFromIssues(parsed.error.issues));
      failed();
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () => {
        saved.current = true;
        onSaved();
      },
    });
  }

  const fieldError = nicknameError ?? takenMessage;

  return (
    <>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        aria-label="Editar perfil"
        className="flex flex-col gap-6"
      >
        <TextField
          label="Apelido"
          hint="Até 10 letras. É como o pessoal vai te ver."
          value={values.nickname}
          onChange={(e) => {
            setNicknameError(undefined);
            patch({ nickname: e.target.value });
          }}
          autoCapitalize="words"
          autoComplete="off"
          error={fieldError}
          data-field="nickname"
        />
        <AvatarBuilder
          value={values.avatar}
          nickname={values.nickname}
          onChange={(avatar) => patch({ avatar })}
        />
        <PositionPicker
          label="Posição principal"
          value={values.primaryPosition}
          onChange={(primary: Position) => {
            setPositionsError(null);
            patch({
              primaryPosition: primary,
              secondaryPositions: secondariesAfterPrimary(primary, values.secondaryPositions),
            });
          }}
        />
        <SecondaryPicker
          primary={values.primaryPosition}
          value={values.secondaryPositions}
          onChange={(secondaryPositions) => patch({ secondaryPositions })}
          error={positionsError}
          onError={setPositionsError}
        />

        {adminFields && (
          <section
            aria-labelledby="so-admin"
            className="moment-frame animate-moment-in flex flex-col gap-5 bg-surface-raised p-4"
          >
            <h2 id="so-admin">
              <PixelText>Só o admin</PixelText>
            </h2>
            <RatingStepper
              label="Nota inicial"
              value={values.initialRating}
              onChange={(initialRating) => patch({ initialRating })}
            />
            <div className="flex flex-col shadow-[inset_0_2px_0_0_var(--color-border)]">
              <Switch
                label="Goleiro contratado"
                checked={values.isHiredGoalkeeper}
                onCheckedChange={(isHiredGoalkeeper) => patch({ isHiredGoalkeeper })}
                className="px-0"
              />
              <Switch
                label="Admin"
                checked={values.isAdmin}
                disabled={isMe}
                hint={isMe ? 'Você não muda o próprio papel' : undefined}
                onCheckedChange={(isAdmin) => patch({ isAdmin })}
                className="px-0 shadow-[inset_0_2px_0_0_var(--color-border)]"
              />
            </div>
          </section>
        )}

        {update.isError && !takenMessage && (
          <p role="alert" className="text-sm text-[#fca5a5]">
            {apiErrorMessage(update.error, 'Não deu para salvar agora. Tente de novo.')}
          </p>
        )}
        <FieldErrorNotice message={notice} />
        <Button type="submit" label="Salvar" block disabled={!dirty} loading={update.isPending} />
      </form>

      {blocker.state === 'blocked' && (
        <Sheet
          title="Sair sem salvar?"
          onClose={() => blocker.reset()}
          actions={(close) => (
            <>
              <Button
                variant="outline"
                size={52}
                label="Continuar"
                className="flex-1"
                onClick={close}
              />
              <Button
                variant="danger"
                size={52}
                icon="x"
                label="Sair"
                className="flex-1"
                onClick={() => blocker.proceed()}
              />
            </>
          )}
        >
          <p>As mudanças que você fez ainda não foram salvas.</p>
        </Sheet>
      )}
    </>
  );
}
