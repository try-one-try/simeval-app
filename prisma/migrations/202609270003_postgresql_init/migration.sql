-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ENGINEER', 'REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PASSED', 'WARNING', 'FAILED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MetricDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- CreateEnum
CREATE TYPE "ReviewCategory" AS ENUM ('MODEL_ISSUE', 'DATA_ISSUE', 'INVALID_SAMPLE', 'FALSE_POSITIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "BackfillStatus" AS ENUM ('OPEN', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('READY', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(64) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" VARCHAR(64) NOT NULL,
    "projectId" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "artifactRef" VARCHAR(255),
    "metadata" JSONB,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" VARCHAR(64) NOT NULL,
    "projectId" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "qualityStatus" "QualityStatus" NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityCheck" (
    "id" VARCHAR(64) NOT NULL,
    "datasetVersionId" VARCHAR(64) NOT NULL,
    "checkKey" VARCHAR(120) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "status" "QualityStatus" NOT NULL,
    "affectedCount" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "DataQualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" VARCHAR(64) NOT NULL,
    "projectId" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(64) NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" VARCHAR(64) NOT NULL,
    "benchmarkId" VARCHAR(64) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "direction" "MetricDirection" NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationRun" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120),
    "requestFingerprint" VARCHAR(64),
    "mockFailure" BOOLEAN NOT NULL DEFAULT false,
    "targetSuccessRate" DECIMAL(5,4),
    "configurationSnapshot" JSONB,
    "deletedAt" TIMESTAMP(3),
    "deletedById" VARCHAR(64),
    "projectId" VARCHAR(64) NOT NULL,
    "modelVersionId" VARCHAR(64) NOT NULL,
    "datasetVersionId" VARCHAR(64) NOT NULL,
    "benchmarkId" VARCHAR(64) NOT NULL,
    "baselineRunId" VARCHAR(64),
    "retryOfRunId" VARCHAR(64),
    "status" "RunStatus" NOT NULL,
    "createdById" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "externalJobId" VARCHAR(191),
    "episodeCount" INTEGER NOT NULL,
    "simulationSeed" INTEGER NOT NULL,
    "isDemoFixture" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "resultsGeneratedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(120),
    "errorMessage" TEXT,
    "idempotencyKey" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricResult" (
    "id" VARCHAR(64) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "metricDefinitionId" VARCHAR(64) NOT NULL,
    "scenarioKey" VARCHAR(120) NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "sampleCount" INTEGER NOT NULL,

    CONSTRAINT "MetricResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalySample" (
    "id" VARCHAR(64) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "sampleNumber" VARCHAR(80) NOT NULL,
    "scenarioKey" VARCHAR(120) NOT NULL,
    "anomalyType" VARCHAR(120) NOT NULL,
    "metricKey" VARCHAR(120) NOT NULL,
    "reviewCategory" "ReviewCategory",
    "status" "SampleStatus" NOT NULL,
    "assigneeId" VARCHAR(64),
    "mediaPath" VARCHAR(255),
    "logExcerpt" TEXT,
    "metadata" JSONB,
    "draftConclusion" TEXT,
    "draftUpdatedById" VARCHAR(64),
    "draftUpdatedAt" TIMESTAMP(3),
    "confirmedById" VARCHAR(64),
    "confirmedAt" TIMESTAMP(3),
    "confirmedRevision" INTEGER NOT NULL DEFAULT 0,
    "conclusion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AnomalySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRecord" (
    "id" VARCHAR(64) NOT NULL,
    "anomalySampleId" VARCHAR(64) NOT NULL,
    "reviewerId" VARCHAR(64) NOT NULL,
    "fromStatus" "SampleStatus" NOT NULL,
    "toStatus" "SampleStatus" NOT NULL,
    "category" "ReviewCategory",
    "conclusion" TEXT,
    "reopenReason" TEXT,
    "mode" VARCHAR(16),
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "confirmedRevision" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillTask" (
    "id" VARCHAR(64) NOT NULL,
    "anomalySampleId" VARCHAR(64) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BackfillStatus" NOT NULL,
    "assigneeId" VARCHAR(64),
    "resolutionNote" TEXT,
    "createdById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReport" (
    "id" VARCHAR(64) NOT NULL,
    "runId" VARCHAR(64) NOT NULL,
    "baselineRunId" VARCHAR(64),
    "status" "ReportStatus" NOT NULL,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "staleAt" TIMESTAMP(3),
    "inputSnapshot" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(80),
    "requestedById" VARCHAR(64) NOT NULL,
    "confirmedById" VARCHAR(64),
    "confirmedAt" TIMESTAMP(3),
    "idempotencyKey" VARCHAR(128),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" VARCHAR(64) NOT NULL,
    "actorId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(120) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "requestId" VARCHAR(128) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_projectId_name_version_key" ON "ModelVersion"("projectId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_projectId_name_version_key" ON "DatasetVersion"("projectId", "name", "version");

-- CreateIndex
CREATE INDEX "DataQualityCheck_datasetVersionId_status_idx" ON "DataQualityCheck"("datasetVersionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DataQualityCheck_datasetVersionId_checkKey_key" ON "DataQualityCheck"("datasetVersionId", "checkKey");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_projectId_name_version_key" ON "Benchmark"("projectId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_benchmarkId_key_key" ON "MetricDefinition"("benchmarkId", "key");

-- CreateIndex
CREATE INDEX "EvaluationRun_projectId_status_createdAt_idx" ON "EvaluationRun"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EvaluationRun_createdById_deletedAt_status_idx" ON "EvaluationRun"("createdById", "deletedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationRun_createdById_idempotencyKey_key" ON "EvaluationRun"("createdById", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MetricResult_runId_metricDefinitionId_scenarioKey_key" ON "MetricResult"("runId", "metricDefinitionId", "scenarioKey");

-- CreateIndex
CREATE INDEX "AnomalySample_runId_metricKey_scenarioKey_status_idx" ON "AnomalySample"("runId", "metricKey", "scenarioKey", "status");

-- CreateIndex
CREATE INDEX "AnomalySample_assigneeId_status_idx" ON "AnomalySample"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "AnomalySample_draftUpdatedById_idx" ON "AnomalySample"("draftUpdatedById");

-- CreateIndex
CREATE INDEX "AnomalySample_confirmedById_idx" ON "AnomalySample"("confirmedById");

-- CreateIndex
CREATE UNIQUE INDEX "AnomalySample_runId_sampleNumber_key" ON "AnomalySample"("runId", "sampleNumber");

-- CreateIndex
CREATE INDEX "ReviewRecord_anomalySampleId_createdAt_idx" ON "ReviewRecord"("anomalySampleId", "createdAt");

-- CreateIndex
CREATE INDEX "BackfillTask_status_assigneeId_idx" ON "BackfillTask"("status", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "AIReport_requestedById_idempotencyKey_key" ON "AIReport"("requestedById", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "EvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_retryOfRunId_fkey" FOREIGN KEY ("retryOfRunId") REFERENCES "EvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricResult" ADD CONSTRAINT "MetricResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricResult" ADD CONSTRAINT "MetricResult_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalySample" ADD CONSTRAINT "AnomalySample_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalySample" ADD CONSTRAINT "AnomalySample_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalySample" ADD CONSTRAINT "AnomalySample_draftUpdatedById_fkey" FOREIGN KEY ("draftUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalySample" ADD CONSTRAINT "AnomalySample_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRecord" ADD CONSTRAINT "ReviewRecord_anomalySampleId_fkey" FOREIGN KEY ("anomalySampleId") REFERENCES "AnomalySample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRecord" ADD CONSTRAINT "ReviewRecord_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillTask" ADD CONSTRAINT "BackfillTask_anomalySampleId_fkey" FOREIGN KEY ("anomalySampleId") REFERENCES "AnomalySample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillTask" ADD CONSTRAINT "BackfillTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillTask" ADD CONSTRAINT "BackfillTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "EvaluationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

