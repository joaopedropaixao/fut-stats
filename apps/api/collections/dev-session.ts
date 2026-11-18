// Sessões de desenvolvimento para a coleção do Bruno (o login de verdade é só Google).
// Rodar: pnpm --filter @fut-stats/api exec tsx collections/dev-session.ts
//
// No banco de DEV (DATABASE_URL do apps/api/.env), com as classes da própria API (SessionService, GroupsService):
// - garante 4 usuários de teste (dono, parceiro, intruso, inativo);
// - apaga os grupos que só têm esses usuários e nenhuma rodada (sobras de execuções anteriores);
// - cria a "Pelada Inativa" pelo fluxo real e desativa o usuário `inativo` nela (caso do 409);
// - assina a sessão de cada usuário e grava environments/local.bru.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SESSION_COOKIE, SessionService } from '../src/auth/session.service';
import { validateEnv, type Env } from '../src/config/env';
import { createInactiveGroup } from '../src/dev/dev-inactive-group';
import { removeLeftoverDevGroups } from '../src/dev/dev-leftovers';
import { GroupsService } from '../src/groups/groups.service';
import { PrismaService } from '../src/prisma/prisma.service';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, 'environments', 'local.bru');

const DEV_USERS = {
  owner: { name: 'Dono Dev', email: 'dono@dev.local' },
  joiner: { name: 'Parceiro Dev', email: 'parceiro@dev.local' },
  outsider: { name: 'Intruso Dev', email: 'intruso@dev.local' },
  inactive: { name: 'Inativo Dev', email: 'inativo@dev.local' },
} as const;

type DevUserKey = keyof typeof DEV_USERS;

/** Apaga dados: só no Postgres local, nunca em staging/produção. */
function assertLocalDatabase(databaseUrl: string): void {
  const { hostname } = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error(`dev-session.ts só roda em banco local (DATABASE_URL aponta para ${hostname})`);
  }
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(join(HERE, '..', '.env'));
  } catch {
    // sem .env: vale o ambiente
  }

  // Monta as dependências à mão: o tsx não emite metadados de decorator, então a injeção do Nest não funciona aqui.
  // As classes são as da API (mesma assinatura de sessão, mesmo fluxo de criar/entrar); o JwtService segue o
  // registro do AuthModule.
  const env = validateEnv(process.env);
  assertLocalDatabase(env.DATABASE_URL);
  const config = new ConfigService<Env, true>(env);
  const prisma = new PrismaService(config);
  const jwt = new JwtService({ secret: env.JWT_SECRET, signOptions: { algorithm: 'HS256' } });
  const sessions = new SessionService(jwt, config);
  const groups = new GroupsService(prisma);
  try {
    const ids = {} as Record<DevUserKey, string>;
    for (const [key, user] of Object.entries(DEV_USERS) as [
      DevUserKey,
      { name: string; email: string },
    ][]) {
      const saved = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name },
        create: { ...user, googleId: `dev-${user.email}` },
      });
      ids[key] = saved.id;
    }
    const devIds = Object.values(ids);

    // Grupos só de dev e sem rodada; apaga antes o registro e as resenhas deles (chaves Restrict).
    const leftoverIds = await removeLeftoverDevGroups(prisma, devIds);

    const { group: inactiveGroup, inviteCode: inactiveInviteCode } = await createInactiveGroup(
      prisma,
      groups,
      { owner: ids.owner, inactive: ids.inactive },
    );

    const cookie = (userId: string) => `${SESSION_COOKIE}=${sessions.sign(userId)}`;
    const vars = {
      baseUrl: `http://localhost:${env.PORT}`,
      ownerCookie: cookie(ids.owner),
      joinerCookie: cookie(ids.joiner),
      outsiderCookie: cookie(ids.outsider),
      inactiveCookie: cookie(ids.inactive),
      inactiveInviteCode,
      inactiveGroupId: inactiveGroup.id,
    };
    const body = Object.entries(vars)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join('\n');
    writeFileSync(ENV_FILE, `vars {\n${body}\n}\n`);

    console.log(
      `Sessões de dev geradas (${leftoverIds.length} grupo(s) antigo(s) removido(s)) em ${ENV_FILE}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
