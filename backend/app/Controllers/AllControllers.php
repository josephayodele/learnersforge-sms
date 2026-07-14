<?php
// ─── DashboardController ──────────────────────────────────────────────────────
class DashboardController {
    public static function index(array $user): void {
        $sid = (int)$user['school_id'];
        $data = [
            'total_students'   => (int)(DB::one('SELECT COUNT(*) c FROM students s JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND s.deleted_at IS NULL AND u.deleted_at IS NULL',[$sid])['c']??0),
            'total_staff'      => (int)(DB::one('SELECT COUNT(*) c FROM staff s JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND s.deleted_at IS NULL AND u.deleted_at IS NULL',[$sid])['c']??0),
            'fees_collected'   => (float)(DB::one('SELECT COALESCE(SUM(p.amount),0) t FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN students st ON st.id=i.student_id JOIN users u ON u.id=st.user_id WHERE u.school_id=?',[$sid])['t']??0),
            'fees_outstanding' => (float)(DB::one('SELECT COALESCE(SUM(i.balance),0) t FROM invoices i JOIN students st ON st.id=i.student_id JOIN users u ON u.id=st.user_id WHERE u.school_id=? AND i.status != "paid"',[$sid])['t']??0),
            'today_present'    => (int)(DB::one('SELECT COUNT(*) c FROM attendance WHERE status="present" AND date=CURDATE()',[]  )['c']??0),
            'active_exams'     => DB::query('SELECT id,title,exam_type,status FROM exams WHERE school_id=? AND status IN ("active","draft") ORDER BY created_at DESC LIMIT 5',[$sid]),
            'recent_alerts'    => DB::query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 5',[(int)$user['id']]),
            'low_inventory'    => DB::query('SELECT id,name,qty,min_qty,unit FROM inventory_items WHERE school_id=? AND qty <= min_qty AND deleted_at IS NULL LIMIT 5',[$sid]),
        ];

        // Weekly attendance — present-rate per weekday (Mon–Fri) for the current week.
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekEnd   = date('Y-m-d', strtotime('friday this week'));
        $rows = DB::query(
            'SELECT DAYOFWEEK(a.date) dow,
                    ROUND(100 * SUM(a.status = "present") / NULLIF(COUNT(*), 0)) rate
             FROM attendance a
             JOIN students st ON st.id = a.student_id
             JOIN users u ON u.id = st.user_id
             WHERE u.school_id = ? AND a.date BETWEEN ? AND ?
             GROUP BY DAYOFWEEK(a.date)',
            [$sid, $weekStart, $weekEnd]
        );
        $rateByDow = [];
        foreach ($rows as $r) { $rateByDow[(int)$r['dow']] = (int)$r['rate']; }
        // DAYOFWEEK(): 2=Mon … 6=Fri
        $data['attendance_week'] = array_map(
            fn($dow, $label) => ['day' => $label, 'rate' => $rateByDow[$dow] ?? 0],
            [2, 3, 4, 5, 6],
            ['M', 'T', 'W', 'T', 'F']
        );

        respond($data);
    }
}

