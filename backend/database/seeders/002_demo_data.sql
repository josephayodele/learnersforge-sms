-- ============================================================
-- LearnersForge SMS — Demo Seed Data
-- Run AFTER 001_schema.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────────────────────────
-- SCHOOL
-- ────────────────────────────────────────────────────────────
INSERT INTO `schools` (`id`,`name`,`code`,`address`,`phone`,`email`,`motto`,`established`,`term_system`) VALUES
(1,'Greenfield Academy','GFA-001','12 Education Lane, Lekki, Lagos','+234 800 123 4567','admin@greenfield.edu.ng','Excellence in All Things',2002,'term');

-- ────────────────────────────────────────────────────────────
-- ACADEMIC YEAR & TERMS
-- ────────────────────────────────────────────────────────────
INSERT INTO `academic_years` (`id`,`school_id`,`name`,`start_date`,`end_date`,`is_current`) VALUES
(1,1,'2025/2026','2025-09-08','2026-07-25',1);

INSERT INTO `terms` (`id`,`academic_year_id`,`name`,`start_date`,`end_date`,`is_current`) VALUES
(1,1,'1st Term','2025-09-08','2025-12-12',0),
(2,1,'2nd Term','2026-01-06','2026-04-11',1),
(3,1,'3rd Term','2026-04-28','2026-07-25',0);

-- ────────────────────────────────────────────────────────────
-- USERS — Admin & Teachers (password = "password" bcrypt)
-- ────────────────────────────────────────────────────────────
INSERT INTO `users` (`id`,`school_id`,`first_name`,`last_name`,`email`,`phone`,`password`,`role`,`gender`,`date_of_birth`,`is_active`) VALUES
-- Admin
(1,1,'Super','Admin','admin@greenfield.edu.ng','+234 801 000 0001','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','super_admin','male','1975-03-15',1),
-- Teachers
(2,1,'Blessing','Adeyemi','b.adeyemi@greenfield.edu.ng','+234 802 111 1111','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','teacher','female','1985-06-20',1),
(3,1,'Charles','Osei','c.osei@greenfield.edu.ng','+234 803 222 2222','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','teacher','male','1982-11-08',1),
(4,1,'Ngozi','Ike','n.ike@greenfield.edu.ng','+234 804 333 3333','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','teacher','female','1990-02-14',1),
(5,1,'Yusuf','Abdullahi','y.abdullahi@greenfield.edu.ng','+234 805 444 4444','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','teacher','male','1988-07-30',1),
(6,1,'Kemi','Fashola','k.fashola@greenfield.edu.ng','+234 806 555 5555','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','school_admin','female','1979-09-12',1),
(7,1,'Tunde','Okafor','t.okafor@greenfield.edu.ng','+234 807 666 6666','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','accountant','male','1983-04-25',1),
-- Students
(10,1,'Amara','Okonkwo','amara.okonkwo@student.greenfield.edu.ng','+234 810 001 0001','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2010-03-12',1),
(11,1,'Kofi','Mensah','kofi.mensah@student.greenfield.edu.ng','+234 811 002 0002','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','male','2009-09-03',1),
(12,1,'Fatima','Al-Hassan','fatima.alhassan@student.greenfield.edu.ng','+234 812 003 0003','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2011-01-22',1),
(13,1,'David','Nwachukwu','david.nwachukwu@student.greenfield.edu.ng','+234 813 004 0004','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','male','2008-07-30',1),
(14,1,'Chidinma','Eze','chidinma.eze@student.greenfield.edu.ng','+234 814 005 0005','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2010-11-15',1),
(15,1,'Ibrahim','Musa','ibrahim.musa@student.greenfield.edu.ng','+234 815 006 0006','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','male','2009-05-08',1),
(16,1,'Adaeze','Obi','adaeze.obi@student.greenfield.edu.ng','+234 816 007 0007','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2010-08-19',1),
(17,1,'Emeka','Nwosu','emeka.nwosu@student.greenfield.edu.ng','+234 817 008 0008','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','male','2011-02-28',1),
(18,1,'Zainab','Bello','zainab.bello@student.greenfield.edu.ng','+234 818 009 0009','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2009-12-05',1),
(19,1,'Chukwuemeka','Ibe','c.ibe@student.greenfield.edu.ng','+234 819 010 0010','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','male','2008-04-17',1),
(20,1,'Halima','Usman','h.usman@student.greenfield.edu.ng','+234 820 011 0011','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','student','female','2011-06-23',1),
-- Parents
(30,1,'Emmanuel','Okonkwo','e.okonkwo@gmail.com','+234 830 001 0001','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','parent','male','1975-01-10',1),
(31,1,'Kwame','Mensah','k.mensah.parent@gmail.com','+234 831 002 0002','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','parent','male','1972-08-14',1);

