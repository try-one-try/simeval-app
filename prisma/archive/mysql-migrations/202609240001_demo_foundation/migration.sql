-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(64) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `role` ENUM('ENGINEER', 'REVIEWER', 'ADMIN') NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Project_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelVersion` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `version` VARCHAR(64) NOT NULL,
    `artifactRef` VARCHAR(255) NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `ModelVersion_projectId_name_version_key`(`projectId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DatasetVersion` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `version` VARCHAR(64) NOT NULL,
    `sampleCount` INTEGER NOT NULL,
    `qualityStatus` ENUM('PASSED', 'WARNING', 'FAILED') NOT NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `DatasetVersion_projectId_name_version_key`(`projectId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataQualityCheck` (
    `id` VARCHAR(64) NOT NULL,
    `datasetVersionId` VARCHAR(64) NOT NULL,
    `checkKey` VARCHAR(120) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('PASSED', 'WARNING', 'FAILED') NOT NULL,
    `affectedCount` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `details` JSON NULL,

    INDEX `DataQualityCheck_datasetVersionId_status_idx`(`datasetVersionId`, `status`),
    UNIQUE INDEX `DataQualityCheck_datasetVersionId_checkKey_key`(`datasetVersionId`, `checkKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Benchmark` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `version` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `Benchmark_projectId_name_version_key`(`projectId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetricDefinition` (
    `id` VARCHAR(64) NOT NULL,
    `benchmarkId` VARCHAR(64) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `direction` ENUM('HIGHER_IS_BETTER', 'LOWER_IS_BETTER') NOT NULL,

    UNIQUE INDEX `MetricDefinition_benchmarkId_key_key`(`benchmarkId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvaluationRun` (
    `id` VARCHAR(64) NOT NULL,
    `projectId` VARCHAR(64) NOT NULL,
    `modelVersionId` VARCHAR(64) NOT NULL,
    `datasetVersionId` VARCHAR(64) NOT NULL,
    `benchmarkId` VARCHAR(64) NOT NULL,
    `baselineRunId` VARCHAR(64) NULL,
    `retryOfRunId` VARCHAR(64) NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED') NOT NULL,
    `createdById` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(80) NOT NULL,
    `externalJobId` VARCHAR(191) NULL,
    `episodeCount` INTEGER NOT NULL,
    `simulationSeed` INTEGER NOT NULL,
    `isDemoFixture` BOOLEAN NOT NULL DEFAULT false,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `resultsGeneratedAt` DATETIME(3) NULL,
    `errorCode` VARCHAR(120) NULL,
    `errorMessage` TEXT NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvaluationRun_projectId_status_createdAt_idx`(`projectId`, `status`, `createdAt`),
    UNIQUE INDEX `EvaluationRun_createdById_idempotencyKey_key`(`createdById`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetricResult` (
    `id` VARCHAR(64) NOT NULL,
    `runId` VARCHAR(64) NOT NULL,
    `metricDefinitionId` VARCHAR(64) NOT NULL,
    `scenarioKey` VARCHAR(120) NOT NULL,
    `value` DECIMAL(12, 4) NOT NULL,
    `sampleCount` INTEGER NOT NULL,

    UNIQUE INDEX `MetricResult_runId_metricDefinitionId_scenarioKey_key`(`runId`, `metricDefinitionId`, `scenarioKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnomalySample` (
    `id` VARCHAR(64) NOT NULL,
    `runId` VARCHAR(64) NOT NULL,
    `sampleNumber` VARCHAR(80) NOT NULL,
    `scenarioKey` VARCHAR(120) NOT NULL,
    `anomalyType` VARCHAR(120) NOT NULL,
    `metricKey` VARCHAR(120) NOT NULL,
    `reviewCategory` ENUM('MODEL_ISSUE', 'DATA_ISSUE', 'INVALID_SAMPLE', 'FALSE_POSITIVE', 'UNKNOWN') NULL,
    `status` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED', 'REOPENED') NOT NULL,
    `assigneeId` VARCHAR(64) NULL,
    `mediaPath` VARCHAR(255) NULL,
    `logExcerpt` TEXT NULL,
    `metadata` JSON NULL,
    `conclusion` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `resolvedAt` DATETIME(3) NULL,

    INDEX `AnomalySample_runId_metricKey_scenarioKey_status_idx`(`runId`, `metricKey`, `scenarioKey`, `status`),
    INDEX `AnomalySample_assigneeId_status_idx`(`assigneeId`, `status`),
    UNIQUE INDEX `AnomalySample_runId_sampleNumber_key`(`runId`, `sampleNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewRecord` (
    `id` VARCHAR(64) NOT NULL,
    `anomalySampleId` VARCHAR(64) NOT NULL,
    `reviewerId` VARCHAR(64) NOT NULL,
    `fromStatus` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED', 'REOPENED') NOT NULL,
    `toStatus` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED', 'REOPENED') NOT NULL,
    `category` ENUM('MODEL_ISSUE', 'DATA_ISSUE', 'INVALID_SAMPLE', 'FALSE_POSITIVE', 'UNKNOWN') NULL,
    `conclusion` TEXT NULL,
    `reopenReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReviewRecord_anomalySampleId_createdAt_idx`(`anomalySampleId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackfillTask` (
    `id` VARCHAR(64) NOT NULL,
    `anomalySampleId` VARCHAR(64) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('OPEN', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL,
    `assigneeId` VARCHAR(64) NULL,
    `resolutionNote` TEXT NULL,
    `createdById` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BackfillTask_status_assigneeId_idx`(`status`, `assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIReport` (
    `id` VARCHAR(64) NOT NULL,
    `runId` VARCHAR(64) NOT NULL,
    `baselineRunId` VARCHAR(64) NULL,
    `status` ENUM('READY', 'CONFIRMED', 'FAILED') NOT NULL,
    `inputSnapshot` JSON NOT NULL,
    `output` JSON NOT NULL,
    `provider` VARCHAR(80) NOT NULL,
    `model` VARCHAR(80) NULL,
    `requestedById` VARCHAR(64) NOT NULL,
    `confirmedById` VARCHAR(64) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIReport_requestedById_idempotencyKey_key`(`requestedById`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(64) NOT NULL,
    `actorId` VARCHAR(64) NOT NULL,
    `action` VARCHAR(120) NOT NULL,
    `entityType` VARCHAR(120) NOT NULL,
    `entityId` VARCHAR(64) NOT NULL,
    `requestId` VARCHAR(128) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ModelVersion` ADD CONSTRAINT `ModelVersion_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DatasetVersion` ADD CONSTRAINT `DatasetVersion_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataQualityCheck` ADD CONSTRAINT `DataQualityCheck_datasetVersionId_fkey` FOREIGN KEY (`datasetVersionId`) REFERENCES `DatasetVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Benchmark` ADD CONSTRAINT `Benchmark_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricDefinition` ADD CONSTRAINT `MetricDefinition_benchmarkId_fkey` FOREIGN KEY (`benchmarkId`) REFERENCES `Benchmark`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_modelVersionId_fkey` FOREIGN KEY (`modelVersionId`) REFERENCES `ModelVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_datasetVersionId_fkey` FOREIGN KEY (`datasetVersionId`) REFERENCES `DatasetVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_benchmarkId_fkey` FOREIGN KEY (`benchmarkId`) REFERENCES `Benchmark`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_baselineRunId_fkey` FOREIGN KEY (`baselineRunId`) REFERENCES `EvaluationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvaluationRun` ADD CONSTRAINT `EvaluationRun_retryOfRunId_fkey` FOREIGN KEY (`retryOfRunId`) REFERENCES `EvaluationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricResult` ADD CONSTRAINT `MetricResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `EvaluationRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricResult` ADD CONSTRAINT `MetricResult_metricDefinitionId_fkey` FOREIGN KEY (`metricDefinitionId`) REFERENCES `MetricDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnomalySample` ADD CONSTRAINT `AnomalySample_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `EvaluationRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnomalySample` ADD CONSTRAINT `AnomalySample_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewRecord` ADD CONSTRAINT `ReviewRecord_anomalySampleId_fkey` FOREIGN KEY (`anomalySampleId`) REFERENCES `AnomalySample`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewRecord` ADD CONSTRAINT `ReviewRecord_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BackfillTask` ADD CONSTRAINT `BackfillTask_anomalySampleId_fkey` FOREIGN KEY (`anomalySampleId`) REFERENCES `AnomalySample`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BackfillTask` ADD CONSTRAINT `BackfillTask_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BackfillTask` ADD CONSTRAINT `BackfillTask_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIReport` ADD CONSTRAINT `AIReport_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `EvaluationRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIReport` ADD CONSTRAINT `AIReport_baselineRunId_fkey` FOREIGN KEY (`baselineRunId`) REFERENCES `EvaluationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIReport` ADD CONSTRAINT `AIReport_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIReport` ADD CONSTRAINT `AIReport_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
