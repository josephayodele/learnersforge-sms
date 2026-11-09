-- 011_transport_fee.sql
-- Track transport-fee payment per student assignment, so the Transport → Fees
-- tab can show amount paid vs. the route's term fee and the outstanding balance.
-- Safe to run once on an existing database (no data loss).
ALTER TABLE `student_transport`
  ADD COLUMN `fee_paid` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `pickup_point`;