-- ────────────────────────────────────────────────────────────
-- STAFF PROFILES
-- ────────────────────────────────────────────────────────────
INSERT INTO `staff` (`id`,`user_id`,`staff_id`,`department`,`designation`,`qualification`,`hire_date`,`salary_grade`,`bank_name`,`account_number`) VALUES
(1,2,'TC001','Sciences','Teacher','B.Sc Mathematics, PGDE','2018-09-01','GL-08','First Bank','3012345678'),
(2,3,'TC002','Languages','Teacher','BA English Language, PGDE','2016-01-10','GL-08','GTBank','0023456789'),
(3,4,'TC003','Sciences','Teacher','B.Sc Biology','2020-04-15','GL-07','Zenith Bank','2034567890'),
(4,5,'TC004','Humanities','Teacher','BA History, M.Ed','2015-09-01','GL-09','UBA','0045678901'),
(5,6,'ADM001','Administration','School Admin','MBA, B.Sc Admin','2012-01-05','GL-12','First Bank','3056789012'),
(6,7,'BUR001','Finance','Bursar','B.Sc Accounting, ACA','2014-06-20','GL-10','GTBank','0067890123');

-- ────────────────────────────────────────────────────────────
-- CLASSES
-- ────────────────────────────────────────────────────────────
INSERT INTO `classes` (`id`,`school_id`,`academic_year_id`,`name`,`level`,`form`,`arm`,`form_teacher_id`,`capacity`) VALUES
(1,1,1,'JSS 1A','JSS','1','A',2,35),
(2,1,1,'JSS 1B','JSS','1','B',3,35),
(3,1,1,'JSS 2A','JSS','2','A',4,35),
(4,1,1,'JSS 2B','JSS','2','B',5,35),
(5,1,1,'JSS 3A','JSS','3','A',2,35),
(6,1,1,'JSS 3B','JSS','3','B',3,35),
(7,1,1,'SSS 1A','SSS','1','A',4,40),
(8,1,1,'SSS 1B','SSS','1','B',5,40),
(9,1,1,'SSS 2A','SSS','2','A',2,40),
(10,1,1,'SSS 2B','SSS','2','B',3,40),
(11,1,1,'SSS 3A','SSS','3','A',4,40),
(12,1,1,'SSS 3B','SSS','3','B',5,40);

-- ────────────────────────────────────────────────────────────
-- SUBJECTS
-- ────────────────────────────────────────────────────────────
INSERT INTO `subjects` (`id`,`school_id`,`name`,`code`,`department`) VALUES
(1,1,'Mathematics',       'MTH','Sciences'),
(2,1,'English Language',  'ENG','Languages'),
(3,1,'Biology',           'BIO','Sciences'),
(4,1,'Physics',           'PHY','Sciences'),
(5,1,'Chemistry',         'CHE','Sciences'),
(6,1,'History',           'HIS','Humanities'),
(7,1,'Geography',         'GEO','Humanities'),
(8,1,'Agricultural Science','AGR','Sciences'),
(9,1,'Civic Education',   'CIV','Humanities'),
(10,1,'Computer Studies', 'CST','Sciences');

-- ────────────────────────────────────────────────────────────
-- CLASS SUBJECTS (assign teachers)
-- ────────────────────────────────────────────────────────────
INSERT INTO `class_subjects` (`class_id`,`subject_id`,`teacher_id`) VALUES
(5,1,2),(5,2,3),(5,3,4),(5,4,2),(5,5,4),(5,6,5),
(6,1,2),(6,2,3),(6,3,4),(6,4,2),(6,5,4),(6,6,5),
(9,1,2),(9,2,3),(9,3,4),(9,4,2),(9,5,4),(9,6,5),
(10,1,2),(10,2,3),(10,3,4),(10,4,2),(10,5,4),(10,6,5);

