/**
 * Limites de texto da resenha e do comentário, só para o contador da tela. A regra é do domínio
 * (`POST_TITLE_MAX_LENGTH`, `POST_BODY_MAX_LENGTH`, `COMMENT_MAX_LENGTH`) e quem barra é o schema do shared; o shared
 * ainda não reexporta estes três números (furo no contrato, reportado ao TPL). Quando reexportar, troque pelas
 * constantes de lá e apague este arquivo.
 */
export const POST_TITLE_MAX = 60;
export const POST_BODY_MAX = 1000;
export const COMMENT_MAX = 280;
