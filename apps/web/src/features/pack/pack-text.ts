import { TIER_LABELS } from './tier';
import type { PackCard } from './deck';
import { formatRating } from '../../lib/rating-format';

const tierWord = (card: PackCard) => TIER_LABELS[card.tier].toLowerCase();

/** O que o leitor de tela anuncia quando a carta é revelada. */
export function cardAnnouncement(card: PackCard, roundNumber: number): string {
  const score = formatRating(card.score);
  const nickname = card.player.nickname;
  if (card.kind === 'craque') {
    return card.you
      ? `Você é o craque da rodada ${roundNumber}: nota ${score}, ${tierWord(card)}`
      : `Craque da rodada ${roundNumber}: ${nickname}, nota ${score}, ${tierWord(card)}`;
  }
  if (card.kind === 'flop') {
    return card.you
      ? `Perna de pau: você, nota ${score}, ${tierWord(card)}`
      : `Perna de pau: ${nickname}, nota ${score}, ${tierWord(card)}`;
  }
  const rank = card.rank !== null ? `, ${card.rank}º na rodada` : '';
  return `Sua carta: nota ${score}, ${tierWord(card)}${rank}`;
}

/** O texto que acompanha a imagem no Compartilhar: o do Craque ou o da sua carta. */
export function shareText(card: PackCard, roundNumber: number): string {
  const score = formatRating(card.score);
  return card.kind === 'mine'
    ? `Minha nota na rodada ${roundNumber}: ${score} (${tierWord(card)})`
    : `Craque da rodada ${roundNumber}: ${card.player.nickname}, nota ${score}`;
}

/** Nome do arquivo da imagem compartilhada. */
export function shareFileName(card: PackCard, roundNumber: number): string {
  return `fut-stats-rodada-${roundNumber}-${card.kind === 'mine' ? 'minha-carta' : 'craque'}.png`;
}