-- ────────────────────────────────────────────────────────────
-- STUDENTS
-- ────────────────────────────────────────────────────────────
INSERT INTO `students` (`id`,`user_id`,`student_id`,`class_id`,`admission_number`,`admission_date`,`blood_group`,`genotype`,`guardian_name`,`guardian_phone`,`guardian_email`,`guardian_address`,`previous_school`) VALUES
(1,10,'ST001',5,'GFA/2020/001','2020-09-08','O+','AA','Mr. Emmanuel Okonkwo','+234 830 001 0001','e.okonkwo@gmail.com','15 Palm Avenue, Lekki, Lagos','Sunrise Primary School'),
(2,11,'ST002',10,'GFA/2019/002','2019-09-09','B+','AS','Mr. Kwame Mensah','+234 831 002 0002','k.mensah@gmail.com','22 Maple Street, VI, Lagos','Golden Gate Nursery & Primary'),
(3,12,'ST003',1,'GFA/2021/003','2021-09-07','A+','AA','Dr. Aisha Al-Hassan','+234 832 003 0003','a.alhassan@gmail.com','8 Northern Way, Abuja','Al-Noor Primary School'),
(4,13,'ST004',11,'GFA/2018/004','2018-09-10','O-','SS','Chief Nwachukwu David','+234 833 004 0004','nwachukwu@gmail.com','44 Old Town Road, Onitsha','Government Primary School'),
(5,14,'ST005',4,'GFA/2020/005','2020-09-08','AB+','AA','Mrs. Blessing Eze','+234 834 005 0005','b.eze@gmail.com','7 Greenview Estate, Ikeja','Holy Child Primary School'),
(6,15,'ST006',7,'GFA/2019/006','2019-09-09','A+','AC','Alhaji Ibrahim Musa','+234 835 006 0006','i.musa@gmail.com','3 Unity Road, Kano','Government Secondary School'),
(7,16,'ST007',3,'GFA/2021/007','2021-09-07','O+','AA','Mr. Paul Obi','+234 836 007 0007','p.obi@gmail.com','19 New Layout, Awka','Christ the King Primary'),
(8,17,'ST008',2,'GFA/2021/008','2021-09-07','B-','AS','Mrs. Grace Nwosu','+234 837 008 0008','g.nwosu@gmail.com','52 Garden Street, Port Harcourt','Rumuola Primary School'),
(9,18,'ST009',10,'GFA/2019/009','2019-09-09','A+','AA','Malam Bello Zainab','+234 838 009 0009','m.bello@gmail.com','11 Kastina Road, Kano','Kano Central Primary'),
(10,19,'ST010',11,'GFA/2018/010','2018-09-10','O+','AA','Chief Ibe Emmanuel','+234 839 010 0010','c.ibe@gmail.com','27 Creek Road, Aba','Aba Boys High School'),
(11,20,'ST011',1,'GFA/2021/011','2021-09-07','B+','AS','Dr. Ahmad Usman','+234 840 011 0011','a.usman@gmail.com','9 Hospital Road, Sokoto','Sokoto Central Primary');

-- ────────────────────────────────────────────────────────────
-- CA TYPES
-- ────────────────────────────────────────────────────────────
INSERT INTO `ca_types` (`id`,`school_id`,`label`,`max_score`,`is_enabled`,`sort_order`) VALUES
(1,1,'1st C.A.',  10,1,1),
(2,1,'2nd C.A.',  10,1,2),
(3,1,'Assignment',10,1,3),
(4,1,'Exam',      60,1,4);

-- ────────────────────────────────────────────────────────────
-- GRADES (students 1,2,5,9 in SSS 2B/JSS 3A)
-- ────────────────────────────────────────────────────────────
-- Student 1 (Amara — JSS 3A) — strong student
INSERT INTO `grades` (`student_id`,`subject_id`,`term_id`,`ca_type_id`,`score`,`entered_by`) VALUES
(1,1,2,1,8,2),(1,1,2,2,9,2),(1,1,2,3,8,2),(1,1,2,4,48,2),  -- Maths 73
(1,2,2,1,9,3),(1,2,2,2,8,3),(1,2,2,3,9,3),(1,2,2,4,52,3),  -- English 78
(1,3,2,1,7,4),(1,3,2,2,8,4),(1,3,2,3,7,4),(1,3,2,4,44,4),  -- Biology 66
(1,4,2,1,9,2),(1,4,2,2,9,2),(1,4,2,3,8,2),(1,4,2,4,56,2),  -- Physics 82
(1,5,2,1,6,4),(1,5,2,2,7,4),(1,5,2,3,6,4),(1,5,2,4,39,4),  -- Chemistry 58
(1,6,2,1,8,5),(1,6,2,2,8,5),(1,6,2,3,8,5),(1,6,2,4,50,5);  -- History 74

-- Student 2 (Kofi — SSS 2B) — average student
INSERT INTO `grades` (`student_id`,`subject_id`,`term_id`,`ca_type_id`,`score`,`entered_by`) VALUES
(2,1,2,1,6,2),(2,1,2,2,7,2),(2,1,2,3,6,2),(2,1,2,4,38,2),  -- Maths 57
(2,2,2,1,7,3),(2,2,2,2,8,3),(2,2,2,3,7,3),(2,2,2,4,46,3),  -- English 68
(2,3,2,1,6,4),(2,3,2,2,5,4),(2,3,2,3,6,4),(2,3,2,4,36,4),  -- Biology 53
(2,4,2,1,5,2),(2,4,2,2,6,2),(2,4,2,3,5,2),(2,4,2,4,33,2),  -- Physics 49
(2,5,2,1,6,4),(2,5,2,2,6,4),(2,5,2,3,5,4),(2,5,2,4,35,4),  -- Chemistry 52
(2,6,2,1,7,5),(2,6,2,2,7,5),(2,6,2,3,7,5),(2,6,2,4,44,5);  -- History 65

-- Student 5 (Chidinma — JSS 2B) — top student
INSERT INTO `grades` (`student_id`,`subject_id`,`term_id`,`ca_type_id`,`score`,`entered_by`) VALUES
(5,1,2,1,10,2),(5,1,2,2,10,2),(5,1,2,3,9,2),(5,1,2,4,58,2),  -- Maths 87
(5,2,2,1,9,3),(5,2,2,2,10,3),(5,2,2,3,9,3),(5,2,2,4,55,3),   -- English 83
(5,3,2,1,9,4),(5,3,2,2,9,4),(5,3,2,3,8,4),(5,3,2,4,53,4),    -- Biology 79
(5,6,2,1,10,5),(5,6,2,2,9,5),(5,6,2,3,9,5),(5,6,2,4,56,5);   -- History 84

