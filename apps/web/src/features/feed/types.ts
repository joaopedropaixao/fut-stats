import type { FeedAlert, Post } from '@fut-stats/shared';

/**
 * Tipos que o shared ainda não exporta com nome (`FeedAlertType`, `PostReaction` existem só no domain, que o web não
 * importa): saem dos tipos que o shared já exporta. Furo pequeno no contrato, reportado ao TPL.
 */
export type FeedAlertType = FeedAlert['type'];
export type PostReaction = keyof Post['reactions'];
