-- Troca do conjunto de reações do Feed (decisão do dono). Renomeia os valores do enum, então as reações já dadas
-- seguem valendo: FIRE vira CATFISH, LAUGH vira OSS, CLAP vira WHISTLE e FLOP vira POPCORN. BALL fica.
ALTER TYPE "PostReactionType" RENAME VALUE 'FIRE' TO 'CATFISH';
ALTER TYPE "PostReactionType" RENAME VALUE 'LAUGH' TO 'OSS';
ALTER TYPE "PostReactionType" RENAME VALUE 'CLAP' TO 'WHISTLE';
ALTER TYPE "PostReactionType" RENAME VALUE 'FLOP' TO 'POPCORN';
