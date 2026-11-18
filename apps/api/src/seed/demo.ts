// Pelada de demonstração do staging (homologação dos admins). Reusa o seed de dev com outro grupo, outros e-mails
// fictícios e uma guarda própria, e acrescenta os admins reais (ou uma reserva para quem ainda não entrou).
// Quem chama pela linha de comando é `prisma/demo.ts`; o workflow "Preparar homologação" chama esse comando.
import { isIP } from 'node:net';
import { isNicknameTaken, NICKNAME_MAX_LENGTH } from '@fut-stats/domain';
import { z } from 'zod';
import { PENDING_GOOGLE_ID_PREFIX } from '../auth/pending-google-id';
import type { PrismaClient } from '../generated/prisma/client';
import { MEMBERS } from './seed-data';
import {
  DEFAULT_SEED_SCENARIO,
  parseSeedScenario,
  seed,
  type ExtraAdmin,
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

/** Minúsculas e sem ponto final (`Exemplo.Prod.Invalid.` vira `exemplo.prod.invalid`). */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '');
}

/** O host sem o `-pooler` do primeiro rótulo: o pooler e a conexão direta do Neon são o mesmo banco. */
function withoutPooler(host: string): string {
  return host.replace(/^([^.]+?)-pooler(?=\.|$)/, '$1');
}

/**
 * O banco do staging é sempre um host do Neon, um nome. Recusa host vazio (o `pg` cairia no `PGHOST` ou no localhost),
 * vários hosts (`a,b`) e IP literal (v4 ou v6, com ou sem colchetes), que burlariam a lista de hosts proibidos.
 */
function assertNamedHost(hostname: string): void {
  if (hostname === '') throw new Error('A DATABASE_URL precisa de um host (está vazio)');
  if (hostname.includes(',')) throw new Error('A DATABASE_URL não pode ter mais de um host');
  const bare = hostname.replace(/^\[|\]$/g, '');
  // `isIP` pega v4 e v6; o resto numérico (decimal, hexadecimal) também é endereço, não nome.
  if (
    isIP(bare) !== 0 ||
    bare.includes(':') ||
    /^(0x[0-9a-f]*|\d+)$/i.test(bare.split('.').pop()!)
  ) {
    throw new Error('A DATABASE_URL precisa de um nome de host, não de um IP');
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/i.test(bare)) {
    throw new Error('O host da DATABASE_URL tem caracteres inválidos');
  }
}

/**
 * Trava da demo, antes de abrir o banco: só roda com `ALLOW_DEMO_SEED=staging`, com `DEMO_FORBIDDEN_HOSTS`
 * preenchido (os hosts de produção, separados por vírgula, cada um só o host) e com o host do banco fora dessa
 * lista. A comparação ignora maiúsculas, ponto final e a variante `-pooler`. Recusa também uma URL que escolhe
 * o host por fora (`host=`/`hostaddr=` na query) ou com `%` no host. As mensagens nunca incluem a URL nem os valores.
 */
export function assertDemoSeedAllowed(
  env: Readonly<Record<string, string | undefined>>,
  databaseUrl: string | undefined,
): void {
  if (env.ALLOW_DEMO_SEED !== 'staging') {
    throw new Error('A demo só roda com ALLOW_DEMO_SEED=staging');
  }
  const items = (env.DEMO_FORBIDDEN_HOSTS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length === 0) {
    throw new Error('A demo precisa de DEMO_FORBIDDEN_HOSTS (o host do banco de produção)');
  }
  // Cada item é só o host: porta, esquema, usuário, caminho, espaço interno ou `%` mostram que é outra coisa.
  if (items.some((item) => /[\s:/@?#\\%]/.test(item))) {
    throw new Error('PROD_DB_HOST deve ser só o host (sem porta, esquema, caminho nem espaço)');
  }
  const forbidden = items.map((item) => withoutPooler(normalizeHost(item)));

  let url: URL;
  try {
    url = new URL(databaseUrl ?? '');
  } catch {
    throw new Error('DATABASE_URL ausente ou inválida');
  }
  for (const key of url.searchParams.keys()) {
    if (['host', 'hostaddr'].includes(key.toLowerCase())) {
      throw new Error('DATABASE_URL não pode escolher o host por parâmetro (host= ou hostaddr=)');
    }
  }
  if (url.hostname.includes('%')) {
    throw new Error('O host da DATABASE_URL não pode ter caracteres codificados (%)');
  }
  assertNamedHost(url.hostname);
  const host = withoutPooler(normalizeHost(url.hostname));
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
    assertRealAdminEmail(email);
  }
  return [...new Set(emails)];
}

/** E-mail de jogador fictício não vira admin (seria promover um fictício por colisão de e-mail). */
function assertRealAdminEmail(email: string): void {
  if (email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
    throw new Error(`E-mail inválido para admin: "${email}" é de um jogador fictício da demo`);
  }
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
  /** Admins que já tinham conta. */
  adminsExisting: number;
  /** Admins sem conta (ou ainda só com a reserva): ficam com a reserva até o primeiro login com Google. */
  adminsReserved: number;
}

/**
 * Recria só o grupo `pelada-demo` e devolve o resumo. Os usuários (inclusive os reais) continuam existindo.
 * Os admins entram junto dos fictícios, antes de montar as rodadas: na rodada atual ficam confirmados e escalados
 * (e, na votação, entre os que ainda não votaram). Sem trava aqui: quem chama pela linha de comando passa antes por
 * `assertDemoSeedAllowed`. Se falhar no meio, rodar de novo recria tudo (a demo não é atômica).
 */
export async function seedDemo(
  prisma: PrismaClient,
  { admins, scenario = DEFAULT_SEED_SCENARIO, now = new Date() }: DemoOptions,
): Promise<DemoSummary> {
  const emails = [...new Set(admins.map(normalizeEmail))];
  emails.forEach(assertRealAdminEmail);

  await resetDemoGroup(prisma);

  let adminsExisting = 0;
  let adminsReserved = 0;
  const nicknames: string[] = MEMBERS.map((m) => m.nickname);
  const extraAdmins: ExtraAdmin[] = [];
  for (const email of emails) {
    // E-mail normalizado e comparação exata (a coluna é única): sem ambiguidade entre variantes de caixa.
    let user = await prisma.user.findUnique({ where: { email } });
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
    const nickname = uniqueNickname(firstName(user.name), nicknames);
    nicknames.push(nickname);
    extraAdmins.push({ userId: user.id, nickname });
  }

  const summary = await seed(prisma, {
    scenario,
    now,
    target: { ...DEMO_TARGET, extraAdmins },
  });
  return { ...summary, adminsExisting, adminsReserved };
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

/** O apelido é único no grupo (sem diferenciar maiúscula nem acento, regra do domain): repetido ganha um número no fim. */
function uniqueNickname(base: string, taken: readonly string[]): string {
  if (!isNicknameTaken(base, taken)) return base;
  for (let n = 2; ; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, NICKNAME_MAX_LENGTH - suffix.length) + suffix;
    if (!isNicknameTaken(candidate, taken)) return candidate;
  }
}
