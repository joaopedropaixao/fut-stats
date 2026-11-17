-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('TEAMS_PUBLISHED', 'TEAMS_UNPUBLISHED', 'MATCH_STARTED', 'SCORE_SET', 'MATCH_FINISHED', 'VOTING_OPENED', 'VOTING_CLOSED', 'EVENT_LAUNCHED', 'EVENT_REMOVED', 'POST_CREATED', 'POST_EDITED', 'POST_DELETED', 'COMMENT_CREATED', 'COMMENT_DELETED', 'REACTION_SET', 'REACTION_REMOVED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "roundId" TEXT,
    "postId" TEXT,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_roundId_createdAt_idx" ON "AuditLog"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_groupId_createdAt_idx" ON "AuditLog"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_postId_createdAt_idx" ON "AuditLog"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
