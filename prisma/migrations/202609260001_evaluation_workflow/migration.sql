-- 只增加兼容字段，保留已有任务、结果与演示故事。
ALTER TABLE `EvaluationRun`
  ADD COLUMN `name` VARCHAR(120) NULL,
  ADD COLUMN `requestFingerprint` VARCHAR(64) NULL,
  ADD COLUMN `mockFailure` BOOLEAN NOT NULL DEFAULT false;
