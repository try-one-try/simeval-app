-- CreateTable
CREATE TABLE "AssistantSession" (
    "id" VARCHAR(64) NOT NULL,
    "ownerId" VARCHAR(64) NOT NULL,
    "accessId" VARCHAR(64) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "baselineRunId" VARCHAR(64),
    "title" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantTurn" (
    "id" VARCHAR(64) NOT NULL,
    "sessionId" VARCHAR(64) NOT NULL,
    "requestKey" VARCHAR(128) NOT NULL,
    "question" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "answer" TEXT,
    "messages" JSONB,
    "evidence" JSONB,
    "traces" JSONB,
    "sourceSnapshot" JSONB,
    "errorCode" VARCHAR(80),
    "errorMessage" TEXT,
    "model" VARCHAR(80) NOT NULL,
    "promptVersion" VARCHAR(40) NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "modelCalls" INTEGER NOT NULL DEFAULT 0,
    "reservedMicros" INTEGER NOT NULL,
    "chargedMicros" INTEGER,
    "budgetKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantBudget" (
    "key" VARCHAR(80) NOT NULL,
    "committedMicros" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantBudget_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AssistantSession_accessId_ownerId_updatedAt_idx" ON "AssistantSession"("accessId", "ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantTurn_status_deadlineAt_idx" ON "AssistantTurn"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantTurn_sessionId_requestKey_key" ON "AssistantTurn"("sessionId", "requestKey");

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "EvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantTurn" ADD CONSTRAINT "AssistantTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssistantSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