-- 1st Term grades for cumulative (student 1)
INSERT INTO `grades` (`student_id`,`subject_id`,`term_id`,`ca_type_id`,`score`,`entered_by`) VALUES
(1,1,1,1,7,2),(1,1,1,2,8,2),(1,1,1,3,7,2),(1,1,1,4,45,2),
(1,2,1,1,8,3),(1,2,1,2,8,3),(1,2,1,3,8,3),(1,2,1,4,50,3),
(1,3,1,1,6,4),(1,3,1,2,7,4),(1,3,1,3,6,4),(1,3,1,4,42,4);

-- ────────────────────────────────────────────────────────────
-- TEACHER COMMENTS
-- ────────────────────────────────────────────────────────────
INSERT INTO `teacher_comments` (`student_id`,`term_id`,`teacher_comment`,`principal_comment`) VALUES
(1,2,'Amara is a focused and diligent student. She excels in Physics and Mathematics but needs to work harder in Chemistry to maintain her overall performance.','An impressive student who consistently demonstrates academic integrity. We look forward to seeing her excel in the third term.'),
(2,2,'Kofi shows great potential but needs to improve his concentration during lessons. He should do more practice exercises especially in Physics.','Kofi has the ability to do better. With more dedication and parental support, we expect significant improvement.'),
(5,2,'Chidinma is outstanding in all subjects. She is a role model for her peers and demonstrates excellent leadership qualities inside and outside the classroom.','A truly exceptional student. Chidinma is on track for top honours at the end of this session. We are very proud of her progress.');

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE (past 2 weeks, weekdays)
-- ────────────────────────────────────────────────────────────
INSERT INTO `attendance` (`student_id`,`class_id`,`term_id`,`date`,`status`,`comment`,`marked_by`,`method`) VALUES
-- Week 1
(1,5,2,'2026-05-18','present',NULL,2,'manual'),
(2,10,2,'2026-05-18','present',NULL,3,'manual'),
(5,4,2,'2026-05-18','present',NULL,5,'manual'),
(6,7,2,'2026-05-18','late','Arrived 20 mins late',2,'manual'),
(1,5,2,'2026-05-19','present',NULL,2,'manual'),
(2,10,2,'2026-05-19','absent-excused','Medical appointment',3,'manual'),
(5,4,2,'2026-05-19','present',NULL,5,'manual'),
(6,7,2,'2026-05-19','present',NULL,2,'manual'),
(1,5,2,'2026-05-20','present',NULL,2,'qr'),
(2,10,2,'2026-05-20','present',NULL,3,'qr'),
(5,4,2,'2026-05-20','present',NULL,5,'qr'),
(1,5,2,'2026-05-21','early-dismissal','Parent emergency (dismissed 12:30)',2,'manual'),
(2,10,2,'2026-05-21','present',NULL,3,'manual'),
(5,4,2,'2026-05-21','present',NULL,5,'manual'),
(1,5,2,'2026-05-22','present',NULL,2,'biometric'),
(2,10,2,'2026-05-22','present',NULL,3,'biometric'),
-- Week 2
(1,5,2,'2026-05-26','present',NULL,2,'manual'),
(2,10,2,'2026-05-26','absent-unexcused',NULL,3,'manual'),
(5,4,2,'2026-05-26','present',NULL,5,'manual'),
(1,5,2,'2026-05-27','present',NULL,2,'manual'),
(2,10,2,'2026-05-27','present',NULL,3,'manual'),
(5,4,2,'2026-05-27','present',NULL,5,'manual');

-- ────────────────────────────────────────────────────────────
-- FEE STRUCTURES
-- ────────────────────────────────────────────────────────────
INSERT INTO `fee_structures` (`school_id`,`term_id`,`class_id`,`name`,`amount`,`fee_type`) VALUES
-- JSS fees
(1,2,NULL,'JSS Tuition Fee',75000,'tuition'),
(1,2,NULL,'JSS Exam Fee',5000,'exam'),
-- SSS fees
(1,2,NULL,'SSS Tuition Fee',85000,'tuition'),
(1,2,NULL,'SSS Exam Fee',6000,'exam'),
-- Hostel (all)
(1,2,NULL,'Hostel Fee',120000,'hostel'),
-- Transport
(1,2,NULL,'Transport Fee — Lekki Route',25000,'transport'),
(1,2,NULL,'Transport Fee — Surulere Route',22000,'transport');

