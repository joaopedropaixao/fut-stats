import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { TEST_DATABASE_URL } from '../test/database-url';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { assertDemoSeedAllowed, DEMO_GROUP, parseDemoAdmins, seedDemo } from './demo';
import { assertSeedAllowed, seed, SEED_SCENARIOS, type SeedScenario } from './seed';
import { SEED_GROUP } from './seed-data';

const NOW = new Date('2026-10-24T15:10:00Z');
/** Cada teste monta a demo inteira (às vezes duas vezes): folga contra o timeout padrão. */
const DEMO_TIMEOUT_MS = 30_000;
const FORBIDDEN = 'ep-prod-1234.us-east-1.aws.neon.tech';
const STAGING_URL = 'postgresql://user:segredo@ep-stg-9999.us-east-1.aws.neon.tech/neondb';

const okEnv = { ALLOW_DEMO_SEED: 'staging', DEMO_FORBIDDEN_HOSTS: FORBIDDEN };

describe('travas da demo (assertDemoSeedAllowed)', () => {
  it('C1: ALLOW_DEMO_SEED ausente, vazio ou diferente de staging recusa', () => {
    for (const value of [undefined, '', 'production', 'Staging', 'true']) {
      expect(() =>
        assertDemoSeedAllowed({ ...okEnv, ALLOW_DEMO_SEED: value }, STAGING_URL),
      ).toThrow('ALLOW_DEMO_SEED=staging');
    }
  });

  it('C2: host da URL igual a um proibido recusa, sem imprimir a URL (nem em outra caixa, com porta e parâmetros)', () => {
    const url = `postgresql://user:segredo@${FORBIDDEN.toUpperCase()}:5432/neondb?sslmode=require`;
    let message = '';
    try {
      assertDemoSeedAllowed(okEnv, url);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('DEMO_FORBIDDEN_HOSTS');
    expect(message).not.toContain('segredo');
    expect(message).not.toContain(FORBIDDEN);
    expect(message).not.toContain('postgresql');
  });

  it('C2: com mais de um host proibido (vírgula e espaços), qualquer um barra; host diferente passa', () => {
    const env = { ...okEnv, DEMO_FORBIDDEN_HOSTS: ` outro.exemplo.invalid , ${FORBIDDEN} ` };
    expect(() => assertDemoSeedAllowed(env, `postgresql://u:p@${FORBIDDEN}/db`)).toThrow();
    expect(() => assertDemoSeedAllowed(env, 'postgresql://u:p@outro.exemplo.invalid/db')).toThrow();
    expect(() => assertDemoSeedAllowed(env, STAGING_URL)).not.toThrow();
  });

  it('C3: DEMO_FORBIDDEN_HOSTS ausente, vazio ou só vírgulas recusa', () => {
    for (const value of [undefined, '', '  ', ' , ,']) {
      expect(() =>
        assertDemoSeedAllowed({ ...okEnv, DEMO_FORBIDDEN_HOSTS: value }, STAGING_URL),
      ).toThrow('DEMO_FORBIDDEN_HOSTS');
    }
  });

  it('C2: item que não é host simples (porta, esquema, caminho, usuário, espaço interno) recusa o comando sem ecoar o valor', () => {
    for (const item of [
      'exemplo.prod.invalid:5432',
      'postgresql://exemplo.prod.invalid',
      'exemplo.prod.invalid/neondb',
      'user@exemplo.prod.invalid',
      'exemplo prod.invalid',
      'exemplo.prod.invalid?x=1',
    ]) {
      const env = { ...okEnv, DEMO_FORBIDDEN_HOSTS: `outro.exemplo.invalid,${item}` };
      let message = '';
      try {
        assertDemoSeedAllowed(env, STAGING_URL);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('PROD_DB_HOST deve ser só o host');
      expect(message).not.toContain(item);
    }
  });

  it('C2: ponto final e maiúsculas no host da URL ou na lista não escapam da trava', () => {
    const host = 'exemplo.prod.invalid';
    const env = { ...okEnv, DEMO_FORBIDDEN_HOSTS: host };
    expect(() => assertDemoSeedAllowed(env, `postgresql://u:p@${host}./db`)).toThrow('proibidos');
    expect(() => assertDemoSeedAllowed(env, `postgresql://u:p@EXEMPLO.Prod.Invalid/db`)).toThrow(
      'proibidos',
    );
    const listed = { ...okEnv, DEMO_FORBIDDEN_HOSTS: ' Exemplo.PROD.invalid. ' };
    expect(() => assertDemoSeedAllowed(listed, `postgresql://u:p@${host}/db`)).toThrow('proibidos');
    expect(() => assertDemoSeedAllowed(env, `postgresql://u:p@${host}.:5432/db`)).toThrow(
      'proibidos',
    );
  });

  it('C2: a variante -pooler do host proibido (e o inverso) também barra', () => {
    const direct = 'ep-abc.us-east-1.aws.neon.tech';
    const pooler = 'ep-abc-pooler.us-east-1.aws.neon.tech';
    expect(() =>
      assertDemoSeedAllowed(
        { ...okEnv, DEMO_FORBIDDEN_HOSTS: direct },
        `postgresql://u:p@${pooler}/db`,
      ),
    ).toThrow('proibidos');
    expect(() =>
      assertDemoSeedAllowed(
        { ...okEnv, DEMO_FORBIDDEN_HOSTS: pooler },
        `postgresql://u:p@${direct}/db`,
      ),
    ).toThrow('proibidos');
    // Outro endpoint (nome parecido) continua passando
    expect(() =>
      assertDemoSeedAllowed(
        { ...okEnv, DEMO_FORBIDDEN_HOSTS: direct },
        'postgresql://u:p@ep-abcd-pooler.us-east-1.aws.neon.tech/db',
      ),
    ).not.toThrow();
  });

  it('C2: URL com host= ou hostaddr= na query, ou com % no host, recusa sem ecoar a URL', () => {
    for (const url of [
      `${STAGING_URL}?host=${FORBIDDEN}`,
      `${STAGING_URL}?sslmode=require&hostaddr=10.0.0.1`,
      `${STAGING_URL}?HOST=${FORBIDDEN}`,
      'postgresql://user:segredo@ep-stg%2D9999.us-east-1.aws.neon.tech/neondb',
    ]) {
      let message = '';
      try {
        assertDemoSeedAllowed(okEnv, url);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toBe('');
      expect(message).not.toContain('segredo');
      expect(message).not.toContain('postgresql');
      expect(message).not.toContain(FORBIDDEN);
    }
  });

  it('DATABASE_URL ausente ou inválida recusa sem ecoar o valor', () => {
    expect(() => assertDemoSeedAllowed(okEnv, undefined)).toThrow('DATABASE_URL');
    expect(() => assertDemoSeedAllowed(okEnv, 'isso-nao-e-url')).toThrow(/DATABASE_URL/);
    expect(() => assertDemoSeedAllowed(okEnv, 'isso-nao-e-url')).not.toThrow('isso-nao-e-url');
  });

  it('C10: a guarda do seed de dev continua recusando produção (e sem NODE_ENV)', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(
      'O seed não roda em produção',
    );
    expect(() => assertSeedAllowed({})).toThrow('O seed não roda em produção');
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('--admins (parseDemoAdmins)', () => {
  it('normaliza (espaço e maiúsculas), tira repetidos e aceita as duas formas do argumento', () => {
    expect(parseDemoAdmins(['--admins= A@X.com, b@y.com ,a@x.com'])).toEqual([
      'a@x.com',
      'b@y.com',
    ]);
    expect(parseDemoAdmins(['--cenario=times', '--admins', 'Z@Z.com'])).toEqual(['z@z.com']);
  });

  it('C4: lista vazia ou ausente recusa', () => {
    expect(() => parseDemoAdmins([])).toThrow('Informe os admins');
    expect(() => parseDemoAdmins(['--admins='])).toThrow('Informe os admins');
    expect(() => parseDemoAdmins(['--admins= , '])).toThrow('Informe os admins');
  });

  it('C4: e-mail inválido recusa com a mensagem do e-mail ruim', () => {
    expect(() => parseDemoAdmins(['--admins=ok@x.com,sem-arroba'])).toThrow(
      'E-mail inválido: "sem-arroba"',
    );
    expect(() => parseDemoAdmins(['--admins=a@'])).toThrow('E-mail inválido: "a@"');
    expect(() => parseDemoAdmins(['--admins=a b@x.com'])).toThrow('E-mail inválido');
  });
});

describe('comando db:demo (prisma/demo.ts)', () => {
  const apiRoot = resolve(__dirname, '../..');
  function runCli(vars: Record<string, string | undefined>, args: string[]) {
    const base: NodeJS.ProcessEnv = { ...process.env };
    delete base.ALLOW_DEMO_SEED;
    delete base.DEMO_FORBIDDEN_HOSTS;
    return spawnSync(resolve(apiRoot, 'node_modules/.bin/tsx'), ['prisma/demo.ts', ...args], {
      cwd: apiRoot,
      env: { ...base, ...(vars as NodeJS.ProcessEnv) },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('C1/C2/C3: sai com código 1, diz o motivo, não imprime a URL e não toca no banco', async () => {
    const args = ['--admins=a@x.com'];
    const dbHost = new URL(TEST_DATABASE_URL).hostname;
    const cases = [
      {
        vars: { DATABASE_URL: TEST_DATABASE_URL, DEMO_FORBIDDEN_HOSTS: FORBIDDEN },
        motivo: 'ALLOW_DEMO_SEED',
      },
      {
        vars: { DATABASE_URL: TEST_DATABASE_URL, ALLOW_DEMO_SEED: 'staging' },
        motivo: 'DEMO_FORBIDDEN_HOSTS',
      },
      {
        vars: {
          DATABASE_URL: TEST_DATABASE_URL,
          ALLOW_DEMO_SEED: 'staging',
          DEMO_FORBIDDEN_HOSTS: dbHost,
        },
        motivo: 'proibidos',
      },
    ];
    for (const { vars, motivo } of cases) {
      const result = runCli(vars, args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(motivo);
      expect(result.stderr + result.stdout).not.toContain(TEST_DATABASE_URL);
      expect(result.stderr + result.stdout).not.toContain('postgres:postgres');
      expect(result.stdout).not.toContain('Demo ok');
    }
    expect(await t.prisma.group.count()).toBe(0);
    expect(await t.prisma.user.count()).toBe(0);
  }, 60_000);

  it('C4: e-mail inválido sai com código 1 antes de abrir o banco', async () => {
    const result = runCli({ DATABASE_URL: TEST_DATABASE_URL, ...okEnv }, [
      '--admins=ok@x.com,ruim',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('E-mail inválido: "ruim"');
    expect(await t.prisma.group.count()).toBe(0);
  }, 40_000);

  it('com as travas ok monta a demo e imprime só o resumo (sem URL)', async () => {
    const result = runCli({ DATABASE_URL: TEST_DATABASE_URL, ...okEnv }, ['--admins=a@x.com']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Demo ok');
    expect(result.stdout + result.stderr).not.toContain('postgres:postgres');
    const group = await t.prisma.group.findUnique({ where: { slug: DEMO_GROUP.slug } });
    expect(group?.name).toBe('Pelada de Demonstração');
  }, 60_000);
});

describe('pelada de demonstração (seedDemo)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });
  afterAll(async () => {
    await t.app.close();
  });

  const demoGroup = () => t.prisma.group.findUniqueOrThrow({ where: { slug: DEMO_GROUP.slug } });

  it(
    'C5: grupo pelada-demo com 21 fictícios (@demo.invalid) + admins, 9 rodadas e resenhas; admins são ADMIN',
    async () => {
      const summary = await seedDemo(t.prisma, {
        admins: ['Ana.Paula@x.com ', 'bia@y.com'],
        now: NOW,
      });

      const group = await demoGroup();
      expect(group).toMatchObject({ name: 'Pelada de Demonstração', slug: 'pelada-demo' });
      expect(summary).toMatchObject({
        members: 23,
        rounds: 9,
        adminsExisting: 0,
        adminsReserved: 2,
      });

      const memberships = await t.prisma.membership.findMany({
        where: { groupId: group.id },
        include: { user: true },
      });
      expect(memberships).toHaveLength(23);
      const fictional = memberships.filter((m) => m.user.email.endsWith('@demo.invalid'));
      expect(fictional).toHaveLength(21);
      for (const m of fictional) expect(m.user.googleId).toBe(`demo-${m.user.email}`);

      const admins = memberships.filter((m) => m.user.googleId.startsWith('pendente:'));
      expect(admins.map((m) => m.user.email).sort()).toEqual(['ana.paula@x.com', 'bia@y.com']);
      for (const m of admins) {
        expect(m).toMatchObject({
          role: 'ADMIN',
          primaryPosition: 'MIDFIELDER',
          initialRating: 6,
          active: true,
        });
      }
      expect(admins.find((m) => m.user.email === 'ana.paula@x.com')).toMatchObject({
        nickname: 'Ana',
        user: { name: 'ana.paula' },
      });

      expect(await t.prisma.round.count({ where: { groupId: group.id } })).toBe(9);
      expect(await t.prisma.post.count({ where: { groupId: group.id } })).toBeGreaterThan(0);
    },
    DEMO_TIMEOUT_MS,
  );

  it(
    'C6: com o grupo do seed de dev no banco, rodar a demo duas vezes não mexe nele e recria a demo sem duplicar',
    async () => {
      await seed(t.prisma, { now: NOW, env: { NODE_ENV: 'test' } });
      const snapshot = async () => {
        const dev = await t.prisma.group.findUniqueOrThrow({ where: { slug: SEED_GROUP.slug } });
        return {
          group: dev,
          memberships: await t.prisma.membership.findMany({
            where: { groupId: dev.id },
            orderBy: { id: 'asc' },
          }),
          rounds: await t.prisma.round.findMany({
            where: { groupId: dev.id },
            orderBy: { id: 'asc' },
          }),
          posts: await t.prisma.post.count({ where: { groupId: dev.id } }),
        };
      };
      const before = await snapshot();
      expect(before.memberships).toHaveLength(21);

      await seedDemo(t.prisma, { admins: ['a@x.com'], now: NOW });
      const firstDemo = await demoGroup();
      await seedDemo(t.prisma, { admins: ['a@x.com'], now: NOW });

      expect(await snapshot()).toEqual(before);
      const demo = await demoGroup();
      expect(demo.id).not.toBe(firstDemo.id);
      expect(await t.prisma.group.count()).toBe(2);
      expect(await t.prisma.membership.count({ where: { groupId: demo.id } })).toBe(22);
      expect(await t.prisma.round.count({ where: { groupId: demo.id } })).toBe(9);
      expect(await t.prisma.round.count({ where: { groupId: firstDemo.id } })).toBe(0);
      expect(await t.prisma.user.count({ where: { email: 'a@x.com' } })).toBe(1);
      expect(await t.prisma.user.count({ where: { email: { endsWith: '@demo.invalid' } } })).toBe(
        21,
      );
    },
    DEMO_TIMEOUT_MS * 2,
  );

  it(
    'C7: admin que já tem User ganha a membership ADMIN no User existente (apelido = primeiro nome)',
    async () => {
      const user = await t.prisma.user.create({
        data: { email: 'joao@gmail.com', name: 'João Pedro Paixão', googleId: 'google-real' },
      });

      const summary = await seedDemo(t.prisma, { admins: ['JOAO@gmail.com'], now: NOW });

      expect(summary).toMatchObject({ adminsExisting: 1, adminsReserved: 0 });
      expect(await t.prisma.user.findMany({ where: { email: 'joao@gmail.com' } })).toEqual([user]);
      const membership = await t.prisma.membership.findFirstOrThrow({
        where: { userId: user.id, group: { slug: DEMO_GROUP.slug } },
      });
      expect(membership).toMatchObject({
        role: 'ADMIN',
        nickname: 'João',
        primaryPosition: 'MIDFIELDER',
        initialRating: 6,
      });
    },
    DEMO_TIMEOUT_MS,
  );

  it(
    'C7: rodar de novo devolve o admin à demo recriada, sem duplicar o User nem a reserva',
    async () => {
      await seedDemo(t.prisma, { admins: ['novo@x.com'], now: NOW });
      const summary = await seedDemo(t.prisma, { admins: ['novo@x.com'], now: NOW });

      expect(summary).toMatchObject({ adminsReserved: 1, adminsExisting: 0 });
      expect(await t.prisma.user.count({ where: { email: 'novo@x.com' } })).toBe(1);
      const group = await demoGroup();
      expect(
        await t.prisma.membership.count({
          where: { groupId: group.id, role: 'ADMIN', user: { email: 'novo@x.com' } },
        }),
      ).toBe(1);
    },
    DEMO_TIMEOUT_MS * 2,
  );

  it(
    'apelido do admin que bate com um fictício ganha número no fim (apelido é único no grupo)',
    async () => {
      await seedDemo(t.prisma, { admins: ['rafa@x.com', 'rafa@y.com'], now: NOW });
      const group = await demoGroup();
      const nicknames = (
        await t.prisma.membership.findMany({
          where: { groupId: group.id },
          select: { nickname: true },
        })
      ).map((m) => m.nickname.toLowerCase());
      expect(new Set(nicknames).size).toBe(nicknames.length);
      expect(nicknames).toContain('rafa2');
    },
    DEMO_TIMEOUT_MS,
  );

  const EXPECTED_STATUS: Record<SeedScenario, string> = {
    agendada: 'SCHEDULED',
    times: 'TEAMS_PUBLISHED',
    'em-jogo': 'IN_PROGRESS',
    resenha: 'POST_MATCH',
    votacao: 'VOTING',
    encerrada: 'CLOSED',
  };

  it.each(SEED_SCENARIOS)(
    'C11: cenário %s deixa a rodada atual no estado pedido',
    async (scenario) => {
      await seedDemo(t.prisma, { admins: ['a@x.com'], scenario, now: NOW });

      const group = await demoGroup();
      const rounds = await t.prisma.round.findMany({
        where: { groupId: group.id },
        orderBy: { number: 'asc' },
      });
      expect(rounds).toHaveLength(9);
      expect(rounds.slice(0, 8).every((r) => r.status === 'CLOSED')).toBe(true);
      expect(rounds[8]!.status).toBe(EXPECTED_STATUS[scenario]);
    },
    DEMO_TIMEOUT_MS,
  );
});
