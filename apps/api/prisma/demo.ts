// Pelada de demonstração do staging: recria só o grupo `pelada-demo` e põe os e-mails passados como admins.
// Rodar: pnpm --filter @fut-stats/api db:demo -- --admins=a@x.com,b@y.com [--cenario=times]
// Precisa de DATABASE_URL, ALLOW_DEMO_SEED=staging e DEMO_FORBIDDEN_HOSTS (host(s) de produção, separados por vírgula).
// Recusa (código 1) antes de abrir o banco se alguma trava falhar. Nunca imprime a URL do banco.
// Pode rodar de novo: apaga e recria só a demo. A lógica fica em src/seed/demo.ts.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  assertDemoSeedAllowed,
  parseDemoAdmins,
  parseDemoScenario,
  seedDemo,
} from '../src/seed/demo';

async function main(): Promise<void> {
  // Antes de qualquer conexão: com trava falhando o comando nem chega a abrir o banco.
  assertDemoSeedAllowed(process.env, process.env.DATABASE_URL);
  const argv = process.argv.slice(2);
  const admins = parseDemoAdmins(argv);
  const scenario = parseDemoScenario(argv);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const summary = await seedDemo(prisma, { admins, scenario });
    console.log(
      `Demo ok: "${summary.groupName}", cenário ${summary.scenario}: ${summary.members} membros ` +
        `(${admins.length} admins: ${summary.adminsExisting} já com conta, ${summary.adminsReserved} reservados), ` +
        `${summary.rounds} rodadas, ${summary.posts} resenhas.` +
        (summary.extraAdminsOutOfRound > 0
          ? ` ${summary.extraAdminsOutOfRound} admins ficaram fora da rodada atual (sem vaga na formação), mas são admins da pelada.`
          : ''),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