-- ────────────────────────────────────────────────────────────
-- INVOICES & PAYMENTS
-- ────────────────────────────────────────────────────────────
INSERT INTO `invoices` (`id`,`invoice_no`,`student_id`,`term_id`,`total_amount`,`amount_paid`,`status`,`due_date`) VALUES
(1,'INV-2026-001',1,2,85000,85000,'paid','2026-02-01'),
(2,'INV-2026-002',2,2,85000,40000,'partial','2026-02-01'),
(3,'INV-2026-003',3,2,75000,75000,'paid','2026-02-01'),
(4,'INV-2026-004',4,2,85000,0,'unpaid','2026-02-01'),
(5,'INV-2026-005',5,2,75000,75000,'paid','2026-02-01'),
(6,'INV-2026-006',6,2,85000,85000,'paid','2026-02-01');

INSERT INTO `payments` (`invoice_id`,`amount`,`method`,`reference`,`received_by`,`payment_date`) VALUES
(1,85000,'bank_transfer','TRF20260115001',7,'2026-01-15'),
(2,40000,'cash',NULL,7,'2026-01-20'),
(3,75000,'bank_transfer','TRF20260118003',7,'2026-01-18'),
(5,75000,'online','PAY20260116005',7,'2026-01-16'),
(6,85000,'bank_transfer','TRF20260114006',7,'2026-01-14');

-- ────────────────────────────────────────────────────────────
-- EXPENSES
-- ────────────────────────────────────────────────────────────
INSERT INTO `expenses` (`school_id`,`description`,`category`,`amount`,`expense_date`,`recorded_by`,`status`) VALUES
(1,'May Staff Salaries',     'salaries',   3200000,'2026-05-25',7,'paid'),
(1,'NEPA / Generator Fuel', 'utilities',   185000,'2026-05-22',7,'paid'),
(1,'Classroom Chairs (20)', 'maintenance', 360000,'2026-05-20',7,'pending'),
(1,'Inter-House Sports Day','events',      220000,'2026-05-18',7,'paid'),
(1,'Stationery Restock',    'supplies',    95000,'2026-05-15',7,'paid'),
(1,'Medical Supplies',      'medical',     45000,'2026-04-30',7,'paid'),
(1,'Internet Subscription', 'utilities',   60000,'2026-04-01',7,'paid');

-- ────────────────────────────────────────────────────────────
-- PAYROLL
-- ────────────────────────────────────────────────────────────
INSERT INTO `payroll` (`staff_id`,`month`,`year`,`basic`,`housing`,`transport`,`deductions`,`status`,`paid_date`) VALUES
(1,5,2026,180000,40000,20000,18000,'paid','2026-05-25'),
(2,5,2026,175000,40000,20000,17500,'paid','2026-05-25'),
(3,5,2026,175000,40000,20000,17500,'paid','2026-05-25'),
(4,5,2026,160000,35000,18000,16000,'paid','2026-05-25'),
(5,5,2026,250000,60000,30000,25000,'paid','2026-05-25'),
(6,5,2026,200000,50000,25000,20000,'paid','2026-05-25');

-- ────────────────────────────────────────────────────────────
-- HOSTEL
-- ────────────────────────────────────────────────────────────
INSERT INTO `hostels` (`id`,`school_id`,`name`,`gender`,`capacity`,`matron_id`) VALUES
(1,1,'Block A (Boys)', 'male',  80,5),
(2,1,'Block B (Girls)','female',80,4),
(3,1,'Block C (Boys)', 'male',  60,5),
(4,1,'Block D (Girls)','female',60,4);

INSERT INTO `hostel_rooms` (`id`,`hostel_id`,`room_no`,`capacity`) VALUES
(1,1,'A-01',4),(2,1,'A-02',4),(3,1,'A-03',4),(4,1,'A-04',4),(5,1,'A-05',4),
(6,2,'B-01',4),(7,2,'B-02',4),(8,2,'B-03',4),(9,2,'B-04',4),(10,2,'B-05',4),
(11,3,'C-01',4),(12,3,'C-02',4),(13,3,'C-03',4),
(14,4,'D-01',4),(15,4,'D-02',4),(16,4,'D-03',4);

INSERT INTO `hostel_allocations` (`room_id`,`student_id`,`term_id`) VALUES
(1,4,2),(1,10,2),
(6,1,2),(6,5,2),(6,11,2);

INSERT INTO `hostel_visitors` (`student_id`,`visitor_name`,`relation`,`purpose`,`time_in`,`time_out`,`logged_by`) VALUES
(1,'Mrs. Grace Okonkwo','Mother',  'Welfare visit',  '2026-05-20 10:00:00','2026-05-20 12:30:00',1),
(2,'Mr. Kwame Mensah', 'Father',  'Fee payment',    '2026-05-18 14:00:00','2026-05-18 15:00:00',1),
(6,'Dr. Musa Ibrahim', 'Guardian','Medical check',  '2026-05-17 09:30:00','2026-05-17 10:15:00',1);

