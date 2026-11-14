-- Resenha pós-jogo: etapa entre o jogo e a votação (igual ao domain).
ALTER TYPE "RoundStatus" ADD VALUE 'POST_MATCH' BEFORE 'VOTING';

-- Quando a rodada entrou em votação.
ALTER TABLE "Round" ADD COLUMN "votingOpenedAt" TIMESTAMP(3);
