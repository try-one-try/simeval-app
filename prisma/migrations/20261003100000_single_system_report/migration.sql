-- 保留旧报告，只把每个任务最新的模板报告接为唯一当前报告。
BEGIN;
ALTER TABLE "AIReport" ADD COLUMN "currentForRunId" VARCHAR(64);
ALTER TABLE "AIReport" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "AIReport_currentForRunId_key" ON "AIReport"("currentForRunId");
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_current_run_matches" CHECK ("currentForRunId" IS NULL OR "currentForRunId" = "runId");

-- 当前记录接管前保存原内容，保留其曾经的聊天来源和确认信息。
WITH latest AS (
  SELECT DISTINCT ON ("runId") * FROM "AIReport"
  WHERE "provider" = 'agent-evidence-v1' AND "output"->>'version' = '1'
  ORDER BY "runId", "createdAt" DESC, "id" DESC
)
INSERT INTO "AuditLog" ("id", "actorId", "action", "entityType", "entityId", "requestId", "metadata", "createdAt")
SELECT 'report-adopt:' || "id", "requestedById", 'REPORT_ADOPTED', 'AIReport', "id", 'migration-single-report',
       jsonb_build_object('previousOutput', "output", 'previousInputSnapshot', "inputSnapshot", 'previousModel', "model", 'previousConfirmedById', "confirmedById", 'previousConfirmedAt', "confirmedAt"), CURRENT_TIMESTAMP
FROM latest;

WITH latest AS (
  SELECT DISTINCT ON ("runId") "id"
  FROM "AIReport"
  WHERE "provider" = 'agent-evidence-v1' AND "output"->>'version' = '1'
  ORDER BY "runId", "createdAt" DESC, "id" DESC
)
UPDATE "AIReport" AS report
SET "currentForRunId" = report."runId", "provider" = 'system-evidence-v1',
    "model" = NULL, "idempotencyKey" = NULL, "output" = report."output" - 'sourceTurnId'
FROM latest WHERE report."id" = latest."id";
COMMIT;
