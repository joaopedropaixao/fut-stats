import type { Lineup, SaveLineupInput } from '@fut-stats/shared';

export type TeamKey = 'WHITE' | 'BLACK';
export const TEAM_KEYS: readonly TeamKey[] = ['WHITE', 'BLACK'];

type Position = SaveLineupInput['WHITE']['starters'][number]['position'];

/** As 7 vagas do 1-2-3-1, na ordem do campo (a posição de cada vaga é o desenho da formação). */
export const SLOTS = [
  { key: 'GK', position: 'GOALKEEPER' },
  { key: 'DEF1', position: 'DEFENDER' },
  { key: 'DEF2', position: 'DEFENDER' },
  { key: 'WING1', position: 'WINGER' },
  { key: 'WING2', position: 'WINGER' },
  { key: 'MID', position: 'MIDFIELDER' },
  { key: 'FWD', position: 'FORWARD' },
] as const satisfies readonly { key: string; position: Position }[];

export type SlotKey = (typeof SLOTS)[number]['key'];

/** Quantas caixas de reserva o campo mostra por time. Quem confere o limite é o domain (a API recusa). */
export const RESERVE_BOXES = 2;

/** Rascunho de um time na tela: id do jogador em cada vaga e a fila de reservas. */
export interface TeamDraft {
  slots: Record<SlotKey, string | null>;
  reserves: string[];
}

export type Draft = Record<TeamKey, TeamDraft>;

/** Onde um jogador está no rascunho; `null` = no banco. */
export type Spot =
  { team: TeamKey; kind: 'slot'; key: SlotKey } | { team: TeamKey; kind: 'reserve' };

function emptyTeam(): TeamDraft {
  return {
    slots: { GK: null, DEF1: null, DEF2: null, WING1: null, WING2: null, MID: null, FWD: null },
    reserves: [],
  };
}

export function emptyDraft(): Draft {
  return { WHITE: emptyTeam(), BLACK: emptyTeam() };
}

/** Rascunho salvo na API → rascunho da tela: cada titular na primeira vaga livre da posição dele. */
export function draftFromLineup(lineup: Lineup): Draft {
  const draft = emptyDraft();
  for (const team of TEAM_KEYS) {
    for (const player of lineup.teams[team].starters) {
      const slot = SLOTS.find(
        (s) => s.position === player.position && draft[team].slots[s.key] === null,
      );
      if (slot) draft[team].slots[slot.key] = player.membershipId;
    }
    draft[team].reserves = lineup.teams[team].reserves.map((p) => p.membershipId);
  }
  return draft;
}

/** Todo mundo que aparece na tela (sem time, titulares e reservas), por id. */
export function membersOf(lineup: Lineup): Map<string, Lineup['unassigned'][number]> {
  const map = new Map<string, Lineup['unassigned'][number]>();
  for (const m of lineup.unassigned) map.set(m.membershipId, m);
  for (const team of TEAM_KEYS) {
    for (const p of [...lineup.teams[team].starters, ...lineup.teams[team].reserves]) {
      map.set(p.membershipId, p);
    }
  }
  return map;
}

/** Rascunho da tela → corpo do PUT. */
export function toSaveInput(draft: Draft): SaveLineupInput {
  const team = (key: TeamKey) => ({
    starters: SLOTS.flatMap(({ key: slot, position }) => {
      const membershipId = draft[key].slots[slot];
      return membershipId ? [{ membershipId, position }] : [];
    }),
    reserves: [...draft[key].reserves],
  });
  return { WHITE: team('WHITE'), BLACK: team('BLACK') };
}

export function locate(draft: Draft, id: string): Spot | null {
  for (const team of TEAM_KEYS) {
    const key = SLOTS.find((s) => draft[team].slots[s.key] === id)?.key;
    if (key) return { team, kind: 'slot', key };
    if (draft[team].reserves.includes(id)) return { team, kind: 'reserve' };
  }
  return null;
}

function clone(draft: Draft): Draft {
  return {
    WHITE: { slots: { ...draft.WHITE.slots }, reserves: [...draft.WHITE.reserves] },
    BLACK: { slots: { ...draft.BLACK.slots }, reserves: [...draft.BLACK.reserves] },
  };
}

function clear(draft: Draft, id: string): void {
  const spot = locate(draft, id);
  if (!spot) return;
  if (spot.kind === 'slot') draft[spot.team].slots[spot.key] = null;
  else draft[spot.team].reserves = draft[spot.team].reserves.filter((r) => r !== id);
}

/** Manda o jogador de volta para o banco. */
export function sendToBench(draft: Draft, id: string): Draft {
  const next = clone(draft);
  clear(next, id);
  return next;
}

/**
 * Põe o jogador na vaga. Se a vaga tinha dono e o jogador vinha de outra vaga/reserva, trocam de lugar;
 * se vinha do banco, o dono vai para o banco.
 */
export function placeInSlot(draft: Draft, team: TeamKey, slot: SlotKey, id: string): Draft {
  const next = clone(draft);
  const origin = locate(next, id);
  const occupant = next[team].slots[slot];
  if (occupant === id) return draft;

  clear(next, id);
  next[team].slots[slot] = id;
  if (occupant && origin) {
    if (origin.kind === 'slot') next[origin.team].slots[origin.key] = occupant;
    else next[origin.team].reserves.push(occupant);
  }
  return next;
}

/**
 * Põe o jogador nas reservas do time. Tocando numa caixa ocupada (`index`), troca com o dono: o dono vai para
 * onde o jogador estava (vaga, reserva ou banco). Caixa livre ou sem `index`: entra no fim da fila; sem caixa
 * livre, o rascunho fica como está.
 */
export function placeInReserve(draft: Draft, team: TeamKey, id: string, index?: number): Draft {
  const occupant = index === undefined ? undefined : draft[team].reserves[index];
  if (occupant === id) return draft;
  if (occupant !== undefined) {
    const next = clone(draft);
    const origin = locate(next, id);
    if (origin?.kind === 'reserve' && origin.team === team) {
      next[team].reserves = next[team].reserves.map((r) =>
        r === occupant ? id : r === id ? occupant : r,
      );
      return next;
    }
    clear(next, id);
    next[team].reserves = next[team].reserves.map((r) => (r === occupant ? id : r));
    if (origin?.kind === 'slot') next[origin.team].slots[origin.key] = occupant;
    else if (origin) next[origin.team].reserves.push(occupant);
    return next;
  }
  const already = draft[team].reserves.includes(id);
  if (!already && draft[team].reserves.length >= RESERVE_BOXES) return draft;
  const next = clone(draft);
  clear(next, id);
  next[team].reserves.push(id);
  return next;
}

export function countStarters(draft: Draft, team: TeamKey): number {
  return SLOTS.filter((s) => draft[team].slots[s.key] !== null).length;
}
