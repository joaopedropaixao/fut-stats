// Dados fictícios para desenvolvimento: 1 grupo, 14 jogadores de linha (2 deles admins) e 3 goleiros.
// Rodar: pnpm --filter @fut-stats/api db:seed. Pode rodar de novo: atualiza em vez de duplicar.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Position, type Role } from '../src/generated/prisma/client';

interface SeedMember {
  name: string;
  nickname: string;
  role?: Role;
  primaryPosition: Position;
  secondaryPositions: Position[];
  initialRating: number;
  isHiredGoalkeeper?: boolean;
}

const MEMBERS: SeedMember[] = [
  // Admins (também jogam)
  {
    name: 'Carlos Andrade',
    nickname: 'Carlão',
    role: 'ADMIN',
    primaryPosition: 'MIDFIELDER',
    secondaryPositions: ['WINGER'],
    initialRating: 7,
  },
  {
    name: 'Rafael Moura',
    nickname: 'Rafa',
    role: 'ADMIN',
    primaryPosition: 'DEFENDER',
    secondaryPositions: ['MIDFIELDER'],
    initialRating: 6.5,
  },
  // Jogadores de linha
  {
    name: 'Bruno Lima',
    nickname: 'Bruninho',
    primaryPosition: 'DEFENDER',
    secondaryPositions: ['WINGER'],
    initialRating: 6,
  },
  {
    name: 'Diego Souza',
    nickname: 'Diegão',
    primaryPosition: 'DEFENDER',
    secondaryPositions: [],
    initialRating: 7.5,
  },
  {
    name: 'Eduardo Ramos',
    nickname: 'Dudu',
    primaryPosition: 'DEFENDER',
    secondaryPositions: ['MIDFIELDER'],
    initialRating: 5.5,
  },
  {
    name: 'Felipe Costa',
    nickname: 'Felipinho',
    primaryPosition: 'WINGER',
    secondaryPositions: ['FORWARD'],
    initialRating: 8,
  },
  {
    name: 'Gustavo Pereira',
    nickname: 'Guga',
    primaryPosition: 'WINGER',
    secondaryPositions: ['DEFENDER'],
    initialRating: 6.5,
  },
  {
    name: 'Henrique Alves',
    nickname: 'Rique',
    primaryPosition: 'WINGER',
    secondaryPositions: ['MIDFIELDER'],
    initialRating: 7,
  },
  {
    name: 'Igor Martins',
    nickname: 'Igão',
    primaryPosition: 'WINGER',
    secondaryPositions: ['DEFENDER'],
    initialRating: 5,
  },
  {
    name: 'João Ferreira',
    nickname: 'Jota',
    primaryPosition: 'MIDFIELDER',
    secondaryPositions: ['FORWARD'],
    initialRating: 8.5,
  },
  {
    name: 'Lucas Rocha',
    nickname: 'Luquinha',
    primaryPosition: 'MIDFIELDER',
    secondaryPositions: ['WINGER', 'DEFENDER'],
    initialRating: 6,
  },
  {
    name: 'Marcelo Dias',
    nickname: 'Marcelinho',
    primaryPosition: 'FORWARD',
    secondaryPositions: ['WINGER'],
    initialRating: 7.5,
  },
  {
    name: 'Nicolas Teixeira',
    nickname: 'Nico',
    primaryPosition: 'FORWARD',
    secondaryPositions: ['MIDFIELDER'],
    initialRating: 6.5,
  },
  {
    name: 'Otávio Barros',
    nickname: 'Tavinho',
    primaryPosition: 'FORWARD',
    secondaryPositions: [],
    initialRating: 5.5,
  },
  // Goleiros: 2 contratados e 1 mensalista que joga no gol
  {
    name: 'Paulo Santos',
    nickname: 'Paredão',
    primaryPosition: 'GOALKEEPER',
    secondaryPositions: [],
    initialRating: 7.5,
    isHiredGoalkeeper: true,
  },
  {
    name: 'Ricardo Nunes',
    nickname: 'Muralha',
    primaryPosition: 'GOALKEEPER',
    secondaryPositions: [],
    initialRating: 7,
    isHiredGoalkeeper: true,
  },
  {
    name: 'Sérgio Melo',
    nickname: 'Serginho',
    primaryPosition: 'GOALKEEPER',
    secondaryPositions: [],
    initialRating: 6,
  },
];

function emailFor(nickname: string): string {
  const slug = nickname.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return `${slug}@example.com`;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const group = await prisma.group.upsert({
      where: { slug: 'pelada-de-quinta' },
      update: {},
      create: { name: 'Pelada de Quinta', slug: 'pelada-de-quinta', inviteCode: 'convite-dev' },
    });

    for (const member of MEMBERS) {
      const email = emailFor(member.nickname);
      const user = await prisma.user.upsert({
        where: { email },
        update: { name: member.name },
        create: { name: member.name, email, googleId: `seed-${email}` },
      });

      const data = {
        role: member.role ?? 'PLAYER',
        nickname: member.nickname,
        primaryPosition: member.primaryPosition,
        secondaryPositions: member.secondaryPositions,
        initialRating: member.initialRating,
        isHiredGoalkeeper: member.isHiredGoalkeeper ?? false,
      };
      await prisma.membership.upsert({
        where: { userId_groupId: { userId: user.id, groupId: group.id } },
        update: data,
        create: { ...data, userId: user.id, groupId: group.id },
      });
    }

    console.log(`Seed ok: grupo "${group.name}" com ${MEMBERS.length} membros.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
