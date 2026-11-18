// Pelada de demonstração do staging (homologação dos admins). Reusa o seed de dev com outro grupo, outros e-mails
// fictícios e uma guarda própria, e acrescenta os admins reais (ou uma reserva para quem ainda não entrou).
// Quem chama pela linha de comando é `prisma/demo.ts`; o workflow "Preparar homologação" chama esse comando.
import { NICKNAME_MAX_LENGTH } from '@fut-stats/domain';
import { z } from 'zod';
import { PENDING_GOOGLE_ID_PREFIX } from '../auth/pending-google-id';
import type { PrismaClient } from '../generated/prisma/client';
import {
  DEFAULT_SEED_SCENARIO,
  parseSeedScenario,
  seed,
  type SeedScenario,
  type SeedSummary,
  type SeedTarget,
} from './seed';

export const DEMO_GROUP = {
  name: 'Pelada de Demonstração',
  slug: 'pelada-demo',
  inviteCode: 'convite-demo',
} as const;

/** Domínio reservado (RFC 2606): nenhum e-mail fictício da demo existe de verdade. */
export const DEMO_EMAIL_DOMAIN = 'demo.invalid';

export const DEMO_TARGET: SeedTarget = {
  group: DEMO_GROUP,
  emailDomain: DEMO_EMAIL_DOMAIN,
  googleIdFor: (email) => `demo-${email}`,
  // A guarda da demo (`assertDemoSeedAllowed`) roda no comando, antes de abrir o banco.
  assertAllowed: () => undefined,
};

const ADMIN_RATING = 6;

/**
 * Trava da demo, antes de abrir o banco: só roda com `ALLOW_DEMO_SEED=staging`, com `DEMO_FORBIDDEN_HOSTS`
 * preenchido (os hosts de produção, separados por vírgula) e com o host do banco fora dessa lista.
 * As mensagens nunca incluem a URL.
 */