-- ────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────
INSERT INTO `inventory_items` (`school_id`,`item_code`,`name`,`category`,`unit`,`qty`,`min_qty`,`unit_cost`,`location`,`supplier`,`last_restocked`) VALUES
(1,'I001','Exercise Books (A4)',  'stationery', 'Ream',  340,100,1200, 'Store Room A', 'PaperPlus Ltd',    '2026-04-10'),
(1,'I002','Biro Pens (Blue)',     'stationery', 'Box',   28, 30, 800,  'Store Room A', 'Stationery Hub',   '2026-03-22'),
(1,'I003','Manila Cardboard',     'stationery', 'Pack',  6,  15, 2500, 'Store Room A', 'PaperPlus Ltd',    '2026-02-18'),
(1,'I004','Chalk (White)',        'stationery', 'Box',   90, 40, 350,  'Store Room A', 'Stationery Hub',   '2026-04-28'),
(1,'I005','Student Desk & Chair', 'furniture',  'Set',   220,10, 18000,'Warehouse',    'FurniWorld',       '2025-09-01'),
(1,'I006','Whiteboard (Large)',   'furniture',  'Pcs',   4,  5,  45000,'Warehouse',    'ClassEquip Co.',   '2025-11-12'),
(1,'I007','Bunsen Burner',        'lab',        'Pcs',   22, 10, 8500, 'Science Lab',  'LabSupplies NG',   '2026-01-15'),
(1,'I008','Microscope (Compound)','lab',        'Pcs',   8,  8,  95000,'Science Lab',  'LabSupplies NG',   '2025-08-20'),
(1,'I009','Test Tubes (Pack/50)', 'lab',        'Pack',  3,  10, 4200, 'Science Lab',  'LabSupplies NG',   '2026-02-05'),
(1,'I010','Desktop Computer',     'ict',        'Pcs',   34, 5,  280000,'ICT Lab',     'TechNigeria Ltd',  '2025-06-01'),
(1,'I011','Mattress (Single)',    'hostel',     'Pcs',   180,20, 22000,'Hostel Store', 'BedMasters NG',    '2025-09-01'),
(1,'I012','Bedsheet (White)',     'hostel',     'Pcs',   95, 50, 3800, 'Hostel Store', 'LinenPro',         '2026-03-15'),
(1,'I013','Mosquito Net',         'hostel',     'Pcs',   8,  30, 1500, 'Hostel Store', 'HealthGuard',      '2025-12-01'),
(1,'I014','Rice (50kg bag)',      'kitchen',    'Bag',   38, 20, 75000,'Kitchen Store','FoodHub Nigeria',  '2026-05-01'),
(1,'I015','Cooking Gas (12kg)',   'kitchen',    'Cyl',   5,  6,  18000,'Kitchen',      'GasPlus',          '2026-05-10'),
(1,'I016','Paracetamol (500mg)', 'medical',    'Pack',  45, 20, 850,  'Sick Bay',     'PharmaCare',       '2026-04-15'),
(1,'I017','Disposable Gloves',    'medical',    'Box',   3,  10, 3500, 'Sick Bay',     'PharmaCare',       '2026-02-28'),
(1,'I018','Paint (White, 20L)',   'maintenance','Tin',   18, 8,  22000,'Maintenance',  'PaintPro',         '2026-01-20'),
(1,'I019','Electrical Bulb 20W', 'maintenance','Box',   6,  10, 8500, 'Maintenance',  'PowerLite',        '2026-03-28'),
(1,'I020','Football',             'sports',     'Pcs',   12, 6,  3500, 'Sports Store', 'SportZone',        '2026-03-10');

INSERT INTO `inventory_transactions` (`item_id`,`type`,`qty`,`issued_to`,`purpose`,`done_by`) VALUES
(1,'issue', 20,'JSS 3A',          'Class distribution',    2),
(12,'issue',10,'Hostel Block B',  'New term bedding',      4),
(20,'issue',2, 'Sports Dept',     'Inter-house sports',    5),
(16,'issue',5, 'Kofi Mensah',     'Student medical',       6),
(14,'issue',4, 'School Kitchen',  'Weekly meal prep',      1),
(1,'restock',100,'—',             'Quarterly restock',     1);

-- ────────────────────────────────────────────────────────────
-- LIBRARY
-- ────────────────────────────────────────────────────────────
INSERT INTO `library_books` (`school_id`,`isbn`,`title`,`author`,`category`,`total_copies`,`available`) VALUES
(1,'978-0-582-60581-0','New General Mathematics',      'MF Macrae',       'Mathematics', 12,9),
(1,'978-978-081-234-5','Comprehensive English',         'Bankole & Kolapo','Languages',   8, 8),
(1,'978-0-521-68048-3','Biology for Schools',           'DG Mackean',      'Sciences',    15,10),
(1,'978-978-081-456-7','Further Mathematics',           'SA Ilori',        'Mathematics', 6, 0),
(1,'978-0-435-92395-6','Chemistry in Use',              'Austin Lyons',    'Sciences',    10,8),
(1,'978-978-081-789-1','History of West Africa',        'Ajayi & Espie',   'Humanities',  7, 6),
(1,'978-0-174-48583-7','Physics Essentials',            'Nelkon & Parker', 'Sciences',    9, 5),
(1,'978-978-081-900-2','Computer Studies for Schools',  'Obasi Emmanuel',  'ICT',         5, 5);

