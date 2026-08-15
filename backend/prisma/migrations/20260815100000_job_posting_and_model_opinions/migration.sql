-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'STAFF');

UPDATE "jobs" SET "description" = '' WHERE "description" IS NULL;
ALTER TABLE "jobs" ALTER COLUMN "description" SET DEFAULT '';
ALTER TABLE "jobs" ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "jobs"
  ADD COLUMN "location" TEXT,
  ADD COLUMN "workplace" "WorkplaceType",
  ADD COLUMN "employment_type" "EmploymentType",
  ADD COLUMN "seniority" "SeniorityLevel",
  ADD COLUMN "must_haves" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "nice_to_haves" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "min_years" INTEGER,
  ADD COLUMN "education" TEXT,
  ADD COLUMN "salary_min" DOUBLE PRECISION,
  ADD COLUMN "salary_max" DOUBLE PRECISION,
  ADD COLUMN "salary_currency" TEXT,
  ADD COLUMN "closes_at" TIMESTAMP(3),
  ADD COLUMN "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "jobs" SET "posted_at" = "created_at";

UPDATE "jobs"
SET
  "skills" = COALESCE(
    ARRAY(SELECT jsonb_array_elements_text("requirements_json"->'skills')),
    ARRAY[]::TEXT[]
  ),
  "min_years" = CASE
    WHEN jsonb_typeof("requirements_json"->'minYears') = 'number'
      THEN ("requirements_json"->>'minYears')::INTEGER
    ELSE NULL
  END
WHERE "requirements_json" IS NOT NULL;

UPDATE "jobs"
SET "must_haves" = "skills"
WHERE COALESCE(array_length("must_haves", 1), 0) = 0
  AND COALESCE(array_length("skills", 1), 0) > 0;

CREATE INDEX "jobs_posted_at_idx" ON "jobs"("posted_at");

ALTER TABLE "scores" ADD COLUMN "disagreement" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "model_opinions" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fit_score" DOUBLE PRECISION,
    "fit_rationale_json" JSONB,
    "authenticity_signal" "AuthenticitySignal",
    "authenticity_reasoning" TEXT,
    "requirement_checks_json" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_opinions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "model_opinions_application_id_provider_key" ON "model_opinions"("application_id", "provider");

ALTER TABLE "model_opinions" ADD CONSTRAINT "model_opinions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
