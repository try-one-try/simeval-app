CREATE TABLE "ReplayAnnotationSet" (
  "episodeId" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "annotations" JSONB NOT NULL,
  "updatedById" VARCHAR(64) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplayAnnotationSet_pkey" PRIMARY KEY ("episodeId"),
  CONSTRAINT "ReplayAnnotationSet_version_check" CHECK ("version" >= 1)
);
ALTER TABLE "ReplayAnnotationSet" ADD CONSTRAINT "ReplayAnnotationSet_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
