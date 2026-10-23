import { SessionService, SESSION_COOKIE } from '../auth/session.service';
import type { Role } from '../generated/prisma/enums';
import type { TestApp } from './test-app';

let seq = 0;

/** Cria um usuário no banco. Campos únicos (email, googleId) mudam a cada chamada. */
export async function createUser(t: TestApp, data: { name?: string; email?: string } = {}) {
  seq += 1;
  return t.prisma.user.create({
    data: {
      name: data.name ?? `Jogador ${seq}`,
      email: data.email ?? `jogador${seq}@example.com`,
      googleId: `google-${seq}`,
    },
  });
}

/** Cria um grupo no banco, com slug único. */
export async function createGroup(t: TestApp, data: { name?: string } = {}) {
  seq += 1;
  return t.prisma.group.create({
    data: { name: data.name ?? `Pelada ${seq}`, slug: `pelada-${seq}` },
  });
}

/** Põe o usuário no grupo (ativo, PLAYER por padrão). */
export async function addMember(
  t: TestApp,
  userId: string,
  groupId: string,
  data: { role?: Role; active?: boolean } = {},
) {
  return t.prisma.membership.create({
    data: {
      userId,
      groupId,
      role: data.role ?? 'PLAYER',
      active: data.active ?? true,
      nickname: 'Apelido',
      primaryPosition: 'MIDFIELDER',
      secondaryPositions: [],
      initialRating: 6,
    },
  });
}

/**
 * "Loga como" o usuário: devolve o header Cookie de uma sessão válida dele.
 * Uso: `request(server).get('/api/me').set('Cookie', loginAs(t, user.id))`.
 */
export function loginAs(t: TestApp, userId: string): string {
  return `${SESSION_COOKIE}=${t.app.get(SessionService).sign(userId)}`;
}
