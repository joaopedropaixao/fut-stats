// Dados fictícios para desenvolvimento: o grupo "Pelada de Quinta" (convite `convite-dev`) com 18 jogadores
// de linha (2 deles admins) e 3 goleiros, 8 rodadas encerradas (uma por semana, até a semana passada, com
// times, placar, lances, votos e resultado) e a rodada atual no estado do cenário:
//   agendada (padrão)  confirmados, recusas e quem não respondeu
//   times              times publicados
//   em-jogo            jogo rolando, sem placar e sem lances (os lances entram na Resenha)
//   resenha            Resenha: placar final lançado e só parte dos lances (faltam gols)
//   votacao            votação aberta há pouco, com parte dos votos (os admins Carlão e Rafa ainda sem votar)
//   encerrada          votação fechada hoje, com o resultado (Craque, Perna de Pau e notas) gravado
// As rodadas passadas já vêm com votos e resultado gravado, fechadas de jeitos diferentes (todos votaram, prazo, admin).
// Rodar: pnpm --filter @fut-stats/api db:seed -- --cenario=em-jogo   (sem --cenario: agendada)
// Pode rodar de novo: atualiza os membros e recria só as rodadas desse grupo. A lógica fica em src/seed.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { parseSeedScenario, seed } from '../src/seed/seed';

async function main(): Promise<void> {
  const scenario = parseSeedScenario(process.argv.slice(2));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const summary = await seed(prisma, { scenario });
    console.log(
      `Seed ok (cenário ${summary.scenario}): grupo "${summary.groupName}" com ${summary.members} membros ` +
        `e ${summary.rounds} rodadas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
