-- 007_exam_results.sql
-- Student exam-taking: per-exam score-release setting + richer submission scoring.

-- Whether students see their score right after submitting (1) or only after the
-- teacher releases results (0, then flip results_released to 1 to reveal).
ALTER TABLE `exams`
  ADD COLUMN `show_score`       TINYINT(1) NOT NULL DEFAULT 0 AFTER `shuffle_opts`,
  ADD COLUMN `results_released` TINYINT(1) NOT NULL DEFAULT 0 AFTER `show_score`;

-- Auto-scoring bookkeeping on each submission.
--   score        = objective marks earned (already existed)
--   max_score    = total marks available on the exam
--   needs_review = 1 when the exam has subjective questions still to be graded
ALTER TABLE `exam_submissions`
  ADD COLUMN `max_score`    DECIMAL(6,2) NULL AFTER `score`,
  ADD COLUMN `needs_review` TINYINT(1) NOT NULL DEFAULT 0 AFTER `max_score`;
