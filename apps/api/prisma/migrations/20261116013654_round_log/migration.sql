-- CreateEnum
CREATE TYPE "RoundLogAction" AS ENUM ('TEAMS_PUBLISHED', 'TEAMS_UNPUBLISHED', 'MATCH_STARTED', 'SCORE_SET', 'MATCH_FINISHED', 'VOTING_OPENED', 'VOTING_CLOSED', 'EVENT_LAUNCHED', 'EVENT_REMOVED');

-- CreateTable
CREATE TABLE "RoundLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "RoundLogAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoundLog_roundId_createdAt_idx" ON "RoundLog"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "RoundLog_groupId_createdAt_idx" ON "RoundLog"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoundLog" ADD CONSTRAINT "RoundLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundLog" ADD CONSTRAINT "RoundLog_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundLog" ADD CONSTRAINT "RoundLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
