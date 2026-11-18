-- CreateEnum
CREATE TYPE "VotingEndReason" AS ENUM ('ALL_VOTED', 'DEADLINE_PASSED', 'ADMIN_CLOSED');

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "votingDeadlineHours" SET DEFAULT 24;

-- O prazo passa de 48 para 24 horas. Ninguém mudou o valor (não há tela para isso), então troca nos que existem.
UPDATE "Group" SET "votingDeadlineHours" = 24 WHERE "votingDeadlineHours" = 48;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "votingEndReason" "VotingEndReason";

-- AlterTable
ALTER TABLE "TeamPlayer" ADD COLUMN     "isFlop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMvp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ratingsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roundScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "mvpId" TEXT NOT NULL,
    "flopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_roundId_voterId_key" ON "Vote"("roundId", "voterId");

-- CreateIndex
CREATE INDEX "Rating_targetId_idx" ON "Rating"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_voteId_targetId_key" ON "Rating"("voteId", "targetId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_mvpId_fkey" FOREIGN KEY ("mvpId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_flopId_fkey" FOREIGN KEY ("flopId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
