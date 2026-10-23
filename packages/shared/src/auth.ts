import { ROLES } from '@fut-stats/domain';
import { z } from 'zod';

export const roleSchema = z.enum(ROLES);

/** Usuário logado, como a API devolve. */
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
});

/** Um grupo em que o usuário é membro ativo, com o papel dele ali. */
export const myGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: roleSchema,
});

/** Resposta de GET /api/me. */
export const meResponseSchema = z.object({
  user: sessionUserSchema,
  groups: z.array(myGroupSchema),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
export type MyGroup = z.infer<typeof myGroupSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