// ─── StudentController ────────────────────────────────────────────────────────
class StudentController {
    public static function index(array $user): void {
        $sid    = (int)$user['school_id'];
        $search = $_GET['search'] ?? '';
        $classId = (int)($_GET['class_id'] ?? 0);
        $form   = trim($_GET['form'] ?? '');   // class-name prefix, e.g. "JSS 3" = all arms
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = min(200, max(1, (int)($_GET['per_page'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $where = ['u.school_id = ?'];
        $params = [$sid];
        if ($search) { $where[] = '(u.first_name LIKE ? OR u.last_name LIKE ? OR s.student_id LIKE ?)'; $w="%$search%"; $params=array_merge($params,[$w,$w,$w]); }
        if ($classId) { $where[] = 's.class_id = ?'; $params[] = $classId; }
        elseif ($form !== '') { $where[] = 'c.name LIKE ?'; $params[] = $form . '%'; }

        $sql = 'SELECT s.id, s.student_id, s.admission_date, s.guardian_name, s.guardian_phone,
                       u.first_name, u.last_name, u.email, u.phone, u.gender, u.date_of_birth,
                       c.name AS class_name, c.id AS class_id
                FROM students s
                JOIN users u ON u.id = s.user_id
                JOIN classes c ON c.id = s.class_id
                WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL AND ' . implode(' AND ', $where) .
               ' ORDER BY u.last_name, u.first_name LIMIT ? OFFSET ?';
        $params[] = $limit; $params[] = $offset;

        // Count query joins classes too, so a c.name (form) filter resolves.
        $countSql = 'SELECT COUNT(*) c FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL AND ' . implode(' AND ', $where);
        $total = (int)(DB::one($countSql, array_slice($params, 0, -2))['c'] ?? 0);

        respond(['students' => DB::query($sql, $params), 'meta' => ['total' => $total, 'page' => $page, 'per_page' => $limit, 'pages' => max(1, ceil($total / $limit))]]);
    }

    public static function show(array $user, int $id): void {
        $s = DB::one('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender,u.date_of_birth,u.address,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Student not found');
        $s['attendance_summary'] = DB::one('SELECT COUNT(*) total, SUM(status="present") present, SUM(status LIKE "absent%") absent, SUM(status LIKE "late%") late FROM attendance WHERE student_id=?',[$id]);
        $s['invoice'] = DB::one('SELECT * FROM invoices WHERE student_id=? ORDER BY id DESC LIMIT 1',[$id]);
        respond($s);
    }

    public static function store(array $user): void {
        $b = body();
        DB::conn()->beginTransaction();
        try {
            $uid = DB::exec('INSERT INTO users (school_id,first_name,last_name,email,phone,password,role,gender,date_of_birth) VALUES (?,?,?,?,?,?,?,?,?)',
                [(int)$user['school_id'],$b['first_name'],$b['last_name'],$b['email'],$b['phone']??null,
                 password_hash($b['password']??'password123',PASSWORD_DEFAULT),'student',$b['gender']??null,$b['date_of_birth']??null]);
            $sid_gen = !empty($b['student_id'])       ? $b['student_id']       : 'ST' . str_pad((string)$uid, 4, '0', STR_PAD_LEFT);
            $admNo   = !empty($b['admission_number']) ? $b['admission_number'] : 'GFA/' . date('Y') . '/' . str_pad((string)$uid, 3, '0', STR_PAD_LEFT);
            $stid = DB::exec('INSERT INTO students (user_id,student_id,class_id,admission_number,admission_date,guardian_name,guardian_phone,guardian_email,guardian_address,medical_notes,previous_school) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [$uid,$sid_gen,$b['class_id']??1,$admNo,date('Y-m-d'),$b['guardian_name']??null,$b['guardian_phone']??null,$b['guardian_email']??null,$b['guardian_address']??null,$b['medical_notes']??null,$b['previous_school']??null]);
            DB::conn()->commit();
            respond(['student_id' => $stid, 'user_id' => $uid, 'student_code' => $sid_gen], 201, 'Student created');
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    // Bulk import: all rows are enrolled into the single class chosen in the form.
    // Each row is its own transaction so one bad row never aborts the whole batch.
    public static function import(array $user): void {
        $b        = body();
        $classId  = (int)($b['class_id'] ?? 0);
        $students = $b['students'] ?? [];
        if (!$classId) respond(null, 422, 'Please select a class.');
        if (!is_array($students) || !$students) respond(null, 422, 'No students found in the file.');

        $cls = DB::one('SELECT id FROM classes WHERE id=? AND school_id=? AND deleted_at IS NULL', [$classId, (int)$user['school_id']]);
        if (!$cls) respond(null, 422, 'Invalid class selected.');

        $created = 0; $failed = 0; $errors = [];
        foreach ($students as $i => $row) {
            $rowNo = $i + 1;
            $first = trim((string)($row['first_name'] ?? ''));
            $last  = trim((string)($row['last_name'] ?? ''));
            if ($first === '' && !empty($row['name'])) {           // split a single "name" field
                $parts = preg_split('/\s+/', trim((string)$row['name']));
                $first = array_shift($parts) ?: '';
                $last  = implode(' ', $parts);
            }
            if ($first === '') { $failed++; $errors[] = ['row'=>$rowNo, 'name'=>($row['name'] ?? ''), 'error'=>'Missing student name']; continue; }

            $gender = strtolower(trim((string)($row['gender'] ?? '')));
            if (!in_array($gender, ['male','female'], true)) $gender = null;
            $dob   = self::normalizeDate($row['date_of_birth'] ?? null);
            $phone = trim((string)($row['phone'] ?? '')) ?: null;

            DB::conn()->beginTransaction();
            try {
                $providedEmail = trim((string)($row['email'] ?? ''));
                // email is NOT NULL + UNIQUE — synthesise a unique placeholder when blank.
                $tmpEmail = $providedEmail !== '' ? $providedEmail : ('import_' . uniqid('', true) . '@placeholder.local');
                $uid = DB::exec('INSERT INTO users (school_id,first_name,last_name,email,phone,password,role,gender,date_of_birth) VALUES (?,?,?,?,?,?,?,?,?)',
                    [(int)$user['school_id'], $first, $last, $tmpEmail, $phone,
                     password_hash('password123', PASSWORD_DEFAULT), 'student', $gender, $dob]);
                if ($providedEmail === '') {
                    DB::run('UPDATE users SET email=? WHERE id=?', ['student' . $uid . '@learnersforge.local', $uid]);
                }
                $sidGen = !empty($row['student_id'])       ? $row['student_id']       : 'ST' . str_pad((string)$uid, 4, '0', STR_PAD_LEFT);
                $admNo  = !empty($row['admission_number']) ? $row['admission_number'] : 'GFA/' . date('Y') . '/' . str_pad((string)$uid, 3, '0', STR_PAD_LEFT);
                DB::exec('INSERT INTO students (user_id,student_id,class_id,admission_number,admission_date,guardian_name,guardian_phone,guardian_email,guardian_address,medical_notes,previous_school) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    [$uid, $sidGen, $classId, $admNo, date('Y-m-d'), $row['guardian_name'] ?? null,
                     $row['guardian_phone'] ?? $phone, $row['guardian_email'] ?? null, $row['guardian_address'] ?? null,
                     $row['medical_notes'] ?? null, $row['previous_school'] ?? null]);
                DB::conn()->commit();
                $created++;
            } catch (Throwable $e) {
                DB::conn()->rollBack();
                $failed++;
                $msg = $e->getMessage();
                if (stripos($msg, 'Duplicate') !== false) {
                    if     (stripos($msg, 'admission') !== false) $msg = 'Duplicate admission number';
                    elseif (stripos($msg, 'student_id') !== false) $msg = 'Duplicate student ID';
                    elseif (stripos($msg, 'email')     !== false) $msg = 'Duplicate email';
                    else $msg = 'Duplicate entry';
                }
                $errors[] = ['row'=>$rowNo, 'name'=>trim("$first $last"), 'error'=>$msg];
            }
        }
        respond(['created'=>$created, 'failed'=>$failed, 'errors'=>$errors], 201, "Imported $created student(s), $failed failed");
    }

    // Normalise common spreadsheet date formats to Y-m-d (null if unparseable/blank).
    private static function normalizeDate($v): ?string {
        $v = trim((string)$v);
        if ($v === '') return null;
        if (preg_match('#^\d{4}-\d{2}-\d{2}$#', $v)) return $v;
        if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $v, $m)) {
            $mm = (int)$m[1]; $dd = (int)$m[2]; $yy = (int)$m[3];
            if ($mm > 12 && $dd <= 12) { $t = $mm; $mm = $dd; $dd = $t; }  // clearly DD/MM/YYYY
            if ($mm < 1 || $mm > 12 || $dd < 1 || $dd > 31) return null;
            return sprintf('%04d-%02d-%02d', $yy, $mm, $dd);
        }
        $ts = strtotime($v);
        return $ts ? date('Y-m-d', $ts) : null;
    }

    public static function update(array $user, int $id): void {
        $b = body();
        $s = DB::one('SELECT s.*,u.id AS uid FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Student not found');
        if (!empty($b['class_id'])) DB::run('UPDATE students SET class_id=?,updated_at=NOW() WHERE id=?',[$b['class_id'],$id]);
        if (!empty($b['first_name'])||!empty($b['last_name'])) DB::run('UPDATE users SET first_name=COALESCE(?,first_name),last_name=COALESCE(?,last_name),updated_at=NOW() WHERE id=?',[$b['first_name']??null,$b['last_name']??null,$s['uid']]);
        respond(['updated' => true]);
    }

    public static function destroy(array $user, int $id): void {
        $s = DB::one('SELECT s.*,u.id AS uid FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Student not found');
        DB::run('UPDATE students SET deleted_at=NOW() WHERE id=?',[$id]);
        DB::run('UPDATE users SET deleted_at=NOW() WHERE id=?',[$s['uid']]);
        respond(['deleted' => true]);
    }

    // Soft-delete many students at once (only those in the caller's school).
    public static function bulkDestroy(array $user): void {
        $ids = array_values(array_unique(array_filter(array_map('intval', body()['ids'] ?? []))));
        if (!$ids) respond(null, 422, 'No student ids provided');
        $sid = (int)$user['school_id'];
        $ph  = implode(',', array_fill(0, count($ids), '?'));
        $rows = DB::query(
            "SELECT s.id, s.user_id FROM students s JOIN users u ON u.id=s.user_id
             WHERE s.id IN($ph) AND u.school_id=? AND s.deleted_at IS NULL",
            array_merge($ids, [$sid]));
        if (!$rows) respond(['deleted' => 0]);
        $sIds = array_column($rows, 'id');
        $uIds = array_column($rows, 'user_id');
        DB::conn()->beginTransaction();
        try {
            $sp = implode(',', array_fill(0, count($sIds), '?'));
            DB::run("UPDATE students SET deleted_at=NOW() WHERE id IN($sp)", $sIds);
            $up = implode(',', array_fill(0, count($uIds), '?'));
            DB::run("UPDATE users SET deleted_at=NOW() WHERE id IN($up)", $uIds);
            DB::conn()->commit();
            respond(['deleted' => count($sIds)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }
}

// ─── StaffController ──────────────────────────────────────────────────────────
class StaffController {
    public static function index(array $user): void {
        $sid = (int)$user['school_id'];
        respond(DB::query('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender,u.is_active FROM staff s JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND u.deleted_at IS NULL ORDER BY u.last_name',[$sid]));
    }
    public static function show(array $user, int $id): void {
        $s = DB::one('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Staff not found');
        $s['subjects'] = DB::query('SELECT sub.name FROM class_subjects cs JOIN subjects sub ON sub.id=cs.subject_id WHERE cs.teacher_id=? GROUP BY sub.id',[$s['user_id']]);
        $s['payroll']  = DB::query('SELECT * FROM payroll WHERE staff_id=? ORDER BY year DESC,month DESC LIMIT 6',[$id]);
        $s['leave']    = DB::query('SELECT * FROM leave_requests WHERE staff_id=? ORDER BY created_at DESC LIMIT 5',[$id]);
        respond($s);
    }
    public static function store(array $user): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can create staff.');
        $b = body();
        $sid = (int)$user['school_id'];
        DB::conn()->beginTransaction();
        try {
            $uid = DB::exec('INSERT INTO users (school_id,first_name,last_name,email,phone,password,role,gender) VALUES (?,?,?,?,?,?,?,?)',
                [$sid,$b['first_name'],$b['last_name'],$b['email'],$b['phone']??null,password_hash($b['password']??'password123',PASSWORD_DEFAULT),'teacher',$b['gender']??null]);
            $code = 'TC' . str_pad((string)$uid,3,'0',STR_PAD_LEFT);
            DB::exec('INSERT INTO staff (user_id,staff_id,department,designation,hire_date) VALUES (?,?,?,?,?)',
                [$uid,$code,$b['department']??null,$b['designation']??null,$b['hire_date']??date('Y-m-d')]);
            self::applyAssignments($sid, $uid, $b);
            DB::conn()->commit();
            respond(['staff_code'=>$code,'user_id'=>$uid],201,'Staff created');
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    // Current teaching / class-teacher assignments for a staff member.
    public static function assignments(array $user, int $id): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can view assignments.');
        $sid = (int)$user['school_id'];
        $st = DB::one('SELECT s.user_id FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?', [$id, $sid]);
        if (!$st) respond(null, 404, 'Staff not found');
        $uid = (int)$st['user_id'];
        $classTeacherOf = array_map('intval', array_column(
            DB::query('SELECT id FROM classes WHERE school_id=? AND form_teacher_id=? AND deleted_at IS NULL', [$sid, $uid]), 'id'));
        $teaching = DB::query(
            'SELECT cs.class_id, cs.subject_id FROM class_subjects cs JOIN classes c ON c.id=cs.class_id
             WHERE c.school_id=? AND cs.teacher_id=?', [$sid, $uid]);
        respond(['class_teacher_of' => $classTeacherOf,
                 'teaching' => array_map(fn($r) => ['class_id'=>(int)$r['class_id'],'subject_id'=>(int)$r['subject_id']], $teaching)]);
    }

    public static function saveAssignments(array $user, int $id): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can change assignments.');
        $sid = (int)$user['school_id'];
        $st = DB::one('SELECT s.user_id FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?', [$id, $sid]);
        if (!$st) respond(null, 404, 'Staff not found');
        DB::conn()->beginTransaction();
        try {
            self::applyAssignments($sid, (int)$st['user_id'], body());
            DB::conn()->commit();
            respond(['saved' => true]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    public static function destroy(array $user, int $id): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can delete staff.');
        $sid = (int)$user['school_id'];
        $st = DB::one('SELECT s.user_id FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=? AND s.deleted_at IS NULL', [$id, $sid]);
        if (!$st) respond(null, 404, 'Staff not found');
        $uid = (int)$st['user_id'];
        DB::conn()->beginTransaction();
        try {
            DB::run('UPDATE classes SET form_teacher_id=NULL WHERE school_id=? AND form_teacher_id=?', [$sid, $uid]);
            DB::run('UPDATE class_subjects cs JOIN classes c ON c.id=cs.class_id SET cs.teacher_id=NULL WHERE c.school_id=? AND cs.teacher_id=?', [$sid, $uid]);
            DB::run('UPDATE staff SET deleted_at=NOW() WHERE id=?', [$id]);
            DB::run('UPDATE users SET deleted_at=NOW() WHERE id=?', [$uid]);
            DB::conn()->commit();
            respond(['deleted' => true]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    // Replace a user's class-teacher (classes.form_teacher_id) and subject-teaching
    // (class_subjects.teacher_id) assignments from the request body. School-scoped.
    private static function applyAssignments(int $schoolId, int $userId, array $b): void {
        $classTeacherOf = array_values(array_unique(array_filter(array_map('intval', $b['class_teacher_of'] ?? []))));
        $teaching = array_values(array_filter(array_map(function ($t) {
            return (is_array($t) && !empty($t['class_id']) && !empty($t['subject_id']))
                ? ['class_id' => (int)$t['class_id'], 'subject_id' => (int)$t['subject_id']] : null;
        }, $b['teaching'] ?? [])));

        // ── Class-teacher (classes.form_teacher_id) ──
        DB::run('UPDATE classes SET form_teacher_id=NULL WHERE school_id=? AND form_teacher_id=?', [$schoolId, $userId]);
        foreach ($classTeacherOf as $cid) {
            DB::run('UPDATE classes SET form_teacher_id=? WHERE id=? AND school_id=?', [$userId, $cid, $schoolId]);
        }

        // ── Subject-teaching (class_subjects.teacher_id) ──
        DB::run('UPDATE class_subjects cs JOIN classes c ON c.id=cs.class_id SET cs.teacher_id=NULL WHERE c.school_id=? AND cs.teacher_id=?', [$schoolId, $userId]);
        foreach ($teaching as $t) {
            if (!DB::one('SELECT id FROM classes  WHERE id=? AND school_id=?', [$t['class_id'], $schoolId])) continue;
            if (!DB::one('SELECT id FROM subjects WHERE id=? AND school_id=?', [$t['subject_id'], $schoolId])) continue;
            $row = DB::one('SELECT id FROM class_subjects WHERE class_id=? AND subject_id=?', [$t['class_id'], $t['subject_id']]);
            if ($row) DB::run('UPDATE class_subjects SET teacher_id=? WHERE id=?', [$userId, (int)$row['id']]);
            else      DB::run('INSERT INTO class_subjects (class_id,subject_id,teacher_id) VALUES (?,?,?)', [$t['class_id'], $t['subject_id'], $userId]);
        }
    }
}

// ─── AttendanceController ─────────────────────────────────────────────────────
class AttendanceController {
    public static function index(array $user): void {
        $classId = (int)($_GET['class_id']??0);
        $date    = $_GET['date'] ?? date('Y-m-d');
        $termId  = (int)($_GET['term_id']??2);
        // NOTE: alias s.student_id (the human admission string) so it doesn't collide
        // with and overwrite a.student_id (the numeric FK the frontend keys the roster by).
        $rows = DB::query(
            'SELECT a.*,u.first_name,u.last_name,s.student_id AS admission_no FROM attendance a
             JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id
             WHERE a.class_id=? AND a.date=? AND a.term_id=?',
            [$classId,$date,$termId]);
        respond($rows);
    }

    public static function bulk(array $user): void {
        $b       = body();
        $records = $b['records'] ?? [];
        $termId  = (int)($b['term_id']??2);
        $classId = (int)($b['class_id']??0);
        $date    = $b['date'] ?? date('Y-m-d');
        $by      = (int)$user['id'];
        // Attendance is taken by the class teacher (or an admin).
        Perm::assertManageClass($user, $classId);

        DB::conn()->beginTransaction();
        try {
            foreach ($records as $rec) {
                DB::run('INSERT INTO attendance (student_id,class_id,term_id,date,status,dismiss_time,comment,marked_by,method)
                         VALUES (?,?,?,?,?,?,?,?,?)
                         ON DUPLICATE KEY UPDATE status=VALUES(status),dismiss_time=VALUES(dismiss_time),comment=VALUES(comment),marked_by=VALUES(marked_by)',
                    [(int)$rec['student_id'],$classId,$termId,$date,$rec['status'],$rec['dismiss_time']??null,$rec['comment']??null,$by,$rec['method']??'manual']);
            }
            DB::conn()->commit();
            respond(['saved' => count($records)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    public static function summary(array $user): void {
        $studentId = (int)($_GET['student_id']??0);
        $termId    = (int)($_GET['term_id']??2);
        $rows = DB::query('SELECT status,COUNT(*) cnt FROM attendance WHERE student_id=? AND term_id=? GROUP BY status',[$studentId,$termId]);
        $result = array_fill_keys(['present','absent-excused','absent-unexcused','late','late-excused','early-dismissal'],0);
        foreach ($rows as $r) $result[$r['status']] = (int)$r['cnt'];
        respond($result);
    }

    // Manual per-term attendance totals (present / absent / days_opened) for a class,
    // used to fill the report card. Keyed by student_id for the entry grid.
    public static function summaryList(array $user): void {
        $classId = (int)($_GET['class_id']??0);
        $termId  = (int)($_GET['term_id']??0);
        if (!$classId || !$termId) respond(null,422,'class_id and term_id required');
        respond(DB::query(
            'SELECT asum.student_id, asum.present, asum.absent, asum.days_opened
             FROM attendance_summary asum JOIN students s ON s.id=asum.student_id
             WHERE s.class_id=? AND asum.term_id=?',
            [$classId,$termId]));
    }

    public static function saveSummary(array $user): void {
        $b = body();
        $classId = (int)($b['class_id']??0);
        $termId  = (int)($b['term_id']??0);
        $rows    = $b['records'] ?? [];
        if (!$termId) respond(null,422,'term_id required');
        Perm::assertManageClass($user, $classId);   // class teacher / admin only
        $num = fn($v) => ($v === '' || $v === null) ? null : max(0, (int)$v);
        DB::conn()->beginTransaction();
        try {
            foreach ($rows as $r) {
                DB::run('INSERT INTO attendance_summary (student_id,term_id,present,absent,days_opened) VALUES (?,?,?,?,?)
                         ON DUPLICATE KEY UPDATE present=VALUES(present),absent=VALUES(absent),days_opened=VALUES(days_opened),updated_at=NOW()',
                    [(int)$r['student_id'],$termId,$num($r['present']??null),$num($r['absent']??null),$num($r['days_opened']??null)]);
            }
            DB::conn()->commit();
            respond(['saved' => count($rows)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }
}

// ─── GradeController ──────────────────────────────────────────────────────────
class GradeController {
    public static function caTypes(array $user): void {
        respond(DB::query('SELECT * FROM ca_types WHERE school_id=? AND is_enabled=1 ORDER BY sort_order',[(int)$user['school_id']]));
    }

    public static function index(array $user): void {
        $studentId = (int)($_GET['student_id']??0);
        $termId    = (int)($_GET['term_id']??2);
        $classId   = (int)($_GET['class_id']??0);
        $subjectId = (int)($_GET['subject_id']??0);

        if ($studentId && $termId) {
            $rows = DB::query('SELECT g.*,sub.name AS subject_name,ct.label AS ca_label,ct.max_score FROM grades g JOIN subjects sub ON sub.id=g.subject_id JOIN ca_types ct ON ct.id=g.ca_type_id WHERE g.student_id=? AND g.term_id=?',[$studentId,$termId]);
            respond($rows);
        } elseif ($classId && $subjectId && $termId) {
            $rows = DB::query('SELECT g.*,u.first_name,u.last_name,s.student_id AS sid,ct.label FROM grades g JOIN students s ON s.id=g.student_id JOIN users u ON u.id=s.user_id JOIN ca_types ct ON ct.id=g.ca_type_id WHERE s.class_id=? AND g.subject_id=? AND g.term_id=? ORDER BY u.last_name',[$classId,$subjectId,$termId]);
            respond($rows);
        } else {
            respond([]);
        }
    }

    public static function bulk(array $user): void {
        $b = body();
        $grades = $b['grades'] ?? [];
        // A teacher may only enter grades for a subject they're assigned to teach in
        // the student's class (admins bypass). Validate all before writing any.
        foreach ($grades as $g) { Perm::assertTeachesGrade($user, (int)$g['student_id'], (int)$g['subject_id']); }
        DB::conn()->beginTransaction();
        try {
            foreach ($grades as $g) {
                DB::run('INSERT INTO grades (student_id,subject_id,term_id,ca_type_id,score,entered_by) VALUES (?,?,?,?,?,?)
                         ON DUPLICATE KEY UPDATE score=VALUES(score),entered_by=VALUES(entered_by),updated_at=NOW()',
                    [(int)$g['student_id'],(int)$g['subject_id'],(int)$g['term_id'],(int)$g['ca_type_id'],(float)$g['score'],(int)$user['id']]);
            }
            DB::conn()->commit();
            respond(['saved' => count($grades)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    public static function behaviour(array $user): void {
        $classId = (int)($_GET['class_id']??0);
        $termId  = (int)($_GET['term_id']??0);
        if (!$classId || !$termId) respond(null,422,'class_id and term_id required');
        respond(DB::query(
            'SELECT p.student_id, p.trait, p.rating, p.domain
             FROM psychomotor p JOIN students s ON s.id = p.student_id
             WHERE s.class_id = ? AND p.term_id = ?',
            [$classId, $termId]
        ));
    }

    public static function saveBehaviour(array $user): void {
        $records = body()['records'] ?? [];
        // Psychomotor / affective traits are set by the class teacher (or an admin).
        foreach ($records as $r) { Perm::assertManageStudent($user, (int)$r['student_id']); }
        DB::conn()->beginTransaction();
        try {
            foreach ($records as $r) {
                DB::run(
                    'INSERT INTO psychomotor (student_id,term_id,trait,rating,domain) VALUES (?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE rating=VALUES(rating)',
                    [(int)$r['student_id'],(int)$r['term_id'],$r['trait'],($r['rating'] ?? '') ?: null,$r['domain'] ?? 'psychomotor']
                );
            }
            DB::conn()->commit();
            respond(['saved' => count($records)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    public static function comments(array $user): void {
        $classId = (int)($_GET['class_id']??0);
        $termId  = (int)($_GET['term_id']??0);
        if (!$classId || !$termId) respond(null,422,'class_id and term_id required');
        respond(DB::query(
            'SELECT tc.student_id, tc.teacher_comment, tc.principal_comment
             FROM teacher_comments tc JOIN students s ON s.id = tc.student_id
             WHERE s.class_id = ? AND tc.term_id = ?',
            [$classId, $termId]
        ));
    }

    public static function saveComments(array $user): void {
        $items = body()['comments'] ?? [];
        // Only an admin or the class teacher of each student's class may set remarks.
        foreach ($items as $c) { Perm::assertManageStudent($user, (int)$c['student_id']); }
        DB::conn()->beginTransaction();
        try {
            foreach ($items as $c) {
                DB::run(
                    'INSERT INTO teacher_comments (student_id,term_id,teacher_comment,principal_comment) VALUES (?,?,?,?)
                     ON DUPLICATE KEY UPDATE teacher_comment=VALUES(teacher_comment),principal_comment=VALUES(principal_comment),updated_at=NOW()',
                    [(int)$c['student_id'],(int)$c['term_id'],$c['teacher_comment'] ?? null,$c['principal_comment'] ?? null]
                );
            }
            DB::conn()->commit();
            respond(['saved' => count($items)]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    // Letter grade from a percentage (0–100) — matches the report-card grading scale:
    // A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F 0–39.
    private static function gradeOf(float $pct): string {
        if ($pct >= 70) return 'A';
        if ($pct >= 60) return 'B';
        if ($pct >= 50) return 'C';
        if ($pct >= 45) return 'D';
        if ($pct >= 40) return 'E';
        return 'F';
    }

    public static function reportCard(array $user): void {
        $studentId = (int)($_GET['student_id']??0);
        $termId    = (int)($_GET['term_id']??2);
        if (!$studentId) respond(null,422,'student_id required');

        $student = DB::one('SELECT u.first_name,u.last_name,s.student_id AS sid,s.class_id,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.id=?',[$studentId]);
        if (!$student) respond(null,404,'Student not found');
        $classId = (int)$student['class_id'];

        $school = DB::one('SELECT name,address,phone,email,logo_url,motto FROM schools WHERE id=?',[(int)$user['school_id']]);
        $term   = DB::one('SELECT t.name,t.start_date,t.end_date,ay.name AS year FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id WHERE t.id=?',[$termId]);

        // Which CA components count as the "exam" portion (label contains "exam")?
        $caTypes = DB::query('SELECT id,label,max_score FROM ca_types WHERE school_id=? AND is_enabled=1',[(int)$user['school_id']]);
        $examIds = [];
        foreach ($caTypes as $ct) { if (stripos($ct['label'],'exam') !== false) $examIds[(int)$ct['id']] = true; }

        // Every grade row for the WHOLE class this term — needed to rank positions & find class hi/lo.
        $rows = DB::query(
            'SELECT g.student_id, g.subject_id, sub.name AS subject, g.ca_type_id, g.score
             FROM grades g
             JOIN students s ON s.id = g.student_id
             JOIN subjects sub ON sub.id = g.subject_id
             WHERE s.class_id = ? AND g.term_id = ? AND s.deleted_at IS NULL',
            [$classId, $termId]
        );

        // Aggregate per student → per subject into CA / exam buckets.
        $agg = []; $subjectNames = [];
        foreach ($rows as $r) {
            $st = (int)$r['student_id']; $su = (int)$r['subject_id']; $sc = (float)$r['score'];
            $subjectNames[$su] = $r['subject'];
            if (!isset($agg[$st][$su])) $agg[$st][$su] = ['ca'=>0.0,'exam'=>0.0];
            if (isset($examIds[(int)$r['ca_type_id']])) $agg[$st][$su]['exam'] += $sc;
            else                                        $agg[$st][$su]['ca']   += $sc;
        }

        // Per-subject totals across the class: subjTotals[subjectId][studentId] = total.
        $subjTotals = [];
        foreach ($agg as $st => $subs) {
            foreach ($subs as $su => $v) { $subjTotals[$su][$st] = $v['ca'] + $v['exam']; }
        }

        // This student's per-subject row with position + class hi/lo.
        $subjects = [];
        foreach (($agg[$studentId] ?? []) as $su => $v) {
            $total = $v['ca'] + $v['exam'];
            $all   = array_values($subjTotals[$su]);
            $position = 1; foreach ($all as $t) { if ($t > $total) $position++; }
            $subjects[] = [
                'subject'  => $subjectNames[$su],
                'ca'       => round($v['ca'], 2),
                'exam'     => round($v['exam'], 2),
                'total'    => round($total, 2),
                'grade'    => self::gradeOf($total), // subject total is out of 100 ⇒ already a %
                'position' => $position,
                'highest'  => round(max($all), 2),
                'lowest'   => round(min($all), 2),
            ];
        }
        usort($subjects, fn($a,$b) => strcmp($a['subject'], $b['subject']));

        // Overall: sum each student's subject totals, rank, and express hi/lo as %.
        $distinctSubjects = count($subjTotals);
        $possibleMax = $distinctSubjects * 100;
        $overallTotals = [];
        foreach ($agg as $st => $subs) {
            $sum = 0.0; foreach ($subs as $v) { $sum += $v['ca'] + $v['exam']; }
            $overallTotals[$st] = $sum;
        }
        $myOverall  = $overallTotals[$studentId] ?? 0.0;
        $overallPct = $possibleMax > 0 ? ($myOverall / $possibleMax) * 100 : 0;
        $overallPos = 1; foreach ($overallTotals as $t) { if ($t > $myOverall) $overallPos++; }
        $classHigh  = $overallTotals ? max($overallTotals) : 0;
        $classLow   = $overallTotals ? min($overallTotals) : 0;
        $overall = [
            'total'         => round($myOverall, 2),
            'max'           => $possibleMax,
            'percentage'    => round($overallPct, 2),
            'grade'         => self::gradeOf($overallPct),
            'position'      => $overallPos,
            'class_highest' => $possibleMax > 0 ? round(($classHigh / $possibleMax) * 100, 2) : 0,
            'class_lowest'  => $possibleMax > 0 ? round(($classLow  / $possibleMax) * 100, 2) : 0,
        ];

        $classSize = (int)(DB::one('SELECT COUNT(*) c FROM students WHERE class_id=? AND deleted_at IS NULL',[$classId])['c'] ?? 0);

        // Behavioural records (affective + psychomotor), with a numeric /5 score.
        $ratingScore = ['Excellent'=>5,'Very Good'=>4,'Good'=>3,'Fair'=>2,'Poor'=>1];
        $brows = DB::query('SELECT trait,rating,domain FROM psychomotor WHERE student_id=? AND term_id=? ORDER BY domain,trait',[$studentId,$termId]);
        $behaviour = array_map(fn($b) => [
            'trait'  => $b['trait'],
            'rating' => $b['rating'],
            'score'  => $ratingScore[$b['rating']] ?? null,
            'domain' => $b['domain'],
        ], $brows);

        // Attendance for the term. A teacher-entered summary (present / absent /
        // days the school opened) takes precedence; otherwise derive from the
        // daily attendance records.
        $sum = DB::one('SELECT present,absent,days_opened FROM attendance_summary WHERE student_id=? AND term_id=?',[$studentId,$termId]);
        if ($sum && ($sum['present'] !== null || $sum['absent'] !== null || $sum['days_opened'] !== null)) {
            $present = (int)($sum['present'] ?? 0);
            $absent  = (int)($sum['absent'] ?? 0);
            $opened  = $sum['days_opened'] !== null ? (int)$sum['days_opened'] : ($present + $absent);
            $attendance = [
                'total_days' => $opened,
                'present'    => $present,
                'absent'     => $absent,
                'percentage' => $opened > 0 ? round(($present / $opened) * 100, 2) : 0,
            ];
        } else {
            $att = DB::one("SELECT COUNT(*) total, SUM(status='present') present, SUM(status LIKE 'absent%') absent FROM attendance WHERE student_id=? AND term_id=?",[$studentId,$termId]);
            $attTotal = (int)($att['total'] ?? 0); $attPresent = (int)($att['present'] ?? 0);
            $attendance = [
                'total_days' => $attTotal,
                'present'    => $attPresent,
                'absent'     => (int)($att['absent'] ?? 0),
                'percentage' => $attTotal > 0 ? round(($attPresent / $attTotal) * 100, 2) : 0,
            ];
        }

        // Manual comments (if a teacher typed them) take precedence; otherwise fall
        // back to the admin-defined remark band for this overall percentage.
        $comments = DB::one('SELECT teacher_comment,principal_comment FROM teacher_comments WHERE student_id=? AND term_id=?',[$studentId,$termId]) ?? [];
        $schoolId      = (int)$user['school_id'];
        $autoTeacher   = RemarkController::remarkFor($schoolId, $classId, 'class_teacher', (float)$overallPct);
        $autoPrincipal = RemarkController::remarkFor($schoolId, $classId, 'head_teacher',  (float)$overallPct);
        $comments['teacher_comment']   = !empty($comments['teacher_comment'])   ? $comments['teacher_comment']   : $autoTeacher;
        $comments['principal_comment'] = !empty($comments['principal_comment']) ? $comments['principal_comment'] : $autoPrincipal;

        respond([
            'school'     => $school,
            'term'       => $term,
            'student'    => [
                'name'       => trim($student['first_name'].' '.$student['last_name']),
                'sid'        => $student['sid'],
                'class_name' => $student['class_name'],
            ],
            'class_size' => $classSize,
            'subjects'   => $subjects,
            'overall'    => $overall,
            'behaviour'  => $behaviour,
            'attendance' => $attendance,
            'comments'   => $comments,
        ]);
    }

    public static function cumulative(array $user): void {
        $studentId = (int)($_GET['student_id']??0);
        $terms     = array_values(array_filter(array_map('intval', explode(',', $_GET['term_ids']??'1,2'))));
        if (!$studentId || !$terms) respond(null,422,'student_id and term_ids required');

        $student = DB::one('SELECT u.first_name,u.last_name,s.student_id AS sid,s.class_id,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.id=?',[$studentId]);
        if (!$student) respond(null,404,'Student not found');
        $classId = (int)$student['class_id'];
        $school  = DB::one('SELECT name,address,phone,email,logo_url,motto FROM schools WHERE id=?',[(int)$user['school_id']]);

        $ph = implode(',', array_fill(0, count($terms), '?'));
        $order = implode(',', $terms);
        $termRows = DB::query("SELECT id,name FROM terms WHERE id IN($ph) ORDER BY FIELD(id,$order)", $terms);

        // All grades for the class across the selected terms.
        $rows = DB::query(
            "SELECT g.student_id, g.subject_id, sub.name AS subject, g.term_id, g.score
             FROM grades g
             JOIN students s ON s.id = g.student_id
             JOIN subjects sub ON sub.id = g.subject_id
             WHERE s.class_id = ? AND g.term_id IN($ph) AND s.deleted_at IS NULL",
            array_merge([$classId], $terms)
        );

        // agg[studentId][termId][subjectId] = subject total for that term.
        $agg = []; $subjectNames = []; $distinctSubjects = [];
        foreach ($rows as $r) {
            $st=(int)$r['student_id']; $tm=(int)$r['term_id']; $su=(int)$r['subject_id'];
            $subjectNames[$su] = $r['subject']; $distinctSubjects[$su] = true;
            $agg[$st][$tm][$su] = ($agg[$st][$tm][$su] ?? 0) + (float)$r['score'];
        }

        // Each student's average term-percentage across the selected terms (for ranking).
        $studentAvgPct = [];
        foreach ($agg as $st => $termsData) {
            $termPcts = [];
            foreach ($terms as $tm) {
                if (empty($termsData[$tm])) continue;
                $sum = array_sum($termsData[$tm]);
                $possible = count($termsData[$tm]) * 100;
                if ($possible > 0) $termPcts[] = ($sum / $possible) * 100;
            }
            $studentAvgPct[$st] = $termPcts ? array_sum($termPcts) / count($termPcts) : 0;
        }

        // This student's per-subject breakdown across terms.
        $subjects = [];
        foreach (array_keys($distinctSubjects) as $su) {
            $perTerm = []; $vals = [];
            foreach ($terms as $tm) {
                $val = $agg[$studentId][$tm][$su] ?? null;
                $perTerm[$tm] = $val !== null ? round($val, 2) : null;
                if ($val !== null) $vals[] = $val;
            }
            if (!$vals) continue;
            $avg = array_sum($vals) / count($vals);
            $subjects[] = [
                'subject'  => $subjectNames[$su],
                'per_term' => $perTerm,
                'average'  => round($avg, 2),
                'grade'    => self::gradeOf($avg),
            ];
        }
        usort($subjects, fn($a,$b) => strcmp($a['subject'], $b['subject']));

        $myAvg = $studentAvgPct[$studentId] ?? 0;
        $pos = 1; foreach ($studentAvgPct as $v) { if ($v > $myAvg) $pos++; }

        respond([
            'school'   => $school,
            'student'  => [
                'name'       => trim($student['first_name'].' '.$student['last_name']),
                'sid'        => $student['sid'],
                'class_name' => $student['class_name'],
            ],
            'terms'    => $termRows,
            'subjects' => $subjects,
            'overall'  => [
                'average'    => round($myAvg, 2),
                'grade'      => self::gradeOf($myAvg),
                'position'   => $pos,
                'class_size' => count($studentAvgPct),
            ],
        ]);
    }
}

// ─── Perm ─────────────────────────────────────────────────────────────────────
// Shared authorisation helpers. Admins (super_admin / school_admin) may manage
// anything in their school; a teacher may manage only the class they are mapped
// to as form/class teacher (classes.form_teacher_id).
class Perm {
    public static function isAdmin(array $user): bool {
        return in_array($user['role'] ?? '', ['super_admin', 'school_admin'], true);
    }

    public static function canManageClass(array $user, ?int $classId): bool {
        if (self::isAdmin($user)) return true;
        if (!$classId) return false;               // only admins manage the school-wide default
        return (bool)DB::one('SELECT id FROM classes WHERE id=? AND school_id=? AND form_teacher_id=?',
            [$classId, (int)$user['school_id'], (int)$user['id']]);
    }

    public static function assertManageClass(array $user, ?int $classId): void {
        if (!self::canManageClass($user, $classId)) {
            respond(null, 403, 'Only an administrator or this class\'s teacher may modify these remarks.');
        }
    }

    // Permission to edit a specific student's custom remark / behaviour traits
    // (resolved via their class — the class teacher, or an admin).
    public static function assertManageStudent(array $user, int $studentId): void {
        if (self::isAdmin($user)) return;
        $row = DB::one('SELECT class_id FROM students WHERE id=?', [$studentId]);
        self::assertManageClass($user, $row ? (int)$row['class_id'] : null);
    }

    // Does this user teach $subjectId in $classId? (class_subjects.teacher_id)
    public static function teachesSubjectInClass(array $user, int $classId, int $subjectId): bool {
        if (self::isAdmin($user)) return true;
        return (bool)DB::one('SELECT id FROM class_subjects WHERE class_id=? AND subject_id=? AND teacher_id=?',
            [$classId, $subjectId, (int)$user['id']]);
    }

    // Permission to enter a grade: user must teach that subject in the student's class.
    public static function assertTeachesGrade(array $user, int $studentId, int $subjectId): void {
        if (self::isAdmin($user)) return;
        $s = DB::one('SELECT class_id FROM students WHERE id=?', [$studentId]);
        if (!$s || !self::teachesSubjectInClass($user, (int)$s['class_id'], $subjectId)) {
            respond(null, 403, 'You are not assigned to teach this subject in this student\'s class.');
        }
    }
}

// ─── RemarkController ─────────────────────────────────────────────────────────
// Report-card remark bands. Each row maps an overall-% range to a Class Teacher's
// or Head Teacher's remark. A row's scope is either school-wide (class_id NULL) or
// a specific class; class-specific bands take precedence on a report card.
class RemarkController {
    private const TYPES = ['class_teacher', 'head_teacher'];

    // Normalise an incoming class_id: 0/""/"null"/absent => NULL (school-wide).
    private static function scopeOf($raw): ?int {
        if ($raw === null || $raw === '' || $raw === 'null' || (int)$raw === 0) return null;
        return (int)$raw;
    }

    public static function index(array $user): void {
        $sid     = (int)$user['school_id'];
        $type    = $_GET['type'] ?? '';
        $classId = self::scopeOf($_GET['class_id'] ?? null);
        $where   = ['school_id = ?']; $params = [$sid];
        $where[] = $classId === null ? 'class_id IS NULL' : 'class_id = ?';
        if ($classId !== null) $params[] = $classId;
        if (in_array($type, self::TYPES, true)) { $where[] = 'remark_type = ?'; $params[] = $type; }
        respond(DB::query('SELECT * FROM remark_ranges WHERE ' . implode(' AND ', $where) . ' ORDER BY remark_type, min_score DESC', $params));
    }

    public static function store(array $user): void {
        $b       = body();
        $type    = $b['remark_type'] ?? '';
        $classId = self::scopeOf($b['class_id'] ?? null);
        Perm::assertManageClass($user, $classId);
        if (!in_array($type, self::TYPES, true)) respond(null, 422, 'remark_type must be class_teacher or head_teacher');
        $min = (float)($b['min_score'] ?? 0);
        $max = (float)($b['max_score'] ?? 0);
        if ($max < $min) respond(null, 422, 'max_score must be greater than or equal to min_score');
        $id = DB::exec('INSERT INTO remark_ranges (school_id,class_id,remark_type,min_score,max_score,remark) VALUES (?,?,?,?,?,?)',
            [(int)$user['school_id'], $classId, $type, $min, $max, trim((string)($b['remark'] ?? ''))]);
        respond(['id' => $id], 201, 'Remark range created');
    }

    public static function update(array $user, int $id): void {
        $b   = body();
        $row = DB::one('SELECT id, class_id FROM remark_ranges WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        if (!$row) respond(null, 404, 'Remark range not found');
        Perm::assertManageClass($user, $row['class_id'] !== null ? (int)$row['class_id'] : null);
        if (isset($b['remark_type']) && !in_array($b['remark_type'], self::TYPES, true)) respond(null, 422, 'invalid remark_type');
        DB::run('UPDATE remark_ranges SET remark_type=COALESCE(?,remark_type),min_score=COALESCE(?,min_score),max_score=COALESCE(?,max_score),remark=COALESCE(?,remark),updated_at=NOW() WHERE id=?',
            [$b['remark_type'] ?? null,
             isset($b['min_score']) ? (float)$b['min_score'] : null,
             isset($b['max_score']) ? (float)$b['max_score'] : null,
             isset($b['remark'])    ? trim((string)$b['remark']) : null,
             $id]);
        respond(['updated' => true]);
    }

    public static function destroy(array $user, int $id): void {
        $row = DB::one('SELECT id, class_id FROM remark_ranges WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        if (!$row) respond(null, 404, 'Remark range not found');
        Perm::assertManageClass($user, $row['class_id'] !== null ? (int)$row['class_id'] : null);
        DB::run('DELETE FROM remark_ranges WHERE id=?', [$id]);
        respond(['deleted' => true]);
    }

    // Resolve the remark for a percentage & type, preferring the class-specific
    // band over the school-wide default (null if no band matches).
    public static function remarkFor(int $schoolId, ?int $classId, string $type, float $pct): ?string {
        $row = DB::one(
            'SELECT remark FROM remark_ranges
             WHERE school_id=? AND remark_type=? AND ? >= min_score AND ? <= max_score
               AND (class_id = ? OR class_id IS NULL)
             ORDER BY (class_id IS NULL) ASC, min_score DESC
             LIMIT 1',
            [$schoolId, $type, $pct, $pct, $classId]);
        return $row['remark'] ?? null;
    }
}

// ─── FeeController ────────────────────────────────────────────────────────────
class FeeController {
    public static function invoices(array $user): void {
        $sid = (int)$user['school_id'];
        $studentId = (int)($_GET['student_id']??0);
        $sql = 'SELECT i.*,u.first_name,u.last_name,s.student_id AS sid,c.name AS class_name,t.name AS term_name FROM invoices i JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id JOIN terms t ON t.id=i.term_id WHERE u.school_id=?';
        $params = [$sid];
        if ($studentId) { $sql.=' AND i.student_id=?'; $params[]=$studentId; }
        $sql.=' ORDER BY i.created_at DESC';
        respond(DB::query($sql,$params));
    }

    public static function recordPayment(array $user): void {
        $b = body();
        DB::conn()->beginTransaction();
        try {
            DB::exec('INSERT INTO payments (invoice_id,amount,method,reference,received_by,payment_date,notes) VALUES (?,?,?,?,?,?,?)',
                [(int)$b['invoice_id'],(float)$b['amount'],$b['method']??'cash',$b['reference']??null,(int)$user['id'],$b['payment_date']??date('Y-m-d'),$b['notes']??null]);
            DB::run('UPDATE invoices SET amount_paid=amount_paid+?,status=CASE WHEN amount_paid+?>=total_amount THEN "paid" WHEN amount_paid+?>0 THEN "partial" ELSE "unpaid" END,updated_at=NOW() WHERE id=?',
                [(float)$b['amount'],(float)$b['amount'],(float)$b['amount'],(int)$b['invoice_id']]);
            DB::conn()->commit();
            respond(['recorded'=>true]);
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
    }

    public static function expenses(array $user): void {
        respond(DB::query('SELECT * FROM expenses WHERE school_id=? ORDER BY expense_date DESC',[(int)$user['school_id']]));
    }

    public static function addExpense(array $user): void {
        $b = body();
        $id = DB::exec('INSERT INTO expenses (school_id,description,category,amount,expense_date,recorded_by,status) VALUES (?,?,?,?,?,?,?)',
            [(int)$user['school_id'],$b['description'],$b['category'],(float)$b['amount'],$b['expense_date']??date('Y-m-d'),(int)$user['id'],$b['status']??'paid']);
        respond(['id'=>$id],201);
    }

    public static function payroll(array $user): void {
        $month = (int)($_GET['month']??date('n'));
        $year  = (int)($_GET['year'] ??date('Y'));
        respond(DB::query('SELECT p.*,u.first_name,u.last_name,s.staff_id,s.department,s.designation FROM payroll p JOIN staff s ON s.id=p.staff_id JOIN users u ON u.id=s.user_id WHERE p.month=? AND p.year=? AND u.school_id=? ORDER BY u.last_name',[$month,$year,(int)$user['school_id']]));
    }

    public static function summary(array $user): void {
        $sid = (int)$user['school_id'];
        $termId = (int)($_GET['term_id']??2);
        respond([
            'total_invoiced'   => (float)(DB::one('SELECT COALESCE(SUM(i.total_amount),0) t FROM invoices i JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND i.term_id=?',[$sid,$termId])['t']??0),
            'total_collected'  => (float)(DB::one('SELECT COALESCE(SUM(i.amount_paid),0) t FROM invoices i JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND i.term_id=?',[$sid,$termId])['t']??0),
            'total_expenses'   => (float)(DB::one('SELECT COALESCE(SUM(amount),0) t FROM expenses WHERE school_id=?',[$sid])['t']??0),
            'total_payroll'    => (float)(DB::one('SELECT COALESCE(SUM(net_pay),0) t FROM payroll p JOIN staff s ON s.id=p.staff_id JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND p.month=MONTH(NOW()) AND p.year=YEAR(NOW())',[$sid])['t']??0),
        ]);
    }
}

// ─── TimetableController ──────────────────────────────────────────────────────
class TimetableController {
    public static function index(array $user): void {
        $classId = (int)($_GET['class_id']??0);
        $termId  = (int)($_GET['term_id']??2);
        if (!$classId) respond(null,422,'class_id required');
        respond(DB::query('SELECT ts.*,sub.name AS subject_name,u.first_name,u.last_name FROM timetable_slots ts JOIN subjects sub ON sub.id=ts.subject_id LEFT JOIN users u ON u.id=ts.teacher_id WHERE ts.class_id=? AND ts.term_id=? ORDER BY FIELD(ts.day,"Monday","Tuesday","Wednesday","Thursday","Friday"),ts.period',[$classId,$termId]));
    }

    public static function save(array $user): void {
        $b = body();
        $slots  = $b['slots']   ?? [];
        $classId= (int)($b['class_id']??0);
        $termId = (int)($b['term_id']??2);
        DB::run('DELETE FROM timetable_slots WHERE class_id=? AND term_id=?',[$classId,$termId]);
        foreach ($slots as $s) {
            DB::exec('INSERT INTO timetable_slots (class_id,subject_id,teacher_id,day,period,start_time,end_time,term_id) VALUES (?,?,?,?,?,?,?,?)',
                [$classId,(int)$s['subject_id'],$s['teacher_id']??null,$s['day'],(int)$s['period'],$s['start_time'],$s['end_time'],$termId]);
        }
        respond(['saved'=>count($slots)]);
    }
}

// ─── ExamController ───────────────────────────────────────────────────────────
class ExamController {
    public static function index(array $user): void {
        respond(DB::query('SELECT e.*,c.name AS class_name,sub.name AS subject_name,t.name AS term_name FROM exams e JOIN classes c ON c.id=e.class_id JOIN subjects sub ON sub.id=e.subject_id JOIN terms t ON t.id=e.term_id WHERE e.school_id=? ORDER BY e.created_at DESC',[(int)$user['school_id']]));
    }

    public static function show(array $user, int $id): void {
        $exam = DB::one('SELECT * FROM exams WHERE id=? AND school_id=?',[$id,(int)$user['school_id']]);
        if (!$exam) respond(null,404,'Exam not found');
        $exam['questions'] = DB::query('SELECT * FROM exam_questions WHERE exam_id=? ORDER BY sort_order',[$id]);
        respond($exam);
    }

    public static function store(array $user): void {
        $b = body();
        $id = DB::exec('INSERT INTO exams (school_id,class_id,subject_id,term_id,title,exam_type,duration,total_marks,pass_mark,status,shuffle_q,shuffle_opts,show_score,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [(int)$user['school_id'],(int)$b['class_id'],(int)$b['subject_id'],(int)$b['term_id'],$b['title'],$b['exam_type']??'mid-term',(int)($b['duration']??60),(int)($b['total_marks']??100),(int)($b['pass_mark']??50),$b['status']??'draft',(int)($b['shuffle_q']??1),(int)($b['shuffle_opts']??1),(int)($b['show_score']??0),(int)$user['id']]);
        if (!empty($b['questions'])) {
            foreach ($b['questions'] as $i=>$q) {
                DB::exec('INSERT INTO exam_questions (exam_id,type,question,options,answer,marks,sort_order) VALUES (?,?,?,?,?,?,?)',
                    [$id,$q['type'],$q['question'],json_encode($q['options']??null),$q['answer'],(int)($q['marks']??2),$i]);
            }
        }
        respond(['id'=>$id],201,'Exam created');
    }

    public static function update(array $user, int $id): void {
        $b = body();
        // results_released lets a teacher reveal scores for a show_score=0 exam.
        DB::run('UPDATE exams SET title=COALESCE(?,title),status=COALESCE(?,status),duration=COALESCE(?,duration),
                    show_score=COALESCE(?,show_score),results_released=COALESCE(?,results_released) WHERE id=? AND school_id=?',
            [$b['title']??null,$b['status']??null,$b['duration']??null,
             isset($b['show_score'])?(int)$b['show_score']:null, isset($b['results_released'])?(int)$b['results_released']:null,
             $id,(int)$user['school_id']]);
        respond(['updated'=>true]);
    }

    public static function submit(array $user): void {
        $b = body();
        DB::exec('INSERT INTO exam_submissions (exam_id,student_id,answers,submitted_at,time_taken) VALUES (?,?,?,NOW(),?) ON DUPLICATE KEY UPDATE answers=VALUES(answers),submitted_at=NOW()',
            [(int)$b['exam_id'],(int)$b['student_id'],json_encode($b['answers']??[]),(int)($b['time_taken']??0)]);
        respond(['submitted'=>true]);
    }

    // Delete an exam (admin only) and its questions + submissions.
    public static function destroy(array $user, int $id): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can delete exams.');
        $exam = DB::one('SELECT id FROM exams WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        if (!$exam) respond(null, 404, 'Exam not found');
        DB::conn()->beginTransaction();
        try {
            DB::run('DELETE FROM exam_submissions WHERE exam_id=?', [$id]);   // no cascade on this FK
            DB::run('DELETE FROM exam_questions  WHERE exam_id=?', [$id]);
            DB::run('DELETE FROM exams WHERE id=?', [$id]);
            DB::conn()->commit();
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
        respond(['deleted' => true]);
    }

    // Append questions (e.g. from the AI generator) to an existing exam, continuing
    // the sort order, then keep total_marks in sync with the question marks.
    public static function addQuestions(array $user, int $id): void {
        $exam = DB::one('SELECT id FROM exams WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        if (!$exam) respond(null, 404, 'Exam not found');
        $qs = body()['questions'] ?? [];
        if (!$qs) respond(null, 422, 'No questions provided');

        $allowed = ['mcq','short','essay','tf','fill'];
        $next = (int)(DB::one('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM exam_questions WHERE exam_id=?', [$id])['n'] ?? 0);
        DB::conn()->beginTransaction();
        try {
            foreach ($qs as $q) {
                $type = in_array(($q['type'] ?? ''), $allowed, true) ? $q['type'] : (isset($q['options']) ? 'mcq' : 'short');
                DB::exec('INSERT INTO exam_questions (exam_id,type,question,options,answer,marks,sort_order) VALUES (?,?,?,?,?,?,?)',
                    [$id, $type, (string)($q['question'] ?? ''), isset($q['options']) ? json_encode($q['options']) : null,
                     isset($q['answer']) ? (string)$q['answer'] : null, (int)($q['marks'] ?? 2), $next++]);
            }
            DB::run('UPDATE exams SET total_marks=(SELECT COALESCE(SUM(marks),0) FROM exam_questions WHERE exam_id=?) WHERE id=?', [$id, $id]);
            DB::conn()->commit();
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
        respond(['added' => count($qs)]);
    }
}

// ─── InventoryController ──────────────────────────────────────────────────────
class InventoryController {
    public static function index(array $user): void {
        $cat = $_GET['category']??'';
        $sql = 'SELECT *,CASE WHEN qty <= min_qty*0.5 THEN "critical" WHEN qty <= min_qty THEN "low" ELSE "ok" END AS status FROM inventory_items WHERE school_id=? AND deleted_at IS NULL';
        $params = [(int)$user['school_id']];
        if ($cat) { $sql.=' AND category=?'; $params[]=$cat; }
        respond(DB::query($sql.' ORDER BY name',$params));
    }

    public static function store(array $user): void {
        $b = body();
        $code = strtoupper(substr(preg_replace('/[^A-Z0-9]/i','',($b['name']??'ITEM')),0,3)) . rand(100,999);
        $id = DB::exec('INSERT INTO inventory_items (school_id,item_code,name,category,unit,qty,min_qty,unit_cost,location,supplier,last_restocked) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [(int)$user['school_id'],$code,$b['name'],$b['category']??'other',$b['unit']??'Pcs',(int)($b['qty']??0),(int)($b['min_qty']??0),(float)($b['unit_cost']??0),$b['location']??null,$b['supplier']??null,date('Y-m-d')]);
        respond(['id'=>$id,'item_code'=>$code],201);
    }

    public static function issue(array $user): void {
        $b = body();
        $qty = (int)($b['qty']??0);
        if ($qty<=0) respond(null,422,'Quantity must be > 0');
        $item = DB::one('SELECT * FROM inventory_items WHERE id=? AND school_id=?',[(int)$b['item_id'],(int)$user['school_id']]);
        if (!$item) respond(null,404,'Item not found');
        if ($item['qty'] < $qty) respond(null,422,'Insufficient stock');
        DB::run('UPDATE inventory_items SET qty=qty-?,updated_at=NOW() WHERE id=?',[$qty,$item['id']]);
        DB::exec('INSERT INTO inventory_transactions (item_id,type,qty,issued_to,purpose,done_by) VALUES (?,?,?,?,?,?)',
            [$item['id'],'issue',$qty,$b['issued_to']??null,$b['purpose']??null,(int)$user['id']]);
        respond(['remaining'=>$item['qty']-$qty]);
    }

    public static function restock(array $user): void {
        $b = body();
        $qty = (int)($b['qty']??0);
        if ($qty<=0) respond(null,422,'Quantity must be > 0');
        $item = DB::one('SELECT * FROM inventory_items WHERE id=? AND school_id=?',[(int)$b['item_id'],(int)$user['school_id']]);
        if (!$item) respond(null,404,'Item not found');
        DB::run('UPDATE inventory_items SET qty=qty+?,last_restocked=?,updated_at=NOW() WHERE id=?',[$qty,date('Y-m-d'),$item['id']]);
        DB::exec('INSERT INTO inventory_transactions (item_id,type,qty,reference,done_by) VALUES (?,?,?,?,?)',
            [$item['id'],'restock',$qty,$b['reference']??null,(int)$user['id']]);
        respond(['new_qty'=>$item['qty']+$qty]);
    }

    public static function transactions(array $user): void {
        $itemId = (int)($_GET['item_id']??0);
        $sql = 'SELECT it.*,ii.name AS item_name,u.first_name,u.last_name FROM inventory_transactions it JOIN inventory_items ii ON ii.id=it.item_id LEFT JOIN users u ON u.id=it.done_by WHERE ii.school_id=?';
        $params = [(int)$user['school_id']];
        if ($itemId) { $sql.=' AND it.item_id=?'; $params[]=$itemId; }
        respond(DB::query($sql.' ORDER BY it.created_at DESC LIMIT 50',$params));
    }
}

// ─── HostelController ─────────────────────────────────────────────────────────
class HostelController {
    public static function index(array $user): void {
        $rows = DB::query('SELECT h.*,u.first_name,u.last_name,(SELECT COUNT(*) FROM hostel_rooms WHERE hostel_id=h.id) AS room_count,(SELECT COUNT(*) FROM hostel_allocations ha JOIN hostel_rooms hr ON hr.id=ha.room_id WHERE hr.hostel_id=h.id AND ha.term_id=2) AS occupied FROM hostels h LEFT JOIN users u ON u.id=h.matron_id WHERE h.school_id=?',[(int)$user['school_id']]);
        respond($rows);
    }

    public static function rooms(array $user): void {
        $hostelId = (int)($_GET['hostel_id']??0);
        $termId   = (int)($_GET['term_id']??2);
        $rooms = DB::query('SELECT hr.*,(SELECT COUNT(*) FROM hostel_allocations WHERE room_id=hr.id AND term_id=?) AS occupied FROM hostel_rooms hr WHERE hr.hostel_id=? ORDER BY hr.room_no',[$termId,$hostelId]);
        foreach ($rooms as &$r) {
            $r['students'] = DB::query('SELECT s.id,s.student_id,u.first_name,u.last_name FROM hostel_allocations ha JOIN students s ON s.id=ha.student_id JOIN users u ON u.id=s.user_id WHERE ha.room_id=? AND ha.term_id=?',[(int)$r['id'],$termId]);
        }
        respond($rooms);
    }

    public static function allocate(array $user): void {
        $b = body();
        DB::exec('INSERT INTO hostel_allocations (room_id,student_id,term_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE room_id=VALUES(room_id)',
            [(int)$b['room_id'],(int)$b['student_id'],(int)($b['term_id']??2)]);
        respond(['allocated'=>true]);
    }

    public static function visitors(array $user): void {
        respond(DB::query('SELECT hv.*,u.first_name,u.last_name,s.student_id AS sid FROM hostel_visitors hv JOIN students s ON s.id=hv.student_id JOIN users u ON u.id=s.user_id WHERE u.school_id=? ORDER BY hv.time_in DESC LIMIT 50',[(int)$user['school_id']]));
    }

    public static function logVisitor(array $user): void {
        $b = body();
        $id = DB::exec('INSERT INTO hostel_visitors (student_id,visitor_name,relation,purpose,time_in,logged_by) VALUES (?,?,?,?,NOW(),?)',
            [(int)$b['student_id'],$b['visitor_name'],$b['relation']??null,$b['purpose']??null,(int)$user['id']]);
        respond(['id'=>$id],201);
    }
}

// ─── LibraryController ────────────────────────────────────────────────────────
class LibraryController {
    public static function books(array $user): void {
        respond(DB::query('SELECT * FROM library_books WHERE school_id=? ORDER BY title',[(int)$user['school_id']]));
    }

    public static function loans(array $user): void {
        respond(DB::query('SELECT bl.*,lb.title,lb.author,u.first_name,u.last_name,s.student_id AS sid FROM book_loans bl JOIN library_books lb ON lb.id=bl.book_id JOIN students s ON s.id=bl.student_id JOIN users u ON u.id=s.user_id WHERE lb.school_id=? ORDER BY bl.issued_at DESC',[(int)$user['school_id']]));
    }

    public static function issue(array $user): void {
        $b = body();
        $book = DB::one('SELECT * FROM library_books WHERE id=?',[(int)$b['book_id']]);
        if (!$book||$book['available']<1) respond(null,422,'Book not available');
        DB::exec('INSERT INTO book_loans (book_id,student_id,issued_at,due_date) VALUES (?,?,CURDATE(),?)',
            [(int)$b['book_id'],(int)$b['student_id'],$b['due_date']??date('Y-m-d',strtotime('+14 days'))]);
        DB::run('UPDATE library_books SET available=available-1 WHERE id=?',[(int)$b['book_id']]);
        respond(['issued'=>true]);
    }

    public static function returnBook(array $user): void {
        $b = body();
        $loan = DB::one('SELECT * FROM book_loans WHERE id=?',[(int)$b['loan_id']]);
        if (!$loan) respond(null,404,'Loan not found');
        $fine = 0;
        if (strtotime(date('Y-m-d')) > strtotime($loan['due_date'])) {
            $days = (int)ceil((time()-strtotime($loan['due_date']))/86400);
            $fine = $days * 50; // ₦50/day fine
        }
        DB::run('UPDATE book_loans SET returned_at=CURDATE(),fine=? WHERE id=?',[$fine,$loan['id']]);
        DB::run('UPDATE library_books SET available=available+1 WHERE id=?',[$loan['book_id']]);
        respond(['returned'=>true,'fine'=>$fine]);
    }
}

// ─── MessagingController ──────────────────────────────────────────────────────
class MessagingController {
    public static function index(array $user): void {
        $uid = (int)$user['id'];
        $sent = DB::query('SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.sender_id=? ORDER BY m.created_at DESC LIMIT 30',[$uid]);
        $received = DB::query('SELECT m.*,u.first_name,u.last_name,mr.is_read FROM messages m JOIN users u ON u.id=m.sender_id JOIN message_recipients mr ON mr.message_id=m.id WHERE mr.recipient_id=? ORDER BY m.created_at DESC LIMIT 30',[$uid]);
        respond(['sent'=>$sent,'received'=>$received]);
    }

    public static function send(array $user): void {
        $b = body();
        $id = DB::exec('INSERT INTO messages (school_id,sender_id,subject,body,type) VALUES (?,?,?,?,?)',
            [(int)$user['school_id'],(int)$user['id'],$b['subject']??null,$b['body'],$b['type']??'direct']);
        foreach ((array)($b['recipient_ids']??[]) as $rid) {
            DB::exec('INSERT INTO message_recipients (message_id,recipient_id) VALUES (?,?)',[$id,(int)$rid]);
        }
        respond(['id'=>$id],201,'Message sent');
    }

    public static function notifications(array $user): void {
        respond(DB::query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20',[(int)$user['id']]));
    }
}

// ─── AdmissionController ─────────────────────────────────────────────────────
class AdmissionController {
    public static function index(array $user): void {
        respond(DB::query('SELECT * FROM admission_applications WHERE school_id=? ORDER BY applied_at DESC',[(int)$user['school_id']]));
    }

    public static function store(array $user): void {
        $b = body();
        $id = DB::exec('INSERT INTO admission_applications (school_id,first_name,last_name,date_of_birth,gender,apply_class,guardian_name,guardian_phone,guardian_email,previous_school,docs_complete) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [(int)$user['school_id'],$b['first_name'],$b['last_name'],$b['date_of_birth']??null,$b['gender']??null,$b['apply_class']??null,$b['guardian_name']??null,$b['guardian_phone']??null,$b['guardian_email']??null,$b['previous_school']??null,(int)($b['docs_complete']??0)]);
        respond(['id'=>$id],201,'Application submitted');
    }

    public static function update(array $user, int $id): void {
        $b = body();
        $status = $b['status'] ?? null;
        if (!in_array($status,['pending','approved','rejected','interview'],true)) respond(null,422,'Invalid status');
        DB::run('UPDATE admission_applications SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND school_id=?',
            [$status,(int)$user['id'],$id,(int)$user['school_id']]);
        respond(['updated'=>true]);
    }
}

// ─── SettingsController ───────────────────────────────────────────────────────
// School profile / branding — includes the logo shown on report-card PDFs.
class SettingsController {
    public static function getSchool(array $user): void {
        $sid = (int)$user['school_id'];
        respond(DB::one('SELECT id,name,code,address,phone,email,logo_url,motto,term_system FROM schools WHERE id=?',[$sid]));
    }

    public static function updateSchool(array $user): void {
        $b   = body();
        $sid = (int)$user['school_id'];
        // COALESCE keeps existing values when a field is omitted; an empty string
        // is a deliberate clear (e.g. removing the logo).
        DB::run('UPDATE schools SET
                    name=COALESCE(?,name), code=COALESCE(?,code), address=COALESCE(?,address),
                    phone=COALESCE(?,phone), email=COALESCE(?,email), motto=COALESCE(?,motto),
                    term_system=COALESCE(?,term_system), logo_url=COALESCE(?,logo_url)
                 WHERE id=?',
            [$b['name']??null,$b['code']??null,$b['address']??null,$b['phone']??null,
             $b['email']??null,$b['motto']??null,$b['term_system']??null,$b['logo_url']??null,$sid]);
        respond(DB::one('SELECT id,name,code,address,phone,email,logo_url,motto,term_system FROM schools WHERE id=?',[$sid]),200,'Settings saved');
    }
}

// ─── AIController ─────────────────────────────────────────────────────────────
// Server-side proxy to z.ai (Zhipu GLM). The API key lives only in config/ai.php
// (git-ignored, created on the server) so it is never exposed to the browser.
// One generic OpenAI-compatible chat endpoint powers every AI feature:
// question generator, lesson notes, rubric builder, chat assistant, insights.
class AIController {
    private static function config(): array {
        $path = dirname(__DIR__, 2) . '/config/ai.php';
        if (!is_file($path)) respond(null, 503, 'AI is not configured on the server (config/ai.php missing).');
        return require $path;
    }

    public static function chat(array $user): void {
        $cfg = self::config();
        if (empty($cfg['api_key']) || $cfg['api_key'] === 'YOUR_ZAI_API_KEY_HERE') {
            respond(null, 503, 'AI API key is not set on the server.');
        }

        $b = body();
        // Accept either a full messages array or a single prompt (+ optional system).
        $messages = $b['messages'] ?? null;
        if (!is_array($messages) || !$messages) {
            $prompt = trim((string)($b['prompt'] ?? ''));
            if ($prompt === '') respond(null, 422, 'prompt or messages required');
            $messages = [];
            if (!empty($b['system'])) $messages[] = ['role' => 'system', 'content' => (string)$b['system']];
            $messages[] = ['role' => 'user', 'content' => $prompt];
        }

        $payload = [
            'model'       => $b['model'] ?? $cfg['model'] ?? 'glm-4.6',
            'messages'    => $messages,
            'temperature' => isset($b['temperature']) ? (float)$b['temperature'] : 0.7,
            'max_tokens'  => isset($b['max_tokens']) ? min(8000, max(1, (int)$b['max_tokens'])) : 2048,
        ];

        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $cfg['api_key'],
        ];
        // OpenRouter attribution headers (optional; ignored by other providers).
        if (!empty($cfg['referer'])) $headers[] = 'HTTP-Referer: ' . $cfg['referer'];
        if (!empty($cfg['title']))   $headers[] = 'X-Title: ' . $cfg['title'];

        $url = rtrim($cfg['base_url'], '/') . '/chat/completions';
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => (int)($cfg['timeout'] ?? 60),
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);
        $res  = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($res === false) respond(null, 502, 'AI request failed: ' . $err);
        $json = json_decode($res, true);
        if ($http >= 400) {
            $msg = $json['error']['message'] ?? $json['message'] ?? ('AI provider returned HTTP ' . $http);
            respond(null, 502, is_string($msg) ? $msg : 'AI provider error');
        }
        $content = $json['choices'][0]['message']['content'] ?? '';
        respond(['content' => $content, 'model' => $payload['model'], 'usage' => $json['usage'] ?? null]);
    }
}

// ─── StudentPortalController ──────────────────────────────────────────────────
// The student-facing exam flow. Endpoints only ever act on the logged-in student's
// own record, and exam questions are returned WITHOUT the correct answers.
class StudentPortalController {
    // Resolve the students row for the logged-in user (or 403).
    private static function me(array $user): array {
        $s = DB::one('SELECT id, class_id, student_id FROM students WHERE user_id=? AND deleted_at IS NULL', [(int)$user['id']]);
        if (!$s) respond(null, 403, 'This account is not a student.');
        return $s;
    }

    // Is a score visible to the student yet? (immediate, or teacher-released)
    private static function scoreVisible(array $exam): bool {
        return (int)($exam['show_score'] ?? 0) === 1 || (int)($exam['results_released'] ?? 0) === 1;
    }

    // Exams available to this student's class, with their submission state.
    public static function myExams(array $user): void {
        $s = self::me($user);
        $rows = DB::query(
            'SELECT e.id,e.title,e.exam_type,e.duration,e.total_marks,e.status,e.show_score,e.results_released,
                    e.start_time,e.end_time, sub.name AS subject_name,
                    (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id=e.id) AS question_count,
                    es.id AS submission_id, es.score, es.max_score, es.needs_review, es.submitted_at
             FROM exams e
             JOIN subjects sub ON sub.id=e.subject_id
             LEFT JOIN exam_submissions es ON es.exam_id=e.id AND es.student_id=?
             WHERE e.class_id=? AND e.status IN ("active","completed")
             ORDER BY e.created_at DESC',
            [$s['id'], $s['class_id']]);
        foreach ($rows as &$r) {
            $r['submitted'] = !empty($r['submission_id']);
            $r['score_visible'] = $r['submitted'] && self::scoreVisible($r);
            if (!$r['score_visible']) { unset($r['score'], $r['max_score']); }
        }
        respond($rows);
    }

    // An exam to take: questions WITHOUT answers. Blocks re-takes.
    public static function takeExam(array $user, int $examId): void {
        $s = self::me($user);
        $exam = DB::one('SELECT id,title,duration,total_marks,class_id,status,show_score,results_released FROM exams WHERE id=? AND school_id=?', [$examId, (int)$user['school_id']]);
        if (!$exam || (int)$exam['class_id'] !== (int)$s['class_id']) respond(null, 404, 'Exam not found for your class.');
        if ($exam['status'] !== 'active') respond(null, 403, 'This exam is not open.');
        $existing = DB::one('SELECT id FROM exam_submissions WHERE exam_id=? AND student_id=?', [$examId, $s['id']]);
        if ($existing) respond(null, 409, 'You have already submitted this exam.');
        // Strip the answer column — never send correct answers to the client.
        $exam['questions'] = DB::query('SELECT id,type,question,options,marks,sort_order FROM exam_questions WHERE exam_id=? ORDER BY sort_order', [$examId]);
        respond($exam);
    }

    public static function submitExam(array $user): void {
        $s = self::me($user);
        $b = body();
        $examId  = (int)($b['exam_id'] ?? 0);
        $answers = $b['answers'] ?? [];              // { question_id: value }
        $timeTaken = (int)($b['time_taken'] ?? 0);
        $exam = DB::one('SELECT id,class_id,status,show_score,results_released FROM exams WHERE id=? AND school_id=?', [$examId, (int)$user['school_id']]);
        if (!$exam || (int)$exam['class_id'] !== (int)$s['class_id']) respond(null, 404, 'Exam not found for your class.');
        if (DB::one('SELECT id FROM exam_submissions WHERE exam_id=? AND student_id=?', [$examId, $s['id']])) {
            respond(null, 409, 'You have already submitted this exam.');
        }

        $questions = DB::query('SELECT id,type,options,answer,marks FROM exam_questions WHERE exam_id=?', [$examId]);
        $auto = 0.0; $maxTotal = 0.0; $needsReview = 0;
        foreach ($questions as $q) {
            $marks = (int)$q['marks']; $maxTotal += $marks;
            if (in_array($q['type'], ['mcq','tf'], true)) {
                if (self::isCorrect($q, $answers[$q['id']] ?? null)) $auto += $marks;
            } else {
                $needsReview = 1;   // short/essay/fill need manual grading
            }
        }
        DB::exec('INSERT INTO exam_submissions (exam_id,student_id,answers,score,max_score,needs_review,submitted_at,time_taken) VALUES (?,?,?,?,?,?,NOW(),?)',
            [$examId, $s['id'], json_encode($answers), $auto, $maxTotal, $needsReview, $timeTaken]);

        $visible = self::scoreVisible($exam);
        respond([
            'submitted'     => true,
            'score_visible' => $visible,
            'needs_review'  => (bool)$needsReview,
            'score'         => $visible ? $auto : null,
            'max_score'     => $visible ? $maxTotal : null,
        ], 201, 'Submitted');
    }

    // Past submissions for this student, honouring per-exam score visibility.
    public static function myResults(array $user): void {
        $s = self::me($user);
        $rows = DB::query(
            'SELECT es.id,es.score,es.max_score,es.needs_review,es.submitted_at,
                    e.title,e.exam_type,e.show_score,e.results_released, sub.name AS subject_name
             FROM exam_submissions es
             JOIN exams e ON e.id=es.exam_id
             JOIN subjects sub ON sub.id=e.subject_id
             WHERE es.student_id=? ORDER BY es.submitted_at DESC',
            [$s['id']]);
        foreach ($rows as &$r) {
            $r['score_visible'] = self::scoreVisible($r);
            if (!$r['score_visible']) { unset($r['score'], $r['max_score']); }
        }
        respond($rows);
    }

    // Robustly compare a student's answer to the stored correct answer.
    private static function isCorrect(array $q, $ans): bool {
        if ($ans === null || $ans === '') return false;
        $correct = trim((string)($q['answer'] ?? ''));
        if ($correct === '') return false;
        if ($q['type'] === 'mcq') {
            $opts = json_decode($q['options'] ?? '[]', true) ?: [];
            if (is_numeric($correct)) return (int)$correct === (int)$ans;         // answer stored as index
            $chosen = is_numeric($ans) ? ($opts[(int)$ans] ?? '') : $ans;          // answer stored as option text
            return mb_strtolower(trim((string)$chosen)) === mb_strtolower($correct);
        }
        if ($q['type'] === 'tf') {
            $norm = function ($v) {
                $v = mb_strtolower(trim((string)$v));
                if (in_array($v, ['1','true','t','yes'], true)) return 'true';
                if (in_array($v, ['0','false','f','no'], true)) return 'false';
                return $v;
            };
            // Student sends option index (0 = True, 1 = False).
            $student = ($ans === 0 || $ans === '0') ? 'true' : (($ans === 1 || $ans === '1') ? 'false' : $norm($ans));
            return $norm($correct) === $student;
        }
        return false;
    }
}
