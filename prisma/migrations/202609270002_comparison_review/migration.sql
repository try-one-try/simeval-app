-- 追加复核字段，保留历史内容、关联与状态；旧确认的来源不足时允许为空。
ALTER TABLE `AnomalySample`
  ADD COLUMN `draftConclusion` TEXT NULL,
  ADD COLUMN `draftUpdatedById` VARCHAR(64) NULL,
  ADD COLUMN `draftUpdatedAt` DATETIME(3) NULL,
  ADD COLUMN `confirmedById` VARCHAR(64) NULL,
  ADD COLUMN `confirmedAt` DATETIME(3) NULL,
  ADD COLUMN `confirmedRevision` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `ReviewRecord`
  ADD COLUMN `mode` VARCHAR(16) NULL,
  ADD COLUMN `fromVersion` INTEGER NULL,
  ADD COLUMN `toVersion` INTEGER NULL,
  ADD COLUMN `confirmedRevision` INTEGER NULL;
ALTER TABLE `AIReport` ADD COLUMN `isStale` BOOLEAN NOT NULL DEFAULT false, ADD COLUMN `staleAt` DATETIME(3) NULL;
UPDATE `AnomalySample` s SET s.`confirmedRevision`=1, s.`confirmedAt`=s.`resolvedAt`,
  s.`confirmedById`=(SELECT r.`reviewerId` FROM `ReviewRecord` r JOIN `User` u ON u.`id`=r.`reviewerId` WHERE r.`anomalySampleId`=s.`id` AND r.`toStatus`='RESOLVED' AND u.`role`='REVIEWER' ORDER BY r.`createdAt` DESC,r.`id` DESC LIMIT 1)
  WHERE s.`status`='RESOLVED' AND s.`conclusion` IS NOT NULL;
CREATE INDEX `AnomalySample_draftUpdatedById_idx` ON `AnomalySample`(`draftUpdatedById`);
CREATE INDEX `AnomalySample_confirmedById_idx` ON `AnomalySample`(`confirmedById`);
ALTER TABLE `AnomalySample` ADD CONSTRAINT `AnomalySample_draftUpdatedById_fkey` FOREIGN KEY (`draftUpdatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AnomalySample` ADD CONSTRAINT `AnomalySample_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
