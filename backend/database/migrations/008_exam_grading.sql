-- 008_exam_grading.sql
-- Teacher grading of subjective (short/essay/fill) answers.
-- Stores the marks a teacher awards per subjective question: { "question_id": marks }.
-- The submission's `score` is then set to objective auto-score + these, and
-- `needs_review` is cleared.
ALTER TABLE `exam_submissions`
  ADD COLUMN `subjective_scores` JSON NULL AFTER `needs_review`;
