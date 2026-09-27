-- 兼容旧任务的追加迁移；保留指标、复核、报告和基线外键。
ALTER TABLE `EvaluationRun`
  ADD COLUMN `targetSuccessRate` DECIMAL(5,4) NULL,
  ADD COLUMN `configurationSnapshot` JSON NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` VARCHAR(64) NULL;
CREATE INDEX `EvaluationRun_createdById_deletedAt_status_idx` ON `EvaluationRun`(`createdById`, `deletedAt`, `status`);
