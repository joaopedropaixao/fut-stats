import { cardTier, type CardTier, type ResultPlayer, type RoundResult } from '@fut-stats/shared';

export type PackCardKind = 'craque' | 'flop' | 'mine';

/** Uma carta do pacote: quem é, a nota (sempre existe) e a faixa pela nota (`cardTier`, regra do domain). */
export type PackCard = {
  kind: PackCardKind;
  player: ResultPlayer;
  score: number;
  tier: CardTier;
  /** A carta é de quem está vendo: ganha o selo "VOCÊ" (e, sendo o Craque, o grande momento dobrado). */
  you: boolean;
  /** Posição na rodada pela nota (só a sua carta mostra). */
  rank: number | null;
};

function card(kind: PackCardKind, player: ResultPlayer, myId: string): PackCard | null {
  if (player.score === null) return null;
  return {
    kind,
    player,
    score: player.score,
    tier: cardTier(player.score),
    you: player.membershipId === myId,
    rank: player.rank,
  };
}

/**
 * As cartas do pacote, na ordem do momento: o Craque (os dois, num empate), o Perna de Pau e a sua carta.
 * Quem não jogou fica com duas. Se o Craque (ou o Perna de Pau) é você, a sua carta não repete. Sem Craque (ninguém
 * votou), o pacote não existe: lista vazia.
 */
export function buildDeck(result: RoundResult): PackCard[] {
  const myId = result.me.membershipId;
  const craques = result.mvps.flatMap((p) => card('craque', p, myId) ?? []);
  if (craques.length === 0) return [];
  const flops = result.flops.flatMap((p) => card('flop', p, myId) ?? []);
  const deck = [...craques, ...flops];
  const mine = result.me.played ? result.players.find((p) => p.membershipId === myId) : undefined;
  if (mine && !deck.some((c) => c.you)) {
    const mineCard = card('mine', mine, myId);
    if (mineCard) deck.push(mineCard);
  }
  return deck;
}

/** O pacote existe se há Craque. */
export function hasPack(result: RoundResult): boolean {
  return buildDeck(result).length > 0;
}
