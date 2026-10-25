// Dados fictícios do seed de desenvolvimento: o grupo, os membros e o roteiro das rodadas.
// A lógica que transforma isto em linhas do banco (validando tudo pelo domínio) fica em `seed.ts`.
import type { MatchScore } from '@fut-stats/domain';
import type { Position, Role } from '../generated/prisma/enums';

/** O login de dev e quem já tem banco local dependem do slug e do convite: não mudar. */
export const SEED_GROUP = {
  name: 'Pelada de Quinta',
  slug: 'pelada-de-quinta',
  inviteCode: 'convite-dev',
} as const;

export const SEED_LOCATION = 'Society do Bairro';

/** Semente do sorteio (times, autores dos lances): mesma semente, mesmos dados. */
export const SEED_RANDOM = 20261024;

export interface SeedMember {
  name: string;
  nickname: string;
  role?: Role;
  primaryPosition: Position;
  secondaryPositions: Position[];
  initialRating: number;
  isHiredGoalkeeper?: boolean;
}

export const MEMBERS: readonly SeedMember[] = [
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
    name: 'André Fontes',
    nickname: 'Dedé',
    primaryPosition: 'DEFENDER',
    secondaryPositions: [],
    initialRating: 6,
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
    name: 'Vinícius Prado',
    nickname: 'Vini',
    primaryPosition: 'WINGER',
    secondaryPositions: ['FORWARD'],
    initialRating: 7,
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
    name: 'Thiago Rezende',
    nickname: 'Thiaguinho',
    primaryPosition: 'MIDFIELDER',
    secondaryPositions: ['DEFENDER'],
    initialRating: 6.5,
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
  {
    name: 'Leandro Carvalho',
    nickname: 'Leleco',
    primaryPosition: 'FORWARD',
    secondaryPositions: ['WINGER'],
    initialRating: 6,
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

/**
 * Presença de uma rodada, por apelido. Quem não está em `declined` nem em `noAnswer` confirmou
 * (e, numa rodada com times, jogou). Os goleiros entram nas mesmas listas.
 */
export interface AttendancePlan {
  declined: readonly string[];
  noAnswer: readonly string[];
}

/** Roteiro de uma rodada passada (encerrada). */
export interface PastRoundPlan extends AttendancePlan {
  score: MatchScore;
  /** Gols contra a favor de cada time (feitos por quem é do outro). Padrão: nenhum. */
  ownGoalsFor?: Partial<MatchScore>;
  /** Um jogador do time que mais fez gols marca exatamente 3. */
  hatTrick?: boolean;
}

/**
 * As 8 rodadas passadas, da mais antiga (8 semanas atrás) para a mais recente (semana passada).
 * São 18 de linha e 3 goleiros: confirmados de linha entre 12 e 16 = de 0 a 2 reservas por time.
 * O Igão falta as últimas 4 (e não responde a atual).
 */
export const PAST_ROUNDS: readonly PastRoundPlan[] = [
  // 16 de linha: 2 reservas em cada time
  {
    declined: ['Serginho', 'Leleco'],
    noAnswer: ['Dedé'],
    score: { WHITE: 3, BLACK: 2 },
  },
  // Empate; 15 de linha: 2 x 1 reservas
  {
    declined: ['Serginho', 'Dudu', 'Thiaguinho'],
    noAnswer: ['Vini'],
    score: { WHITE: 2, BLACK: 2 },
  },
  // Placar curto; 12 de linha: sem reservas
  {
    declined: ['Serginho', 'Felipinho', 'Nico', 'Luquinha'],
    noAnswer: ['Tavinho', 'Dedé', 'Leleco'],
    score: { WHITE: 0, BLACK: 1 },
  },
  // Goleada com hat-trick; 14 de linha: 1 reserva em cada time
  {
    declined: ['Serginho', 'Diegão', 'Rique', 'Thiaguinho'],
    noAnswer: ['Bruninho'],
    score: { WHITE: 7, BLACK: 1 },
    hatTrick: true,
  },
  // Com gol contra; 13 de linha: 1 x 0 reservas. Igão começa a faltar.
  {
    declined: ['Serginho', 'Igão', 'Guga', 'Marcelinho'],
    noAnswer: ['Jota', 'Leleco'],
    score: { WHITE: 4, BLACK: 3 },
    ownGoalsFor: { BLACK: 1 },
  },
  // 0 x 0; Muralha não vem e o Serginho vai pro gol; 12 de linha: sem reservas
  {
    declined: ['Muralha', 'Igão', 'Vini', 'Nico'],
    noAnswer: ['Dudu', 'Carlão', 'Leleco'],
    score: { WHITE: 0, BLACK: 0 },
  },
  // Com gol contra; 16 de linha: 2 reservas em cada time
  {
    declined: ['Serginho', 'Igão'],
    noAnswer: ['Tavinho'],
    score: { WHITE: 3, BLACK: 1 },
    ownGoalsFor: { WHITE: 1 },
  },
  // Semana passada: jogo aberto, com gol contra; 14 de linha
  {
    declined: ['Igão', 'Luquinha', 'Dedé'],
    noAnswer: ['Serginho', 'Thiaguinho'],
    score: { WHITE: 4, BLACK: 5 },
    ownGoalsFor: { WHITE: 1 },
  },
];

/** Presença da rodada atual: 16 confirmados (2 goleiros e 14 de linha), 3 recusas e 2 sem resposta. */
export const CURRENT_ROUND: AttendancePlan = {
  declined: ['Serginho', 'Dudu', 'Leleco'],
  noAnswer: ['Igão', 'Thiaguinho'],
};

/** Lances já lançados no cenário `em-jogo` (o placar ainda não foi lançado). */
export const IN_PROGRESS_GOALS: MatchScore = { WHITE: 2, BLACK: 1 };

/** Cenário `resenha`: placar final já lançado e, dos lances, só parte (faltam gols e assistências). */
export const RESENHA_SCORE: MatchScore = { WHITE: 3, BLACK: 2 };

/** Gols lançados na `resenha` (um deles é gol contra do Preto, que conta para o Branco). */
export const RESENHA_GOALS: MatchScore = { WHITE: 2, BLACK: 1 };

/** Gols contra entre os lançados da `resenha`, por time que ganhou o gol. */
export const RESENHA_OWN_GOALS_FOR: Partial<Record<'WHITE' | 'BLACK', number>> = { WHITE: 1 };
