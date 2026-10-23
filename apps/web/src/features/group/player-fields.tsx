import { joinGroupSchema, positionSchema } from '@fut-stats/shared';
import type { z } from 'zod';
import { useState } from 'react';
import { TextField } from '../../components/ui/text-field';
import { PositionPicker } from './position-picker';

type Position = z.infer<typeof positionSchema>;

export type PlayerFieldErrors = { nickname?: string; primaryPosition?: string };

/** Apelido + posição, os dois campos de quem entra numa pelada. A validação é a do contrato compartilhado. */
export function usePlayerFields() {
  const [nickname, setNickname] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [errors, setErrors] = useState<PlayerFieldErrors>({});

  function validate(): { nickname: string; primaryPosition: Position } | null {
    const parsed = joinGroupSchema.safeParse({ nickname, primaryPosition: position ?? undefined });
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: PlayerFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'nickname') next.nickname ??= issue.message;
      if (key === 'primaryPosition') next.primaryPosition ??= 'Escolha sua posição';
    }
    setErrors(next);
    return null;
  }

  const fields = (
    <>
      <TextField
        label="Seu apelido"
        hint="Até 10 letras. É como o pessoal vai te ver."
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        error={errors.nickname}
        autoComplete="off"
        maxLength={30}
      />
      <PositionPicker value={position} onChange={setPosition} error={errors.primaryPosition} />
    </>
  );

  return { fields, validate };
}