INSERT INTO `book_loans` (`book_id`,`student_id`,`issued_at`,`due_date`,`returned_at`) VALUES
(1,1,'2026-05-01','2026-05-15','2026-05-14'),
(3,2,'2026-05-10','2026-05-24',NULL),
(7,5,'2026-05-05','2026-05-19','2026-05-19'),
(4,1,'2026-04-20','2026-05-04',NULL);

-- ────────────────────────────────────────────────────────────
-- TRANSPORT
-- ────────────────────────────────────────────────────────────
INSERT INTO `transport_routes` (`school_id`,`name`,`bus_number`,`driver_name`,`driver_phone`,`capacity`,`term_fee`,`is_active`) VALUES
(1,'Lekki – VI Route',     'LND-342-AA','Mr. Adamu Bello',   '08011111111',35,25000,1),
(1,'Surulere – Yaba',      'LND-218-BB','Mr. Emeka Nwosu',   '08022222222',30,22000,1),
(1,'Ikeja – Ojodu',        'LND-556-CC','Mr. Kunle Adesanya','08033333333',40,20000,1),
(1,'Ajah – Sangotedo',     'LND-112-DD','Mrs. Taiwo Adeyemi','08044444444',35,28000,1);

INSERT INTO `student_transport` (`student_id`,`route_id`,`term_id`,`pickup_point`) VALUES
(1,1,2,'Lekki Phase 1 Gate'),
(3,2,2,'Surulere Bus Stop'),
(5,1,2,'VGC Junction'),
(7,3,2,'Ikeja GRA');

-- ────────────────────────────────────────────────────────────
-- ADMISSIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO `admission_applications` (`school_id`,`first_name`,`last_name`,`date_of_birth`,`gender`,`apply_class`,`guardian_name`,`guardian_phone`,`guardian_email`,`status`,`docs_complete`) VALUES
(1,'Tunde',       'Bakare', '2013-04-12','male',  'JSS 1A','Mr. Bakare',    '08011234567','bakare@gmail.com',   'pending',  1),
(1,'Ngozi',       'Eze',    '2012-09-03','female','JSS 2A','Mrs. Eze',      '08022345678','n.eze@gmail.com',    'approved', 1),
(1,'Emeka',       'Okafor', '2011-01-22','male',  'JSS 3B','Mr. Okafor',   '08033456789','okafor@gmail.com',   'rejected', 0),
(1,'Halima',      'Usman',  '2013-07-30','female','JSS 1B','Dr. Usman',     '08044567890','usman@gmail.com',    'pending',  1),
(1,'Chukwuemeka', 'Ibe',    '2012-11-15','male',  'SSS 1A','Chief Ibe',     '08055678901','ibe@gmail.com',      'interview',1);

-- ────────────────────────────────────────────────────────────
-- DISCIPLINARY
-- ────────────────────────────────────────────────────────────
INSERT INTO `disciplinary_incidents` (`student_id`,`type`,`description`,`action`,`incident_date`,`status`,`recorded_by`) VALUES
(4,'Misconduct',    'Found with mobile phone during class hours.',       'Warning issued, phone confiscated for 2 weeks','2026-05-10','resolved',2),
(2,'Late Coming',   'Arrived 40 mins late on three consecutive days.',  'Parents contacted via SMS',                      '2026-05-14','open',    3),
(1,'Dress Code',    'Came to school without proper school shoes.',       'Sent home to change',                           '2026-04-28','resolved',2);

-- ────────────────────────────────────────────────────────────
-- LEAVE REQUESTS
-- ────────────────────────────────────────────────────────────
INSERT INTO `leave_requests` (`staff_id`,`type`,`from_date`,`to_date`,`days`,`reason`,`status`,`approved_by`) VALUES
(1,'Medical Leave',   '2026-05-20','2026-05-24',5,'Scheduled surgery recovery',           'approved',5),
(2,'Annual Leave',    '2026-06-01','2026-06-10',10,'Family holiday',                      'pending', NULL),
(3,'Maternity Leave', '2026-07-01','2026-09-30',90,'Maternity leave — first child',       'approved',5),
(4,'Casual Leave',    '2026-05-26','2026-05-26',1,'Personal emergency',                   'pending', NULL);

-- ────────────────────────────────────────────────────────────
-- MESSAGES
-- ────────────────────────────────────────────────────────────
INSERT INTO `messages` (`school_id`,`sender_id`,`subject`,`body`,`type`) VALUES
(1,2,'Math Test Tomorrow','Please remind students that there is a Mathematics test tomorrow covering Algebra and Quadratic Equations. Ensure they study their notes.','direct'),
(1,1,'End of Term Announcement','The 2nd Term examinations will commence on June 15, 2026. Parents should ensure wards prepare adequately. Report cards will be available on July 5, 2026.','announcement'),
(1,6,'School Fees Reminder','This is a reminder that the deadline for 2nd term fees payment is May 31, 2026. Students with outstanding balances should clear them promptly to avoid suspension.','announcement');