export function assertDemoSeedAllowed(
  env: Readonly<Record<string, string | undefined>>,
  databaseUrl: string | undefined,
): void {
  if (env.ALLOW_DEMO_SEED !== 'staging') {
    throw new Error('A demo só roda com ALLOW_DEMO_SEED=staging');
  }
  const forbidden = (env.DEMO_FORBIDDEN_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
  if (forbidden.length === 0) {
    throw new Error('A demo precisa de DEMO_FORBIDDEN_HOSTS (o host do banco de produção)');
  }
  let host: string;
  try {
    host = new URL(databaseUrl ?? '').hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL ausente ou inválida');
  }
  if (forbidden.includes(host)) {
    throw new Error('O banco é um dos proibidos em DEMO_FORBIDDEN_HOSTS: a demo não roda');
  }
}

const emailSchema = z.email();

/** Lê `--admins=a@x.com,b@y.com` (ou `--admins <lista>`): e-mails sem espaço nas pontas, em minúsculas, sem repetir. */
export function parseDemoAdmins(argv: readonly string[]): string[] {
  let value: string | undefined;
  argv.forEach((arg, i) => {
    if (arg.startsWith('--admins=')) value = arg.slice('--admins='.length);
    else if (arg === '--admins') value = argv[i + 1];
  });
  const emails = (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== '');
  if (emails.length === 0) {
    throw new Error('Informe os admins: --admins=a@exemplo.com,b@exemplo.com');
  }
  for (const email of emails) {
    if (!emailSchema.safeParse(email).success) throw new Error(`E-mail inválido: "${email}"`);
  }
  return [...new Set(emails)];
}

/** Lê `--cenario=` (o mesmo do seed de dev). */
export const parseDemoScenario = parseSeedScenario;

export interface DemoOptions {
  /** E-mails dos admins (já normalizados por `parseDemoAdmins`; normaliza de novo por segurança). */
  admins: readonly string[];
  scenario?: SeedScenario;
  now?: Date;
}

export interface DemoSummary extends SeedSummary {
  /** Admins que já tinham conta e ganharam a membership. */
  adminsExisting: number;
  /** Admins sem conta: ficam com uma reserva até o primeiro login com Google. */
  adminsReserved: number;
}

/**
 * Recria só o grupo `pelada-demo` e devolve o resumo. Os usuários (inclusive os reais) continuam existindo.
 * Sem trava aqui: quem chama pela linha de comando passa antes por `assertDemoSeedAllowed`.
 */
export async function seedDemo(
  prisma: PrismaClient,
  { admins, scenario = DEFAULT_SEED_SCENARIO, now = new Date() }: DemoOptions,
): Promise<DemoSummary> {
  const emails = [...new Set(admins.map(normalizeEmail))];

  await resetDemoGroup(prisma);
  const summary = await seed(prisma, { scenario, now, target: DEMO_TARGET });

  const taken = new Set(
    (
      await prisma.membership.findMany({
        where: { groupId: summary.groupId },
        select: { nickname: true },
      })
    ).map((m) => nicknameKey(m.nickname)),
  );

  let adminsExisting = 0;
  let adminsReserved = 0;
  for (const email of emails) {
    let user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (user) {
      // Reserva de uma rodada anterior (a pessoa ainda não entrou) continua contando como reservada.
      if (user.googleId.startsWith(PENDING_GOOGLE_ID_PREFIX)) adminsReserved++;
      else adminsExisting++;
    } else {
      const localPart = email.slice(0, email.indexOf('@'));
      user = await prisma.user.create({
        data: { email, name: localPart, googleId: `${PENDING_GOOGLE_ID_PREFIX}${email}` },
      });
      adminsReserved++;
    }

    const nickname = uniqueNickname(firstName(user.name), taken);
    taken.add(nicknameKey(nickname));
    await prisma.membership.upsert({
      where: { userId_groupId: { userId: user.id, groupId: summary.groupId } },
      update: { role: 'ADMIN', active: true },
      create: {
        userId: user.id,
        groupId: summary.groupId,
        role: 'ADMIN',
        nickname,
        primaryPosition: 'MIDFIELDER',
        secondaryPositions: [],
        initialRating: ADMIN_RATING,
      },
    });
  }

  return {
    ...summary,
    members: summary.members + emails.length,
    adminsExisting,
    adminsReserved,
  };
}

/** Apaga só o grupo da demo, na ordem das chaves: resenhas, rodadas, auditoria, membros e o grupo. */
async function resetDemoGroup(prisma: PrismaClient): Promise<void> {
  const group = await prisma.group.findUnique({ where: { slug: DEMO_GROUP.slug } });
  if (!group) return;
  await prisma.$transaction(
    async (tx) => {
      // Reações e comentários saem junto das resenhas; as tabelas da rodada saem junto das rodadas (cascata).
      await tx.post.deleteMany({ where: { groupId: group.id } });
      await tx.round.deleteMany({ where: { groupId: group.id } });
      await tx.auditLog.deleteMany({ where: { groupId: group.id } });
      await tx.membership.deleteMany({ where: { groupId: group.id } });
      await tx.group.delete({ where: { id: group.id } });
    },
    { timeout: 60_000 },
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Primeiro nome com a inicial maiúscula, cortado no limite do apelido ("joao.silva" → "Joao"). */
function firstName(name: string): string {
  const first = name.trim().split(/[\s._+-]+/)[0] ?? '';
  const nickname = (first.charAt(0).toUpperCase() + first.slice(1)).slice(0, NICKNAME_MAX_LENGTH);
  return nickname === '' ? 'Admin' : nickname;
}

function nicknameKey(nickname: string): string {
  return nickname.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** O apelido é único no grupo (sem diferenciar maiúscula nem acento): repetido ganha um número no fim. */
function uniqueNickname(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(nicknameKey(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, NICKNAME_MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(nicknameKey(candidate))) return candidate;
  }
}
