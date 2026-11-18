import { z } from 'zod';
import { roleSchema } from './auth';

/** Uma pessoa do banco local no login de desenvolvimento (`GET /api/dev/users`, só em dev). */
export const devUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  memberships: z.array(
    z.object({
      nickname: z.string(),
      role: roleSchema,
      active: z.boolean(),
      groupName: z.string(),
    }),
  ),
});

export const devUsersSchema = z.array(devUserSchema);

export type DevUser = z.infer<typeof devUserSchema>;