INSERT INTO `message_recipients` (`message_id`,`recipient_id`,`is_read`) VALUES
(1,3,1),(1,4,0),(1,5,1),
(2,2,1),(2,3,1),(2,4,0),(2,5,1),
(3,2,1),(3,3,1);

-- ────────────────────────────────────────────────────────────
-- CBT EXAMS
-- ────────────────────────────────────────────────────────────
INSERT INTO `exams` (`school_id`,`class_id`,`subject_id`,`term_id`,`title`,`exam_type`,`duration`,`total_marks`,`pass_mark`,`status`,`shuffle_q`,`shuffle_opts`,`created_by`) VALUES
(1,10,1,2,'Mathematics Mid-Term Exam','mid-term',60,70,35,'active',1,1,2),
(1,5, 2,2,'English Language C.A. Test','ca',      45,40,20,'draft', 1,0,3),
(1,11,3,2,'Biology Final Examination', 'final',   90,100,50,'completed',1,1,4);

INSERT INTO `exam_questions` (`exam_id`,`type`,`question`,`options`,`answer`,`marks`,`sort_order`) VALUES
(1,'mcq','Which formula correctly calculates the area of a circle?',
  '["A = πr²","A = 2πr","A = πd","A = r²"]','0',2,1),
(1,'mcq','What is the value of √144?',
  '["11","12","13","14"]','1',2,2),
(1,'mcq','If x + 5 = 12, what is the value of x?',
  '["5","6","7","8"]','2',2,3),
(1,'mcq','What is the HCF of 24 and 36?',
  '["6","8","12","18"]','2',2,4),
(1,'short','Define a quadratic equation and give one example.',
  NULL,'A quadratic equation is a polynomial equation of degree 2 in the form ax² + bx + c = 0. Example: 2x² - 5x + 3 = 0.',5,5),
(1,'mcq','Simplify: 3(2x - 4) + 2x',
  '["8x - 12","8x - 4","6x - 12","6x - 4"]','0',2,6),
(1,'mcq','The sum of angles in a triangle is:',
  '["90°","180°","270°","360°"]','1',2,7),
(1,'mcq','What is 15% of 200?',
  '["20","25","30","35"]','2',2,8),
(1,'mcq','Expand: (x + 3)(x - 2)',
  '["x² - x - 6","x² + x - 6","x² + x + 6","x² - x + 6"]','0',2,9),
(1,'short','Find the two values of x if x² - 5x + 6 = 0.',
  NULL,'Factorising: (x - 2)(x - 3) = 0, therefore x = 2 or x = 3.',5,10);

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO `notifications` (`user_id`,`title`,`body`,`type`,`is_read`) VALUES
(1,'New Admission Application','Tunde Bakare has submitted an application for JSS 1A.','admission',0),
(1,'Low Inventory Alert','Test Tubes stock has fallen below minimum (3 packs remaining).','inventory',0),
(1,'Leave Request Pending','Mr. Charles Osei has requested Annual Leave from June 1-10.','leave',1),
(2,'Exam Created','Your Mathematics Mid-Term Exam has been published for SSS 2B.','exam',1),
(7,'Payroll Processed','May 2026 payroll has been processed for 6 staff members.','payroll',0);

-- ────────────────────────────────────────────────────────────
-- TIMETABLE (JSS 3A — sample)
-- ────────────────────────────────────────────────────────────
INSERT INTO `timetable_slots` (`class_id`,`subject_id`,`teacher_id`,`day`,`period`,`start_time`,`end_time`,`term_id`) VALUES
(5,1,2,'Monday',   1,'07:30:00','08:10:00',2),
(5,2,3,'Monday',   2,'08:10:00','08:50:00',2),
(5,3,4,'Monday',   3,'08:50:00','09:30:00',2),
(5,4,2,'Monday',   4,'09:30:00','10:10:00',2),
(5,2,3,'Tuesday',  1,'07:30:00','08:10:00',2),
(5,1,2,'Tuesday',  2,'08:10:00','08:50:00',2),
(5,5,4,'Tuesday',  3,'08:50:00','09:30:00',2),
(5,6,5,'Wednesday',1,'07:30:00','08:10:00',2),
(5,3,4,'Wednesday',2,'08:10:00','08:50:00',2),
(5,1,2,'Wednesday',3,'08:50:00','09:30:00',2),
(5,7,5,'Thursday', 1,'07:30:00','08:10:00',2),
(5,2,3,'Thursday', 2,'08:10:00','08:50:00',2),
(5,4,2,'Thursday', 3,'08:50:00','09:30:00',2),
(5,9,5,'Friday',   1,'07:30:00','08:10:00',2),
(5,10,3,'Friday',  2,'08:10:00','08:50:00',2),
(5,8,4,'Friday',   3,'08:50:00','09:30:00',2);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Default admin credentials:
--   Email:    admin@greenfield.edu.ng
--   Password: password
-- ============================================================
