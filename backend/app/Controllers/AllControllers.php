<?php
// ─── Platform (HQ control-plane) ──────────────────────────────────────────────
// A group-level super-admin ("HQ") can suspend this school by setting
// platform_control.status = 'suspended' in THIS school's own database. The API
// checks it on every request. The check is FAIL-OPEN: any error (table missing,
// DB hiccup) leaves the school ACTIVE, so a problem in HQ can never black out
// every school at once.
class Platform {
    public static function ensureActive(): void {
        try {
            $row = DB::one('SELECT status, message FROM platform_control WHERE id = 1');
        } catch (\Throwable $e) {
            return; // fail-open: never block on an infrastructure error
        }
        if ($row && ($row['status'] ?? 'active') === 'suspended') {
            $msg = trim((string)($row['message'] ?? ''));
            if ($msg === '') {
                $msg = 'This school portal is temporarily unavailable. Please contact your administrator.';
            }
            respond(['suspended' => true, 'message' => $msg], 503, $msg);
        }
    }
}

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

        // Non-admin staff only ever see students in the classes they're assigned to.
        if (!Perm::isAdmin($user)) {
            $cids = Perm::teacherClassIds($user);
            if (!$cids) { respond(['students' => [], 'meta' => ['total' => 0, 'page' => 1, 'per_page' => $limit, 'pages' => 1]]); }
            $where[] = 's.class_id IN (' . implode(',', array_fill(0, count($cids), '?')) . ')';
            $params = array_merge($params, $cids);
        }

        // Sortable columns (whitelisted to prevent SQL injection).
        $dir = strtolower($_GET['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
        switch ($_GET['sort'] ?? 'name') {
            case 'id':    $orderBy = "s.student_id $dir"; break;
            case 'class': $orderBy = "c.name $dir, u.last_name ASC, u.first_name ASC"; break;
            case 'email': $orderBy = "u.email $dir"; break;
            case 'name':
            default:      $orderBy = "u.last_name $dir, u.first_name $dir"; break;
        }
        $sql = 'SELECT s.id, s.student_id, s.admission_date, s.guardian_name, s.guardian_phone, s.guardian_email,
                       u.first_name, u.last_name, u.email, u.phone, u.gender, u.date_of_birth,
                       c.name AS class_name, c.id AS class_id
                FROM students s
                JOIN users u ON u.id = s.user_id
                JOIN classes c ON c.id = s.class_id
                WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL AND ' . implode(' AND ', $where) .
               ' ORDER BY ' . $orderBy . ' LIMIT ? OFFSET ?';
        $params[] = $limit; $params[] = $offset;

        // Count query joins classes too, so a c.name (form) filter resolves.
        $countSql = 'SELECT COUNT(*) c FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL AND ' . implode(' AND ', $where);
        $total = (int)(DB::one($countSql, array_slice($params, 0, -2))['c'] ?? 0);

        respond(['students' => DB::query($sql, $params), 'meta' => ['total' => $total, 'page' => $page, 'per_page' => $limit, 'pages' => max(1, ceil($total / $limit))]]);
    }

    public static function show(array $user, int $id): void {
        $s = DB::one('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender,u.date_of_birth,u.address,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Student not found');
        if (!Perm::canAccessClass($user, (int)$s['class_id'])) respond(null, 403, 'You are not assigned to this student\'s class.');
        $s['attendance_summary'] = DB::one('SELECT COUNT(*) total, SUM(status="present") present, SUM(status LIKE "absent%") absent, SUM(status LIKE "late%") late FROM attendance WHERE student_id=?',[$id]);
        $s['invoice'] = DB::one('SELECT * FROM invoices WHERE student_id=? ORDER BY id DESC LIMIT 1',[$id]);
        respond($s);
    }

    // Build a student's login email from their student ID: the ID (letters/digits
    // only, lowercased) as the local part, at the school's own domain. The domain
    // is taken from the request host (portal.<domain> -> <domain>); on localhost it
    // falls back to the school's configured email domain, then a sane default.
    private static function studentEmailFromId(string $studentId, int $schoolId): string {
        $local = strtolower(preg_replace('/[^A-Za-z0-9]+/', '', $studentId));
        if ($local === '') $local = 'student';
        $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
        $host = preg_replace('/:\d+$/', '', $host);        // strip any :port
        $host = preg_replace('/^(www|portal|api)\./', '', $host);
        if ($host === '' || $host === 'localhost' || strpos($host, '127.0.0.1') === 0) {
            $se = (string)(DB::one('SELECT email FROM schools WHERE id=?', [$schoolId])['email'] ?? '');
            $host = (strpos($se, '@') !== false) ? substr(strrchr($se, '@'), 1) : 'learnersforge.ng';
        }
        return $local . '@' . $host;
    }

    public static function store(array $user): void {
        Perm::assertAdmin($user);   // enrolment is an admin action
        $b = body();
        // Blank optional fields must become NULL — an empty string is rejected by the
        // gender ENUM and date_of_birth DATE columns under MySQL strict mode.
        $nn = fn($k) => (isset($b[$k]) && trim((string)$b[$k]) !== '') ? trim((string)$b[$k]) : null;
        $first = trim((string)($b['first_name'] ?? ''));
        $last  = trim((string)($b['last_name'] ?? ''));
        $email = trim((string)($b['email'] ?? ''));
        // Email is no longer required: when left blank it is auto-generated from the
        // student ID (the one provided, or the one we generate below from the new
        // user's id). Only the name is mandatory.
        if ($first === '' || $last === '') respond(null, 422, 'First name and last name are required.');
        $providedSid = trim((string)($b['student_id'] ?? ''));
        // If a student ID was typed we can derive the email up-front; for an
        // auto-generated ID we need the new user's id first (handled below).
        if ($email === '' && $providedSid !== '') {
            $email = self::studentEmailFromId($providedSid, (int)$user['school_id']);
        }
        $gender = in_array($b['gender'] ?? '', ['male','female','other'], true) ? $b['gender'] : null;
        $dob    = self::normalizeDate($b['date_of_birth'] ?? null);

        DB::conn()->beginTransaction();
        try {
            // users.email is NOT NULL + UNIQUE. If we still have no email (auto ID),
            // insert a unique provisional then replace it once the ID is known.
            $provisional = $email !== '' ? $email : ('pending.' . bin2hex(random_bytes(5)) . '@pending.local');
            $uid = DB::exec('INSERT INTO users (school_id,first_name,last_name,email,phone,password,role,gender,date_of_birth) VALUES (?,?,?,?,?,?,?,?,?)',
                [(int)$user['school_id'],$first,$last,$provisional,$nn('phone'),
                 password_hash($b['password'] ?? 'password123',PASSWORD_DEFAULT),'student',$gender,$dob]);
            $sid_gen = $providedSid !== '' ? $providedSid : 'ST' . str_pad((string)$uid, 4, '0', STR_PAD_LEFT);
            if ($email === '') {   // auto ID path: derive the email from it now
                $email = self::studentEmailFromId($sid_gen, (int)$user['school_id']);
                DB::run('UPDATE users SET email=? WHERE id=?', [$email, $uid]);
            }
            $admNo   = !empty($b['admission_number']) ? $b['admission_number'] : 'GFA/' . date('Y') . '/' . str_pad((string)$uid, 3, '0', STR_PAD_LEFT);
            $stid = DB::exec('INSERT INTO students (user_id,student_id,class_id,admission_number,admission_date,guardian_name,guardian_phone,guardian_email,guardian_address,medical_notes,previous_school) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [$uid,$sid_gen,(int)($b['class_id'] ?? 1),$admNo,date('Y-m-d'),$nn('guardian_name'),$nn('guardian_phone'),$nn('guardian_email'),$nn('guardian_address'),$nn('medical_notes'),$nn('previous_school')]);
            DB::conn()->commit();
            respond(['student_id' => $stid, 'user_id' => $uid, 'student_code' => $sid_gen, 'email' => $email], 201, 'Student created');
        } catch (Throwable $e) {
            DB::conn()->rollBack();
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') !== false) {
                if     (stripos($msg, 'email')     !== false) respond(null, 422, 'A user with this email already exists.');
                elseif (stripos($msg, 'admission') !== false) respond(null, 422, 'That admission number is already in use.');
                elseif (stripos($msg, 'student_id') !== false) respond(null, 422, 'That student ID is already in use.');
                respond(null, 422, 'A duplicate value was provided.');
            }
            throw $e;
        }
    }

    // Bulk import: all rows are enrolled into the single class chosen in the form.
    // Each row is its own transaction so one bad row never aborts the whole batch.
    public static function import(array $user): void {
        Perm::assertAdmin($user);
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
    public static function normalizeDate($v): ?string {
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
        if (!Perm::canAccessClass($user, (int)$s['class_id'])) respond(null, 403, 'You are not assigned to this student\'s class.');
        $uid = (int)$s['uid'];
        $nn  = fn($k) => (isset($b[$k]) && trim((string)$b[$k]) !== '') ? trim((string)$b[$k]) : null;

        try {
            // ── users row (account + person) ──
            $sets = []; $params = [];
            foreach (['first_name','last_name','email'] as $f) {           // required — only overwrite with a value
                if (isset($b[$f]) && trim((string)$b[$f]) !== '') { $sets[] = "$f=?"; $params[] = trim((string)$b[$f]); }
            }
            if (array_key_exists('phone', $b))         { $sets[] = "phone=?";         $params[] = $nn('phone'); }
            if (array_key_exists('gender', $b))        { $sets[] = "gender=?";        $params[] = in_array($b['gender'] ?? '', ['male','female','other'], true) ? $b['gender'] : null; }
            if (array_key_exists('date_of_birth', $b)) { $sets[] = "date_of_birth=?"; $params[] = self::normalizeDate($b['date_of_birth'] ?? null); }
            if (!empty($b['password']))                { $sets[] = "password=?";      $params[] = password_hash($b['password'], PASSWORD_DEFAULT); }
            if ($sets) { $sets[] = "updated_at=NOW()"; $params[] = $uid; DB::run('UPDATE users SET '.implode(',', $sets).' WHERE id=?', $params); }

            // ── students row (enrolment details) ──
            $ss = []; $sp = [];
            if (!empty($b['class_id'])) { $ss[] = "class_id=?"; $sp[] = (int)$b['class_id']; }
            if (isset($b['student_id']) && trim((string)$b['student_id']) !== '') { $ss[] = "student_id=?"; $sp[] = trim((string)$b['student_id']); } // NOT NULL
            foreach (['admission_number','guardian_name','guardian_phone','guardian_email','guardian_address','medical_notes','previous_school'] as $f) {
                if (array_key_exists($f, $b)) { $ss[] = "$f=?"; $sp[] = $nn($f); }
            }
            if ($ss) { $ss[] = "updated_at=NOW()"; $sp[] = $id; DB::run('UPDATE students SET '.implode(',', $ss).' WHERE id=?', $sp); }

            respond(['updated' => true]);
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') !== false) {
                if     (stripos($msg, 'email')      !== false) respond(null, 422, 'A user with this email already exists.');
                elseif (stripos($msg, 'admission')  !== false) respond(null, 422, 'That admission number is already in use.');
                elseif (stripos($msg, 'student_id') !== false) respond(null, 422, 'That student ID is already in use.');
                respond(null, 422, 'A duplicate value was provided.');
            }
            throw $e;
        }
    }

    public static function destroy(array $user, int $id): void {
        Perm::assertAdmin($user);
        $s = DB::one('SELECT s.*,u.id AS uid FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
        if (!$s) respond(null,404,'Student not found');
        DB::run('UPDATE students SET deleted_at=NOW() WHERE id=?',[$id]);
        DB::run('UPDATE users SET deleted_at=NOW() WHERE id=?',[$s['uid']]);
        respond(['deleted' => true]);
    }

    // Soft-delete many students at once (only those in the caller's school).
    public static function bulkDestroy(array $user): void {
        Perm::assertAdmin($user);
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
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        respond(DB::query('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender,u.is_active FROM staff s JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND u.deleted_at IS NULL ORDER BY u.last_name',[$sid]));
    }
    public static function show(array $user, int $id): void {
        $s = DB::one('SELECT s.*,u.first_name,u.last_name,u.email,u.phone,u.gender,u.role FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',[$id,(int)$user['school_id']]);
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

    // Map free-text role labels onto the users.role enum (never 'student').
    public static function normalizeRole($raw): string {
        $r = strtolower(trim((string)$raw));
        if ($r === '') return 'teacher';
        if (str_contains($r, 'account') || str_contains($r, 'bursar')) return 'accountant';
        if (str_contains($r, 'admin') || str_contains($r, 'principal') || str_contains($r, 'head')) return 'school_admin';
        if (str_contains($r, 'parent')) return 'parent';
        return 'teacher';
    }

    // Edit a staff member's profile / account (admin only). Password optional.
    public static function update(array $user, int $id): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can edit staff.');
        $sid = (int)$user['school_id'];
        $st  = DB::one('SELECT s.*, u.id AS uid FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?', [$id, $sid]);
        if (!$st) respond(null, 404, 'Staff not found');
        $uid = (int)$st['uid'];
        $b   = body();
        $nn  = fn($k) => (isset($b[$k]) && trim((string)$b[$k]) !== '') ? trim((string)$b[$k]) : null;

        try {
            $sets = []; $params = [];
            foreach (['first_name','last_name','email'] as $f) {
                if (isset($b[$f]) && trim((string)$b[$f]) !== '') { $sets[] = "$f=?"; $params[] = trim((string)$b[$f]); }
            }
            if (array_key_exists('phone', $b))  { $sets[] = "phone=?";  $params[] = $nn('phone'); }
            if (array_key_exists('gender', $b)) { $sets[] = "gender=?"; $params[] = in_array($b['gender'] ?? '', ['male','female','other'], true) ? $b['gender'] : null; }
            if (isset($b['role']) && trim((string)$b['role']) !== '') { $sets[] = "role=?"; $params[] = self::normalizeRole($b['role']); }
            if (!empty($b['password'])) { $sets[] = "password=?"; $params[] = password_hash($b['password'], PASSWORD_DEFAULT); }
            if ($sets) { $sets[] = "updated_at=NOW()"; $params[] = $uid; DB::run('UPDATE users SET '.implode(',', $sets).' WHERE id=?', $params); }

            $ss = []; $sp = [];
            foreach (['department','designation','qualification'] as $f) {
                if (array_key_exists($f, $b)) { $ss[] = "$f=?"; $sp[] = $nn($f); }
            }
            if (array_key_exists('hire_date', $b)) { $ss[] = "hire_date=?"; $sp[] = StudentController::normalizeDate($b['hire_date'] ?? null); }
            if (isset($b['staff_id']) && trim((string)$b['staff_id']) !== '') { $ss[] = "staff_id=?"; $sp[] = trim((string)$b['staff_id']); }
            if ($ss) { $ss[] = "updated_at=NOW()"; $sp[] = $id; DB::run('UPDATE staff SET '.implode(',', $ss).' WHERE id=?', $sp); }

            respond(['updated' => true]);
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') !== false) {
                if     (stripos($msg, 'email')    !== false) respond(null, 422, 'A user with this email already exists.');
                elseif (stripos($msg, 'staff_id') !== false) respond(null, 422, 'That staff ID is already in use.');
                respond(null, 422, 'A duplicate value was provided.');
            }
            throw $e;
        }
    }

    // Bulk import staff from a CSV/Excel upload. Admin only. Each row is its own
    // transaction so one bad row never aborts the batch.
    public static function import(array $user): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can import staff.');
        $sid  = (int)$user['school_id'];
        $rows = body()['staff'] ?? [];
        if (!is_array($rows) || !$rows) respond(null, 422, 'No staff found in the file.');

        // Map free-text role labels onto the users.role enum (never 'student').
        $roleOf = function ($raw): string {
            $r = strtolower(trim((string)$raw));
            if ($r === '') return 'teacher';
            if (str_contains($r, 'account') || str_contains($r, 'bursar')) return 'accountant';
            if (str_contains($r, 'admin') || str_contains($r, 'principal') || str_contains($r, 'head')) return 'school_admin';
            if (str_contains($r, 'parent')) return 'parent';
            return 'teacher';
        };

        $created = 0; $failed = 0; $errors = [];
        foreach ($rows as $i => $row) {
            $rowNo = $i + 1;
            $first = trim((string)($row['first_name'] ?? ''));
            $last  = trim((string)($row['last_name'] ?? ''));
            if ($first === '' && !empty($row['name'])) {
                $parts = preg_split('/\s+/', trim((string)$row['name']));
                $first = array_shift($parts) ?: '';
                $last  = implode(' ', $parts);
            }
            if ($first === '') { $failed++; $errors[] = ['row'=>$rowNo, 'name'=>($row['name'] ?? ''), 'error'=>'Missing staff name']; continue; }

            $gender = strtolower(trim((string)($row['gender'] ?? '')));
            if (!in_array($gender, ['male','female'], true)) $gender = null;
            $phone = trim((string)($row['phone'] ?? '')) ?: null;
            $hire  = StudentController::normalizeDate($row['hire_date'] ?? null) ?? date('Y-m-d');

            DB::conn()->beginTransaction();
            try {
                $providedEmail = trim((string)($row['email'] ?? ''));
                $tmpEmail = $providedEmail !== '' ? $providedEmail : ('staff_' . uniqid('', true) . '@placeholder.local');
                $uid = DB::exec('INSERT INTO users (school_id,first_name,last_name,email,phone,password,role,gender) VALUES (?,?,?,?,?,?,?,?)',
                    [$sid, $first, $last, $tmpEmail, $phone, password_hash('password123', PASSWORD_DEFAULT), $roleOf($row['role'] ?? ''), $gender]);
                if ($providedEmail === '') {
                    DB::run('UPDATE users SET email=? WHERE id=?', ['staff' . $uid . '@learnersforge.local', $uid]);
                }
                $code = !empty($row['staff_id']) ? $row['staff_id'] : 'TC' . str_pad((string)$uid, 3, '0', STR_PAD_LEFT);
                DB::exec('INSERT INTO staff (user_id,staff_id,department,designation,qualification,hire_date) VALUES (?,?,?,?,?,?)',
                    [$uid, $code, $row['department'] ?? null, $row['designation'] ?? null, $row['qualification'] ?? null, $hire]);
                DB::conn()->commit();
                $created++;
            } catch (Throwable $e) {
                DB::conn()->rollBack();
                $failed++;
                $msg = $e->getMessage();
                if (stripos($msg, 'Duplicate') !== false) {
                    if     (stripos($msg, 'staff_id') !== false) $msg = 'Duplicate staff ID';
                    elseif (stripos($msg, 'email')    !== false) $msg = 'Duplicate email';
                    else $msg = 'Duplicate entry';
                }
                $errors[] = ['row'=>$rowNo, 'name'=>trim("$first $last"), 'error'=>$msg];
            }
        }
        respond(['created'=>$created, 'failed'=>$failed, 'errors'=>$errors], 201, "Imported $created staff, $failed failed");
    }

    // The logged-in user's own teaching scope — drives the teacher UI (menu,
    // class/subject dropdowns). Admins get is_admin=true and no restriction.
    public static function myAssignments(array $user): void {
        $isAdmin = Perm::isAdmin($user);
        $sid = (int)$user['school_id']; $uid = (int)$user['id'];
        $classTeacherOf = array_map('intval', array_column(
            DB::query('SELECT id FROM classes WHERE school_id=? AND form_teacher_id=? AND deleted_at IS NULL', [$sid, $uid]), 'id'));
        $teaching = array_map(fn($r) => ['class_id' => (int)$r['class_id'], 'subject_id' => (int)$r['subject_id']],
            DB::query('SELECT cs.class_id, cs.subject_id FROM class_subjects cs JOIN classes c ON c.id=cs.class_id WHERE c.school_id=? AND cs.teacher_id=?', [$sid, $uid]));
        respond([
            'is_admin'         => $isAdmin,
            'role'             => $user['role'] ?? null,
            'class_ids'        => $isAdmin ? [] : Perm::teacherClassIds($user),
            'class_teacher_of' => $classTeacherOf,
            'subject_ids'      => array_values(array_unique(array_map(fn($t) => $t['subject_id'], $teaching))),
            'teaching'         => $teaching,
        ]);
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
        respond(DB::query('SELECT * FROM ca_types WHERE school_id=? AND is_enabled=1 ORDER BY sort_order,id',[(int)$user['school_id']]));
    }

    // All components (incl. disabled) for the CA Settings editor.
    public static function caTypesAll(array $user): void {
        respond(DB::query('SELECT id,label,max_score,is_enabled,is_exam,sort_order FROM ca_types WHERE school_id=? ORDER BY sort_order,id',[(int)$user['school_id']]));
    }

    // Replace the school's CA configuration with the provided components (admin only).
    // Components with an id are updated; without, inserted. Any existing component no
    // longer listed is deleted if unused, or disabled if grades already reference it.
    public static function saveCaTypes(array $user): void {
        if (!Perm::isAdmin($user)) respond(null, 403, 'Only an administrator can change CA settings.');
        $sid   = (int)$user['school_id'];
        $comps = body()['components'] ?? [];
        if (!is_array($comps) || !$comps) respond(null, 422, 'Provide at least one assessment component.');

        DB::conn()->beginTransaction();
        try {
            $keep = []; $order = 1;
            foreach ($comps as $c) {
                $label = trim((string)($c['label'] ?? ''));
                if ($label === '') continue;
                $max     = max(0, min(100, (int)($c['max_score'] ?? 0)));
                $enabled = !empty($c['is_enabled']) ? 1 : 0;
                $isExam  = !empty($c['is_exam']) ? 1 : 0;
                $id      = (int)($c['id'] ?? 0);
                if ($id && DB::one('SELECT id FROM ca_types WHERE id=? AND school_id=?', [$id, $sid])) {
                    DB::run('UPDATE ca_types SET label=?,max_score=?,is_enabled=?,is_exam=?,sort_order=? WHERE id=? AND school_id=?',
                        [$label, $max, $enabled, $isExam, $order, $id, $sid]);
                    $keep[] = $id;
                } else {
                    $keep[] = DB::exec('INSERT INTO ca_types (school_id,label,max_score,is_enabled,is_exam,sort_order) VALUES (?,?,?,?,?,?)',
                        [$sid, $label, $max, $enabled, $isExam, $order]);
                }
                $order++;
            }
            foreach (DB::query('SELECT id FROM ca_types WHERE school_id=?', [$sid]) as $row) {
                $rid = (int)$row['id'];
                if (in_array($rid, $keep, true)) continue;
                if (DB::one('SELECT id FROM grades WHERE ca_type_id=? LIMIT 1', [$rid])) {
                    DB::run('UPDATE ca_types SET is_enabled=0 WHERE id=?', [$rid]);   // keep — grades depend on it
                } else {
                    DB::run('DELETE FROM ca_types WHERE id=? AND school_id=?', [$rid, $sid]);
                }
            }
            DB::conn()->commit();
        } catch (Throwable $e) { DB::conn()->rollBack(); throw $e; }
        respond(DB::query('SELECT id,label,max_score,is_enabled,is_exam,sort_order FROM ca_types WHERE school_id=? ORDER BY sort_order,id', [$sid]), 200, 'CA settings saved');
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

    // Admin-only: wipe every grade for one class + subject + term. Afterwards the
    // subject no longer appears on that class's report cards or broadsheet.
    public static function resetScores(array $user): void {
        Perm::assertAdmin($user);
        $classId   = (int)($_GET['class_id']   ?? 0);
        $subjectId = (int)($_GET['subject_id'] ?? 0);
        $termId    = (int)($_GET['term_id']    ?? 0);
        if (!$classId || !$subjectId || !$termId) respond(null, 422, 'class_id, subject_id and term_id required');
        $deleted = DB::run(
            'DELETE g FROM grades g JOIN students s ON s.id = g.student_id
             WHERE s.class_id = ? AND g.subject_id = ? AND g.term_id = ?',
            [$classId, $subjectId, $termId]
        );
        respond(['deleted' => $deleted]);
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
        respond(self::buildReportCard($user, $studentId, $termId));
    }

    // Email each selected student's report sheet to the guardian email on file.
    // Body: { term_id, student_ids: [..] }. Returns per-student sent/skipped/failed.
    public static function emailReportCards(array $user): void {
        $b       = json_decode(file_get_contents('php://input'), true) ?: [];
        $termId  = (int)($b['term_id'] ?? 0);
        $ids     = array_values(array_unique(array_map('intval', (array)($b['student_ids'] ?? []))));
        if (!$termId || !$ids) respond(null, 422, 'term_id and student_ids required');
        if (count($ids) > 100) respond(null, 422, 'Send at most 100 report sheets at a time.');

        $results = []; $sent = 0;
        foreach ($ids as $sid) {
            $row = DB::one('SELECT s.guardian_email, s.guardian_name, u.first_name, u.last_name FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=? AND s.deleted_at IS NULL', [$sid, (int)$user['school_id']]);
            if (!$row) { $results[] = ['student_id'=>$sid, 'status'=>'failed', 'reason'=>'Student not found']; continue; }
            $name = trim($row['first_name'].' '.$row['last_name']);
            $to   = trim((string)$row['guardian_email']);
            if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
                $results[] = ['student_id'=>$sid, 'name'=>$name, 'status'=>'skipped', 'reason'=>'No valid guardian email on file'];
                continue;
            }
            $rc = self::buildReportCard($user, $sid, $termId, true);
            if (!$rc) { $results[] = ['student_id'=>$sid, 'name'=>$name, 'status'=>'failed', 'reason'=>'No report data']; continue; }
            if (self::mailReportCard($rc, $to, (string)$row['guardian_name'])) { $sent++; $results[] = ['student_id'=>$sid, 'name'=>$name, 'status'=>'sent', 'to'=>$to]; }
            else $results[] = ['student_id'=>$sid, 'name'=>$name, 'status'=>'failed', 'reason'=>'Mail server rejected the message'];
        }
        respond(['sent'=>$sent, 'total'=>count($ids), 'results'=>$results]);
    }

    private static function mailReportCard(array $rc, string $to, string $guardian): bool {
        $h  = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $sch = $rc['school'] ?? []; $st = $rc['student']; $ov = $rc['overall'];
        $cell = 'border:1px solid #ccc;padding:6px 8px;';
        $rows = '';
        foreach ($rc['subjects'] as $s) {
            $rows .= "<tr><td style=\"$cell\">{$h($s['subject'])}</td><td style=\"$cell text-align:center\">{$h($s['ca'])}</td><td style=\"$cell text-align:center\">{$h($s['exam'])}</td><td style=\"$cell text-align:center\"><b>{$h($s['total'])}</b></td><td style=\"$cell text-align:center\">{$h($s['grade'])}</td><td style=\"$cell text-align:center\">{$h($s['position'])}</td></tr>";
        }
        $beh = '';
        foreach ($rc['behaviour'] as $x) $beh .= "<tr><td style=\"$cell\">{$h($x['trait'])}</td><td style=\"$cell text-align:center\">".($x['score'] !== null ? $h($x['score']).'/5' : $h($x['rating']))."</td></tr>";
        $att = $rc['attendance'];
        $attHtml = ($att['total_days'] > 0 || $att['present'] > 0) ? "<p><b>Attendance:</b> present {$h($att['present'])} of {$h($att['total_days'])} days ({$h($att['percentage'])}%)</p>" : '';
        $body = "<div style=\"font-family:Georgia,serif;max-width:680px;margin:auto;color:#222\">"
            ."<h2 style=\"text-align:center;margin:0\">{$h($sch['name'] ?? '')}</h2>"
            ."<p style=\"text-align:center;margin:2px 0 14px\">Termly Report Sheet &middot; {$h($rc['term']['name'] ?? '')} &middot; {$h($rc['term']['year'] ?? '')}</p>"
            .($guardian !== '' ? "<p>Dear {$h($guardian)},</p>" : '<p>Dear Parent/Guardian,</p>')
            ."<p>Please find below the report sheet for <b>{$h($st['name'])}</b> ({$h($st['class_name'])}).</p>"
            ."<table style=\"border-collapse:collapse;width:100%;font-size:14px\"><tr style=\"background:#f3f4f6\"><th style=\"$cell text-align:left\">Subject</th><th style=\"$cell\">C.A.</th><th style=\"$cell\">Exam</th><th style=\"$cell\">Total</th><th style=\"$cell\">Grade</th><th style=\"$cell\">Position</th></tr>$rows</table>"
            ."<p><b>Overall:</b> {$h($ov['total'])} / {$h($ov['max'])} &middot; {$h($ov['percentage'])}% &middot; Grade {$h($ov['grade'])} &middot; Position {$h($ov['position'])} of {$h($rc['class_size'])}</p>"
            .($beh ? "<table style=\"border-collapse:collapse;width:100%;font-size:14px\"><tr style=\"background:#f3f4f6\"><th style=\"$cell text-align:left\">Behavioural Assessment</th><th style=\"$cell\">Rating</th></tr>$beh</table>" : '')
            .$attHtml
            ."<p><b>Class Teacher's Remark:</b> {$h($rc['comments']['teacher_comment'] ?? '—')}</p>"
            ."<p><b>Head Teacher's Remark:</b> {$h($rc['comments']['principal_comment'] ?? '—')}</p>"
            ."<p style=\"font-size:12px;color:#666\">Grading: A 70–100 · B 60–69 · C 50–59 · D 45–49 · E 40–44 · F 0–39</p></div>";

        $domain = preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
        $from   = 'noreply@' . $domain;
        $fromName = preg_replace('/[\r\n"]/', '', (string)($sch['name'] ?? 'School'));
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n"
                 . "From: \"$fromName\" <$from>\r\n"
                 . (!empty($sch['email']) && filter_var($sch['email'], FILTER_VALIDATE_EMAIL) ? "Reply-To: {$sch['email']}\r\n" : '');
        $subject = '=?UTF-8?B?' . base64_encode("Report Sheet — {$st['name']} — " . ($rc['term']['name'] ?? '')) . '?=';
        return @mail($to, $subject, $body, $headers);
    }

    // Assemble one student's report-card payload. With $soft=true returns null
    // instead of aborting the request when the student can't be found.
    private static function buildReportCard(array $user, int $studentId, int $termId, bool $soft = false): ?array {
        $student = DB::one('SELECT u.first_name,u.last_name,s.student_id AS sid,s.class_id,c.name AS class_name FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id WHERE s.id=?',[$studentId]);
        if (!$student) { if ($soft) return null; respond(null,404,'Student not found'); }
        $classId = (int)$student['class_id'];

        $school = DB::one('SELECT name,address,phone,email,logo_url,motto FROM schools WHERE id=?',[(int)$user['school_id']]);
        $term   = DB::one('SELECT t.name,t.start_date,t.end_date,ay.name AS year FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id WHERE t.id=?',[$termId]);

        // Which CA components count as the "exam" portion (is_exam flag, or a label
        // containing "exam" as a fallback for components created before the flag).
        $caTypes = DB::query('SELECT id,label,max_score,is_exam FROM ca_types WHERE school_id=? AND is_enabled=1',[(int)$user['school_id']]);
        $examIds = [];
        foreach ($caTypes as $ct) { if ((int)($ct['is_exam'] ?? 0) === 1 || stripos($ct['label'],'exam') !== false) $examIds[(int)$ct['id']] = true; }

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

        // This student's per-subject rows — only subjects they actually offer
        // (total > 0; a missing record or a 0 means "not offered", exactly as the
        // broadsheet treats it). Per-subject position/hi/lo count only students who
        // also offer that subject.
        $subjects = [];
        foreach (($agg[$studentId] ?? []) as $su => $v) {
            $total = $v['ca'] + $v['exam'];
            if ($total <= 0) continue;
            $all = array_values(array_filter($subjTotals[$su], fn($t) => $t > 0));
            $position = 1; foreach ($all as $t) { if ($t > $total) $position++; }
            $subjects[] = [
                'subject'  => $subjectNames[$su],
                'ca'       => round($v['ca'], 2),
                'exam'     => round($v['exam'], 2),
                'total'    => round($total, 2),
                'grade'    => self::gradeOf($total), // subject total is out of 100 ⇒ already a %
                'position' => $position,
                'highest'  => $all ? round(max($all), 2) : round($total, 2),
                'lowest'   => $all ? round(min($all), 2) : round($total, 2),
            ];
        }
        usort($subjects, fn($a,$b) => strcmp($a['subject'], $b['subject']));

        // Overall — identical rule to the broadsheet: each student's percentage is
        // total ÷ (subjects THEY offer × 100). Non-offered subjects (0/no score) are
        // excluded from both the sum and the denominator. Rank by percentage so
        // students offering different numbers of subjects compare fairly.
        $myOverall = 0.0; $myOffered = 0;
        $pctByStudent = [];
        foreach ($agg as $st => $subs) {
            $sum = 0.0; $offered = 0;
            foreach ($subs as $v) { $t = $v['ca'] + $v['exam']; if ($t > 0) { $sum += $t; $offered++; } }
            $pctByStudent[$st] = round($offered > 0 ? ($sum / ($offered * 100)) * 100 : 0, 2);
            if ((int)$st === $studentId) { $myOverall = $sum; $myOffered = $offered; }
        }
        $overallPct = $pctByStudent[$studentId] ?? 0;
        $overallPos = 1; foreach ($pctByStudent as $p) { if ($p > $overallPct) $overallPos++; }
        $classHigh  = $pctByStudent ? max($pctByStudent) : 0;
        $classLow   = $pctByStudent ? min($pctByStudent) : 0;
        $overall = [
            'total'         => round($myOverall, 2),
            'max'           => $myOffered * 100,
            'percentage'    => round($overallPct, 2),
            'grade'         => self::gradeOf($overallPct),
            'position'      => $overallPos,
            'class_highest' => round($classHigh, 2),
            'class_lowest'  => round($classLow, 2),
        ];

        $classSize = (int)(DB::one('SELECT COUNT(*) c FROM students WHERE class_id=? AND deleted_at IS NULL',[$classId])['c'] ?? 0);

        // Behavioural records (affective + psychomotor), with a numeric /5 score.
        // Accept the numeric 5–1 scale, and legacy text ratings from older data.
        $ratingScore = ['Excellent'=>5,'Very Good'=>4,'Good'=>3,'Fair'=>2,'Poor'=>1,'5'=>5,'4'=>4,'3'=>3,'2'=>2,'1'=>1];
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

        return [
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
        ];
    }

    // Class broadsheet: every student in a class for one term, with each subject's
    // CA and exam split, overall total/percentage/grade, ranked by position.
    public static function broadsheet(array $user): void {
        $classId = (int)($_GET['class_id'] ?? 0);
        $termId  = (int)($_GET['term_id']  ?? 0);
        if (!$classId || !$termId) respond(null, 422, 'class_id and term_id required');
        if (!Perm::canAccessClass($user, $classId)) respond(null, 403, 'You are not assigned to this class.');

        $class = DB::one('SELECT name FROM classes WHERE id=? AND school_id=?', [$classId, (int)$user['school_id']]);
        if (!$class) respond(null, 404, 'Class not found');
        $term   = DB::one('SELECT t.name, ay.name AS year FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id WHERE t.id=?', [$termId]);
        $school = DB::one('SELECT name FROM schools WHERE id=?', [(int)$user['school_id']]);

        // Which enabled components form the "exam" portion (is_exam flag or "exam" label).
        $examIds = [];
        foreach (DB::query('SELECT id,label,is_exam FROM ca_types WHERE school_id=? AND is_enabled=1', [(int)$user['school_id']]) as $ct) {
            if ((int)($ct['is_exam'] ?? 0) === 1 || stripos($ct['label'], 'exam') !== false) $examIds[(int)$ct['id']] = true;
        }

        // Subject columns: the class's mapped subjects (plus any that already have grades).
        $subjMap = [];
        foreach (DB::query('SELECT sub.id, sub.name FROM class_subjects cs JOIN subjects sub ON sub.id=cs.subject_id WHERE cs.class_id=?', [$classId]) as $s) {
            $subjMap[(int)$s['id']] = $s['name'];
        }

        $students = DB::query(
            'SELECT s.id, COALESCE(NULLIF(s.admission_number, ""), s.student_id) AS adm,
                    u.first_name, u.last_name, s.guardian_name
             FROM students s JOIN users u ON u.id=s.user_id
             WHERE s.class_id=? AND s.deleted_at IS NULL',
            [$classId]
        );

        $rows = DB::query(
            'SELECT g.student_id, g.subject_id, sub.name AS subject, g.ca_type_id, g.score
             FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id
             WHERE s.class_id=? AND g.term_id=? AND s.deleted_at IS NULL',
            [$classId, $termId]
        );
        $agg = [];
        foreach ($rows as $r) {
            $st = (int)$r['student_id']; $su = (int)$r['subject_id']; $sc = (float)$r['score'];
            if (!isset($subjMap[$su])) $subjMap[$su] = $r['subject'];
            if (!isset($agg[$st][$su])) $agg[$st][$su] = ['ca' => 0.0, 'exam' => 0.0];
            if (isset($examIds[(int)$r['ca_type_id']])) $agg[$st][$su]['exam'] += $sc;
            else                                        $agg[$st][$su]['ca']   += $sc;
        }

        asort($subjMap);   // order columns alphabetically by subject name
        $subjectCols = [];
        foreach ($subjMap as $id => $name) $subjectCols[] = ['id' => $id, 'name' => $name];

        // A subject only counts for a student if they have a recorded score with a
        // total above 0. A missing record — or a straight 0 — means the student does
        // NOT offer that subject, so it's left out of their total, denominator
        // (percentage/average) and ranking entirely.
        $out = [];
        foreach ($students as $st) {
            $sid = (int)$st['id']; $subs = []; $total = 0.0; $offered = 0;
            foreach ($subjectCols as $col) {
                $v = $agg[$sid][$col['id']] ?? null;
                $t = $v ? $v['ca'] + $v['exam'] : 0;
                if ($v === null || $t <= 0) { $subs[$col['id']] = ['ca' => null, 'exam' => null, 'total' => null]; continue; }
                $subs[$col['id']] = ['ca' => round($v['ca'], 1), 'exam' => round($v['exam'], 1), 'total' => round($t, 1)];
                $total += $t;
                $offered++;
            }
            $possible = $offered * 100;                       // per-student, only subjects offered
            $pct = $possible > 0 ? ($total / $possible) * 100 : 0;
            $out[] = [
                'student_id'       => $sid,
                'admission'        => $st['adm'],
                'name'             => trim($st['first_name'].' '.$st['last_name']),
                'guardian'         => $st['guardian_name'] ?: '',
                'subjects'         => $subs,
                'subjects_offered' => $offered,
                'out_of'           => $possible,
                'total'            => round($total, 1),
                'percentage'       => round($pct, 2),
                'grade'            => self::gradeOf($pct),
            ];
        }

        // Because students may offer different numbers of subjects, rank by
        // percentage (average) rather than raw total; break ties on total.
        usort($out, fn($a, $b) => ($b['percentage'] <=> $a['percentage']) ?: ($b['total'] <=> $a['total']));
        foreach ($out as $i => $o) {
            $pos = 1; foreach ($out as $x) { if ($x['percentage'] > $o['percentage']) $pos++; }
            $out[$i]['position'] = $pos;
        }

        respond([
            'class'           => ['id' => $classId, 'name' => $class['name']],
            'term'            => $term,
            'school'          => $school,
            'subjects'        => $subjectCols,
            'max_per_subject' => 100,
            'rows'            => $out,
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

    // Every class a non-admin staff member is attached to — as its form teacher
    // OR as a subject teacher. Used to scope what students/classes they can access.
    public static function teacherClassIds(array $user): array {
        $uid = (int)$user['id']; $sid = (int)$user['school_id'];
        $a = DB::query('SELECT id FROM classes WHERE school_id=? AND form_teacher_id=? AND deleted_at IS NULL', [$sid, $uid]);
        $b = DB::query('SELECT DISTINCT cs.class_id AS id FROM class_subjects cs JOIN classes c ON c.id=cs.class_id WHERE c.school_id=? AND cs.teacher_id=?', [$sid, $uid]);
        return array_values(array_unique(array_map(fn($r) => (int)$r['id'], array_merge($a, $b))));
    }

    // Can this user view/manage students in $classId? (admin, or attached to it)
    public static function canAccessClass(array $user, ?int $classId): bool {
        if (self::isAdmin($user)) return true;
        if (!$classId) return false;
        return in_array((int)$classId, self::teacherClassIds($user), true);
    }

    public static function assertAccessStudent(array $user, int $studentId): void {
        if (self::isAdmin($user)) return;
        $s = DB::one('SELECT class_id FROM students WHERE id=?', [$studentId]);
        if (!$s || !self::canAccessClass($user, (int)$s['class_id'])) {
            respond(null, 403, 'You are not assigned to this student\'s class.');
        }
    }

    public static function assertAdmin(array $user): void {
        if (!self::isAdmin($user)) respond(null, 403, 'Only an administrator can perform this action.');
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
        // A teacher may only create an exam for a subject they teach in that class.
        if (!Perm::isAdmin($user) && !Perm::teachesSubjectInClass($user, (int)($b['class_id'] ?? 0), (int)($b['subject_id'] ?? 0))) {
            respond(null, 403, 'You can only create exams for subjects you teach in your assigned classes.');
        }
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

    // Grading permission: admin, the exam creator, the class's form teacher,
    // or a teacher of the exam's subject in that class.
    private static function assertCanGrade(array $user, array $exam): void {
        if (Perm::isAdmin($user)) return;
        if ((int)($exam['created_by'] ?? 0) === (int)$user['id']) return;
        if (Perm::canManageClass($user, (int)$exam['class_id'])) return;
        if (Perm::teachesSubjectInClass($user, (int)$exam['class_id'], (int)$exam['subject_id'])) return;
        respond(null, 403, 'You are not permitted to grade this exam.');
    }

    // All submissions for an exam (teacher/admin), with student + score info.
    public static function submissions(array $user, int $examId): void {
        $exam = DB::one('SELECT * FROM exams WHERE id=? AND school_id=?', [$examId, (int)$user['school_id']]);
        if (!$exam) respond(null, 404, 'Exam not found');
        self::assertCanGrade($user, $exam);
        $meta = DB::one('SELECT e.id,e.title,e.exam_type,e.total_marks,e.show_score,e.results_released,c.name AS class_name,sub.name AS subject_name
                         FROM exams e JOIN classes c ON c.id=e.class_id JOIN subjects sub ON sub.id=e.subject_id WHERE e.id=?', [$examId]);
        $meta['has_subjective'] = (bool)DB::one('SELECT 1 x FROM exam_questions WHERE exam_id=? AND type IN ("short","essay","fill") LIMIT 1', [$examId]);
        $subs = DB::query(
            'SELECT es.id,es.score,es.max_score,es.needs_review,es.submitted_at,es.time_taken,
                    u.first_name,u.last_name, st.student_id AS admission_no
             FROM exam_submissions es JOIN students st ON st.id=es.student_id JOIN users u ON u.id=st.user_id
             WHERE es.exam_id=? ORDER BY u.last_name,u.first_name', [$examId]);
        respond(['exam' => $meta, 'submissions' => $subs]);
    }

    // One submission with every question, the student's answer, and marks —
    // objective questions auto-marked, subjective ones showing awarded marks.
    public static function submissionDetail(array $user, int $subId): void {
        $sub = DB::one(
            'SELECT es.*, u.first_name,u.last_name, st.student_id AS admission_no
             FROM exam_submissions es JOIN students st ON st.id=es.student_id JOIN users u ON u.id=st.user_id
             WHERE es.id=?', [$subId]);
        if (!$sub) respond(null, 404, 'Submission not found');
        $exam = DB::one('SELECT * FROM exams WHERE id=? AND school_id=?', [(int)$sub['exam_id'], (int)$user['school_id']]);
        if (!$exam) respond(null, 404, 'Exam not found');
        self::assertCanGrade($user, $exam);

        $answers = json_decode($sub['answers'] ?? '[]', true) ?: [];
        $subjScores = json_decode($sub['subjective_scores'] ?? 'null', true) ?: [];
        $questions = DB::query('SELECT id,type,question,options,answer,marks FROM exam_questions WHERE exam_id=? ORDER BY sort_order', [(int)$sub['exam_id']]);
        foreach ($questions as &$q) {
            $ans = $answers[$q['id']] ?? null;
            $q['student_answer'] = $ans;
            $q['options'] = json_decode($q['options'] ?? 'null', true);
            if (in_array($q['type'], ['mcq','tf'], true)) {
                $q['objective']  = true;
                $q['is_correct'] = StudentPortalController::isCorrect($q, $ans);
                $q['awarded']    = $q['is_correct'] ? (int)$q['marks'] : 0;
            } else {
                $q['objective'] = false;
                $q['awarded']   = isset($subjScores[$q['id']]) ? (float)$subjScores[$q['id']] : null;
            }
        }
        respond([
            'submission' => [
                'id' => (int)$sub['id'], 'exam_id' => (int)$sub['exam_id'],
                'student' => trim($sub['first_name'].' '.$sub['last_name']), 'admission_no' => $sub['admission_no'],
                'score' => $sub['score'], 'max_score' => $sub['max_score'], 'needs_review' => (int)$sub['needs_review'],
                'submitted_at' => $sub['submitted_at'], 'time_taken' => (int)$sub['time_taken'],
                'exam_title' => $exam['title'],
            ],
            'questions' => $questions,
        ]);
    }

    // Save teacher-awarded marks for subjective questions; recompute the total.
    public static function gradeSubmission(array $user, int $subId): void {
        $sub = DB::one('SELECT * FROM exam_submissions WHERE id=?', [$subId]);
        if (!$sub) respond(null, 404, 'Submission not found');
        $exam = DB::one('SELECT * FROM exams WHERE id=? AND school_id=?', [(int)$sub['exam_id'], (int)$user['school_id']]);
        if (!$exam) respond(null, 404, 'Exam not found');
        self::assertCanGrade($user, $exam);

        $scores    = body()['scores'] ?? [];                       // { question_id: marks }
        $answers   = json_decode($sub['answers'] ?? '[]', true) ?: [];
        $questions = DB::query('SELECT id,type,options,answer,marks FROM exam_questions WHERE exam_id=?', [(int)$sub['exam_id']]);
        $objective = 0.0; $subjective = 0.0; $clean = [];
        foreach ($questions as $q) {
            if (in_array($q['type'], ['mcq','tf'], true)) {
                if (StudentPortalController::isCorrect($q, $answers[$q['id']] ?? null)) $objective += (int)$q['marks'];
            } else {
                $m = isset($scores[$q['id']]) ? max(0.0, min((float)$q['marks'], (float)$scores[$q['id']])) : 0.0;
                $subjective += $m; $clean[$q['id']] = $m;
            }
        }
        $final = $objective + $subjective;
        DB::run('UPDATE exam_submissions SET score=?, subjective_scores=?, needs_review=0 WHERE id=?',
            [$final, json_encode($clean), $subId]);
        respond(['score' => $final, 'objective' => $objective, 'subjective' => $subjective]);
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

    public static function storeHostel(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') respond(null, 422, 'Hostel name is required.');
        $gender = in_array($b['gender'] ?? '', ['male','female','mixed'], true) ? $b['gender'] : 'mixed';
        $id = DB::exec('INSERT INTO hostels (school_id,name,gender,capacity,matron_id) VALUES (?,?,?,?,?)',
            [(int)$user['school_id'], $name, $gender, (int)($b['capacity'] ?? 0), !empty($b['matron_id']) ? (int)$b['matron_id'] : null]);
        respond(['id' => $id], 201, 'Hostel block created');
    }

    public static function storeRoom(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $hostelId = (int)($b['hostel_id'] ?? 0);
        $roomNo   = trim((string)($b['room_no'] ?? ''));
        if (!$hostelId || $roomNo === '') respond(null, 422, 'Hostel and room number are required.');
        if (!DB::one('SELECT id FROM hostels WHERE id=? AND school_id=?', [$hostelId, (int)$user['school_id']]))
            respond(null, 404, 'Hostel not found.');
        $id = DB::exec('INSERT INTO hostel_rooms (hostel_id,room_no,capacity) VALUES (?,?,?)',
            [$hostelId, $roomNo, max(1, (int)($b['capacity'] ?? 4))]);
        respond(['id' => $id], 201, 'Room added');
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

// ─── TransportController ──────────────────────────────────────────────────────
// School bus routes (each carries its own driver + per-term fee), the students
// assigned to a route for a term (pickup point), and transport-fee collection.
class TransportController {
    // All routes for the school, with a live count of students assigned.
    public static function routes(array $user): void {
        respond(DB::query(
            'SELECT r.*, (SELECT COUNT(*) FROM student_transport st WHERE st.route_id = r.id) AS enrolled
             FROM transport_routes r WHERE r.school_id = ? ORDER BY r.name', [(int)$user['school_id']]));
    }

    // Create ($id null) or update a route. Admin only.
    public static function saveRoute(array $user, ?int $id = null): void {
        Perm::assertAdmin($user);
        $b = body();
        $name = trim((string)($b['name'] ?? ''));
        if ($name === '') respond(null, 422, 'Route name is required.');
        $cols = [$name, $b['bus_number'] ?? null, $b['driver_name'] ?? null, $b['driver_phone'] ?? null,
                 (isset($b['capacity']) && $b['capacity'] !== '') ? (int)$b['capacity'] : null,
                 (float)($b['term_fee'] ?? 0), (int)($b['is_active'] ?? 1)];
        if ($id) {
            DB::run('UPDATE transport_routes SET name=?,bus_number=?,driver_name=?,driver_phone=?,capacity=?,term_fee=?,is_active=? WHERE id=? AND school_id=?',
                array_merge($cols, [$id, (int)$user['school_id']]));
            respond(['updated' => true]);
        }
        $nid = DB::exec('INSERT INTO transport_routes (school_id,name,bus_number,driver_name,driver_phone,capacity,term_fee,is_active) VALUES (?,?,?,?,?,?,?,?)',
            array_merge([(int)$user['school_id']], $cols));
        respond(['id' => $nid], 201, 'Route created');
    }

    public static function deleteRoute(array $user, int $id): void {
        Perm::assertAdmin($user);
        if (!DB::one('SELECT 1 x FROM transport_routes WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]))
            respond(null, 404, 'Route not found.');
        DB::run('DELETE FROM student_transport WHERE route_id=?', [$id]);
        DB::run('DELETE FROM transport_routes WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        respond(['deleted' => true]);
    }

    // Student assignments (pickup roster + fee status) for a term. ?term_id= filters.
    public static function assignments(array $user): void {
        $term = (int)($_GET['term_id'] ?? 0);
        $sql = 'SELECT st.id, st.student_id, st.route_id, st.term_id, st.pickup_point, st.fee_paid,
                       r.name AS route_name, r.term_fee,
                       u.first_name, u.last_name, s.student_id AS admission_no, c.name AS class_name
                FROM student_transport st
                JOIN transport_routes r ON r.id = st.route_id
                JOIN students s ON s.id = st.student_id
                JOIN users u ON u.id = s.user_id
                JOIN classes c ON c.id = s.class_id
                WHERE r.school_id = ?';
        $params = [(int)$user['school_id']];
        if ($term) { $sql .= ' AND st.term_id = ?'; $params[] = $term; }
        $sql .= ' ORDER BY u.last_name, u.first_name';
        respond(DB::query($sql, $params));
    }

    // Assign a student to a route for a term (idempotent — re-assigning moves them).
    public static function assign(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $studentId = (int)($b['student_id'] ?? 0);
        $routeId   = (int)($b['route_id'] ?? 0);
        $term      = (int)($b['term_id'] ?? 0);
        if (!$studentId || !$routeId || !$term) respond(null, 422, 'Student, route and term are required.');
        if (!DB::one('SELECT 1 x FROM transport_routes WHERE id=? AND school_id=?', [$routeId, (int)$user['school_id']]))
            respond(null, 404, 'Route not found.');
        DB::exec('INSERT INTO student_transport (student_id,route_id,term_id,pickup_point,fee_paid) VALUES (?,?,?,?,0)
                  ON DUPLICATE KEY UPDATE route_id=VALUES(route_id), pickup_point=VALUES(pickup_point)',
            [$studentId, $routeId, $term, ($b['pickup_point'] ?? null) ?: null]);
        respond(['assigned' => true]);
    }

    public static function unassign(array $user, int $id): void {
        Perm::assertAdmin($user);
        DB::run('DELETE st FROM student_transport st JOIN transport_routes r ON r.id=st.route_id WHERE st.id=? AND r.school_id=?',
            [$id, (int)$user['school_id']]);
        respond(['removed' => true]);
    }

    // Record (set) the transport fee paid on an assignment.
    public static function recordFee(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $id  = (int)($b['id'] ?? 0);
        $amt = max(0.0, (float)($b['fee_paid'] ?? 0));
        DB::run('UPDATE student_transport st JOIN transport_routes r ON r.id=st.route_id SET st.fee_paid=? WHERE st.id=? AND r.school_id=?',
            [$amt, $id, (int)$user['school_id']]);
        respond(['updated' => true]);
    }
}

// ─── HRController ─────────────────────────────────────────────────────────────
// Human-resources module: daily staff attendance, leave requests/approvals, and
// monthly payroll / payslips. All admin-only and scoped to the school.
class HRController {
    private const ATT_STATUSES   = ['present','absent','late','leave','holiday'];
    private const LEAVE_STATUSES = ['pending','approved','rejected'];

    private static function ownsStaff(array $user, int $staffId): bool {
        return (bool)DB::one('SELECT 1 x FROM staff s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.school_id=?',
            [$staffId, (int)$user['school_id']]);
    }

    // ── Staff attendance ──
    // Every staff member with their status for ?date= (null when unmarked).
    public static function staffAttendance(array $user): void {
        Perm::assertAdmin($user);
        $date = $_GET['date'] ?? date('Y-m-d');
        $rows = DB::query(
            'SELECT s.id AS staff_id, s.staff_id AS staff_code, s.department, s.designation,
                    u.first_name, u.last_name,
                    sa.status, sa.check_in, sa.remark
             FROM staff s JOIN users u ON u.id = s.user_id
             LEFT JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.date = ?
             WHERE u.school_id = ? AND u.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY u.last_name, u.first_name', [$date, (int)$user['school_id']]);
        respond(['date' => $date, 'staff' => $rows]);
    }

    public static function saveStaffAttendance(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $date = $b['date'] ?? date('Y-m-d');
        $recs = $b['records'] ?? [];
        $n = 0;
        foreach ($recs as $r) {
            $staffId = (int)($r['staff_id'] ?? 0);
            if (!$staffId || !self::ownsStaff($user, $staffId)) continue;
            $status = in_array($r['status'] ?? '', self::ATT_STATUSES, true) ? $r['status'] : 'present';
            DB::exec('INSERT INTO staff_attendance (staff_id,date,status,check_in,remark,recorded_by) VALUES (?,?,?,?,?,?)
                      ON DUPLICATE KEY UPDATE status=VALUES(status), check_in=VALUES(check_in), remark=VALUES(remark), recorded_by=VALUES(recorded_by)',
                [$staffId, $date, $status, ($r['check_in'] ?? null) ?: null, ($r['remark'] ?? null) ?: null, (int)$user['id']]);
            $n++;
        }
        respond(['saved' => $n]);
    }

    // ── Leave ──
    public static function leave(array $user): void {
        Perm::assertAdmin($user);
        respond(DB::query(
            'SELECT lr.*, u.first_name, u.last_name, s.staff_id AS staff_code, s.department,
                    au.first_name AS approver_first, au.last_name AS approver_last
             FROM leave_requests lr
             JOIN staff s ON s.id = lr.staff_id
             JOIN users u ON u.id = s.user_id
             LEFT JOIN users au ON au.id = lr.approved_by
             WHERE u.school_id = ? ORDER BY lr.created_at DESC', [(int)$user['school_id']]));
    }

    public static function requestLeave(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $staffId = (int)($b['staff_id'] ?? 0);
        $from = $b['from_date'] ?? ''; $to = $b['to_date'] ?? '';
        if (!$staffId || $from === '' || $to === '') respond(null, 422, 'Staff, from and to dates are required.');
        if (!self::ownsStaff($user, $staffId)) respond(null, 404, 'Staff not found.');
        $days = max(1, (int)floor((strtotime($to) - strtotime($from)) / 86400) + 1);
        $id = DB::exec('INSERT INTO leave_requests (staff_id,type,from_date,to_date,days,reason,status) VALUES (?,?,?,?,?,?,"pending")',
            [$staffId, $b['type'] ?? 'Casual Leave', $from, $to, $days, ($b['reason'] ?? null) ?: null]);
        respond(['id' => $id, 'days' => $days], 201, 'Leave requested');
    }

    public static function decideLeave(array $user, int $id): void {
        Perm::assertAdmin($user);
        $b = body();
        $status = in_array($b['status'] ?? '', self::LEAVE_STATUSES, true) ? $b['status'] : 'pending';
        DB::run('UPDATE leave_requests lr JOIN staff s ON s.id=lr.staff_id JOIN users u ON u.id=s.user_id
                 SET lr.status=?, lr.approved_by=? WHERE lr.id=? AND u.school_id=?',
            [$status, (int)$user['id'], $id, (int)$user['school_id']]);
        respond(['updated' => true, 'status' => $status]);
    }

    // ── Payroll / payslips ──
    public static function payroll(array $user): void {
        Perm::assertAdmin($user);
        $month = (int)($_GET['month'] ?? date('n'));
        $year  = (int)($_GET['year']  ?? date('Y'));
        respond(DB::query(
            'SELECT p.*, u.first_name, u.last_name, u.email,
                    s.staff_id AS staff_code, s.department, s.designation, s.bank_name, s.account_number
             FROM payroll p JOIN staff s ON s.id = p.staff_id JOIN users u ON u.id = s.user_id
             WHERE p.month = ? AND p.year = ? AND u.school_id = ? ORDER BY u.last_name',
            [$month, $year, (int)$user['school_id']]));
    }

    public static function savePayroll(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $staffId = (int)($b['staff_id'] ?? 0);
        $month = (int)($b['month'] ?? date('n'));
        $year  = (int)($b['year']  ?? date('Y'));
        if (!$staffId) respond(null, 422, 'Staff is required.');
        if ($month < 1 || $month > 12) respond(null, 422, 'Invalid month.');
        if (!self::ownsStaff($user, $staffId)) respond(null, 404, 'Staff not found.');
        DB::exec('INSERT INTO payroll (staff_id,month,year,basic,housing,transport,deductions) VALUES (?,?,?,?,?,?,?)
                  ON DUPLICATE KEY UPDATE basic=VALUES(basic), housing=VALUES(housing), transport=VALUES(transport), deductions=VALUES(deductions)',
            [$staffId, $month, $year, (float)($b['basic'] ?? 0), (float)($b['housing'] ?? 0), (float)($b['transport'] ?? 0), (float)($b['deductions'] ?? 0)]);
        respond(['saved' => true], 201, 'Payslip saved');
    }

    public static function payPayroll(array $user): void {
        Perm::assertAdmin($user);
        $id = (int)(body()['id'] ?? 0);
        DB::run('UPDATE payroll p JOIN staff s ON s.id=p.staff_id JOIN users u ON u.id=s.user_id
                 SET p.status="paid", p.paid_date=CURDATE() WHERE p.id=? AND u.school_id=?',
            [$id, (int)$user['school_id']]);
        respond(['paid' => true]);
    }
}

// ─── AnalyticsController ──────────────────────────────────────────────────────
// Read-only reporting dashboards aggregated from live data: student performance,
// attendance, finance, admissions. Admin-only; all scoped to the school.
class AnalyticsController {
    // Resolve the term to report on: ?term_id=, else the current term, else latest.
    private static function termId(array $user): int {
        $t = (int)($_GET['term_id'] ?? 0);
        if ($t) return $t;
        $sid = (int)$user['school_id'];
        $row = DB::one('SELECT t.id FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id
                        WHERE ay.school_id=? ORDER BY t.is_current DESC, t.id DESC LIMIT 1', [$sid]);
        return (int)($row['id'] ?? 0);
    }

    public static function performance(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id']; $term = self::termId($user);
        // Derived per (student, subject) total score for the term (CA + exam summed).
        $t = '(SELECT g.student_id, g.subject_id, st.class_id, SUM(g.score) total
               FROM grades g JOIN students st ON st.id=g.student_id JOIN users u ON u.id=st.user_id
               WHERE g.term_id=? AND u.school_id=? GROUP BY g.student_id, g.subject_id, st.class_id)';
        $bySubject = DB::query("SELECT sub.name AS label, ROUND(AVG(t.total),1) AS value FROM $t t JOIN subjects sub ON sub.id=t.subject_id GROUP BY t.subject_id ORDER BY value DESC", [$term,$sid]);
        $byClass   = DB::query("SELECT c.name AS label, ROUND(AVG(t.total),1) AS value FROM $t t JOIN classes c ON c.id=t.class_id GROUP BY t.class_id ORDER BY c.name", [$term,$sid]);
        $summary   = DB::one("SELECT ROUND(AVG(so.avg_pct),1) school_average, COALESCE(SUM(so.avg_pct<50),0) at_risk, COALESCE(SUM(so.avg_pct>=80),0) distinction, ROUND(MAX(so.avg_pct),1) top
                              FROM (SELECT t.student_id, AVG(t.total) avg_pct FROM $t t GROUP BY t.student_id) so", [$term,$sid]);
        $rankings  = DB::query("SELECT c.name AS class_name, ROUND(AVG(so.avg_pct),1) avg, COALESCE(SUM(so.avg_pct>=50),0) passed, COALESCE(SUM(so.avg_pct<50),0) failed
                                FROM (SELECT t.student_id, t.class_id, AVG(t.total) avg_pct FROM $t t GROUP BY t.student_id, t.class_id) so
                                JOIN classes c ON c.id=so.class_id GROUP BY so.class_id ORDER BY avg DESC", [$term,$sid]);
        respond(['term_id'=>$term, 'summary'=>$summary ?: ['school_average'=>null,'at_risk'=>0,'distinction'=>0,'top'=>null],
                 'by_subject'=>$bySubject, 'by_class'=>$byClass, 'rankings'=>$rankings]);
    }

    public static function attendance(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id']; $term = self::termId($user);
        $overall = DB::one("SELECT COUNT(*) total, COALESCE(SUM(a.status NOT LIKE 'absent%'),0) present
                            FROM attendance a JOIN students st ON st.id=a.student_id JOIN users u ON u.id=st.user_id
                            WHERE a.term_id=? AND u.school_id=?", [$term,$sid]);
        $total = (int)($overall['total'] ?? 0); $present = (int)($overall['present'] ?? 0);
        $byClass = DB::query("SELECT c.name AS label, ROUND(100*SUM(a.status NOT LIKE 'absent%')/COUNT(*),1) AS value
                              FROM attendance a JOIN classes c ON c.id=a.class_id JOIN students st ON st.id=a.student_id JOIN users u ON u.id=st.user_id
                              WHERE a.term_id=? AND u.school_id=? GROUP BY a.class_id ORDER BY value DESC", [$term,$sid]);
        $chronic = (int)(DB::one("SELECT COUNT(*) c FROM (SELECT a.student_id FROM attendance a JOIN students st ON st.id=a.student_id JOIN users u ON u.id=st.user_id
                            WHERE a.term_id=? AND u.school_id=? AND a.status LIKE 'absent%' GROUP BY a.student_id HAVING COUNT(*)>5) x", [$term,$sid])['c'] ?? 0);
        respond(['term_id'=>$term, 'overall_rate'=>$total?round(100*$present/$total,1):null, 'records'=>$total, 'present'=>$present,
                 'chronic_absent'=>$chronic, 'by_class'=>$byClass]);
    }

    public static function finance(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id']; $term = self::termId($user);
        $inv = DB::one('SELECT COALESCE(SUM(i.total_amount),0) invoiced, COALESCE(SUM(i.amount_paid),0) collected, COALESCE(SUM(i.balance),0) outstanding
                        FROM invoices i JOIN students s ON s.id=i.student_id JOIN users u ON u.id=s.user_id WHERE u.school_id=?', [$sid]);
        $exp = (float)(DB::one('SELECT COALESCE(SUM(amount),0) t FROM expenses WHERE school_id=?', [$sid])['t'] ?? 0);
        $invoiced = (float)($inv['invoiced'] ?? 0); $collected = (float)($inv['collected'] ?? 0);
        $byTerm = DB::query('SELECT t.name AS label, COALESCE(SUM(i.amount_paid),0) AS value
                             FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id AND ay.school_id=?
                             LEFT JOIN invoices i ON i.term_id=t.id GROUP BY t.id ORDER BY t.id', [$sid]);
        $byCat  = DB::query('SELECT category AS label, COALESCE(SUM(amount),0) AS value FROM expenses WHERE school_id=? GROUP BY category ORDER BY value DESC', [$sid]);
        respond(['invoiced'=>$invoiced, 'collected'=>$collected, 'outstanding'=>(float)($inv['outstanding'] ?? 0),
                 'expenses'=>$exp, 'net'=>$collected-$exp, 'collection_rate'=>$invoiced?round(100*$collected/$invoiced,1):null,
                 'by_term'=>$byTerm, 'by_category'=>$byCat]);
    }

    public static function admissions(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        $byStatus = DB::query('SELECT status AS label, COUNT(*) AS value FROM admission_applications WHERE school_id=? GROUP BY status', [$sid]);
        $total = array_sum(array_map(fn($r)=>(int)$r['value'], $byStatus));
        $byClass = DB::query('SELECT COALESCE(NULLIF(apply_class,""),"Unspecified") AS label, COUNT(*) AS value FROM admission_applications WHERE school_id=? GROUP BY apply_class ORDER BY value DESC', [$sid]);
        $byGender = DB::query('SELECT COALESCE(gender,"unspecified") AS label, COUNT(*) AS value FROM admission_applications WHERE school_id=? GROUP BY gender', [$sid]);
        $enrolled = (int)(DB::one('SELECT COUNT(*) c FROM students s JOIN users u ON u.id=s.user_id WHERE u.school_id=? AND s.deleted_at IS NULL', [$sid])['c'] ?? 0);
        respond(['total'=>$total, 'enrolled'=>$enrolled, 'by_status'=>$byStatus, 'by_class'=>$byClass, 'by_gender'=>$byGender]);
    }
}

// ─── AssignmentController ─────────────────────────────────────────────────────
// Online assignments a teacher posts for a class; students submit; teacher grades.
class AssignmentController {
    // Admin, the class's form teacher, or a teacher of the subject in that class.
    private static function assertCanManage(array $user, int $classId, ?int $subjectId): void {
        if (Perm::isAdmin($user)) return;
        if (Perm::canManageClass($user, $classId)) return;
        if ($subjectId && Perm::teachesSubjectInClass($user, $classId, $subjectId)) return;
        respond(null, 403, 'You can only manage assignments for your own classes.');
    }

    private static function load(array $user, int $id): array {
        $a = DB::one('SELECT * FROM assignments WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        if (!$a) respond(null, 404, 'Assignment not found');
        return $a;
    }

    // List assignments (admins: all; staff: their classes). ?class_id= filters.
    public static function index(array $user): void {
        $sid = (int)$user['school_id'];
        $where = ['a.school_id = ?']; $params = [$sid];
        if ($cid = (int)($_GET['class_id'] ?? 0)) { $where[] = 'a.class_id = ?'; $params[] = $cid; }
        if (!Perm::isAdmin($user)) {
            $cids = Perm::teacherClassIds($user);
            if (!$cids) { respond([]); }
            $where[] = 'a.class_id IN (' . implode(',', array_fill(0, count($cids), '?')) . ')';
            $params = array_merge($params, $cids);
        }
        $sql = 'SELECT a.*, c.name AS class_name, sub.name AS subject_name,
                       (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id=a.id) AS submitted,
                       (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id=a.id AND s.marks IS NOT NULL) AS graded,
                       (SELECT COUNT(*) FROM students st WHERE st.class_id=a.class_id AND st.deleted_at IS NULL) AS class_size
                FROM assignments a
                JOIN classes c ON c.id=a.class_id
                LEFT JOIN subjects sub ON sub.id=a.subject_id
                WHERE ' . implode(' AND ', $where) . ' ORDER BY a.created_at DESC';
        respond(DB::query($sql, $params));
    }

    public static function store(array $user): void {
        $b = body();
        $classId = (int)($b['class_id'] ?? 0);
        $subjectId = ($b['subject_id'] ?? null) ? (int)$b['subject_id'] : null;
        $title = trim((string)($b['title'] ?? ''));
        if (!$classId || $title === '') respond(null, 422, 'Class and title are required.');
        self::assertCanManage($user, $classId, $subjectId);
        $id = DB::exec('INSERT INTO assignments (school_id,class_id,subject_id,term_id,title,instructions,resource_url,due_date,max_marks,created_by)
                        VALUES (?,?,?,?,?,?,?,?,?,?)',
            [(int)$user['school_id'], $classId, $subjectId, ($b['term_id'] ?? null) ?: null, $title,
             ($b['instructions'] ?? null) ?: null, ($b['resource_url'] ?? null) ?: null, ($b['due_date'] ?? null) ?: null,
             (int)($b['max_marks'] ?? 100), (int)$user['id']]);
        respond(['id' => $id], 201, 'Assignment posted');
    }

    public static function update(array $user, int $id): void {
        $a = self::load($user, $id);
        self::assertCanManage($user, (int)$a['class_id'], $a['subject_id'] ? (int)$a['subject_id'] : null);
        $b = body();
        DB::run('UPDATE assignments SET title=COALESCE(?,title), instructions=?, resource_url=?, due_date=?, max_marks=COALESCE(?,max_marks), subject_id=? WHERE id=? AND school_id=?',
            [($b['title'] ?? null) ?: null, ($b['instructions'] ?? null) ?: null, ($b['resource_url'] ?? null) ?: null,
             ($b['due_date'] ?? null) ?: null, isset($b['max_marks']) ? (int)$b['max_marks'] : null,
             ($b['subject_id'] ?? null) ? (int)$b['subject_id'] : null, $id, (int)$user['school_id']]);
        respond(['updated' => true]);
    }

    public static function destroy(array $user, int $id): void {
        $a = self::load($user, $id);
        self::assertCanManage($user, (int)$a['class_id'], $a['subject_id'] ? (int)$a['subject_id'] : null);
        DB::run('DELETE FROM assignments WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);  // submissions cascade
        respond(['deleted' => true]);
    }

    // Every student in the assignment's class with their submission (if any).
    public static function submissions(array $user, int $id): void {
        $a = self::load($user, $id);
        self::assertCanManage($user, (int)$a['class_id'], $a['subject_id'] ? (int)$a['subject_id'] : null);
        $rows = DB::query(
            'SELECT st.id AS student_id, st.student_id AS admission_no, u.first_name, u.last_name,
                    s.id AS submission_id, s.content, s.link_url, s.submitted_at, s.marks, s.feedback
             FROM students st JOIN users u ON u.id=st.user_id
             LEFT JOIN assignment_submissions s ON s.assignment_id=? AND s.student_id=st.id
             WHERE st.class_id=? AND st.deleted_at IS NULL
             ORDER BY u.last_name, u.first_name', [$id, (int)$a['class_id']]);
        respond(['assignment' => $a, 'submissions' => $rows]);
    }

    // Grade one submission (marks + feedback).
    public static function grade(array $user, int $subId): void {
        $sub = DB::one('SELECT s.*, a.class_id, a.subject_id, a.school_id, a.max_marks
                        FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=?', [$subId]);
        if (!$sub || (int)$sub['school_id'] !== (int)$user['school_id']) respond(null, 404, 'Submission not found');
        self::assertCanManage($user, (int)$sub['class_id'], $sub['subject_id'] ? (int)$sub['subject_id'] : null);
        $b = body();
        $marks = ($b['marks'] === '' || $b['marks'] === null) ? null : max(0.0, min((float)$sub['max_marks'], (float)$b['marks']));
        DB::run('UPDATE assignment_submissions SET marks=?, feedback=?, graded_by=?, graded_at=NOW() WHERE id=?',
            [$marks, ($b['feedback'] ?? null) ?: null, (int)$user['id'], $subId]);
        respond(['graded' => true, 'marks' => $marks]);
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

    public static function storeBook(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $title = trim((string)($b['title'] ?? ''));
        if ($title === '') respond(null, 422, 'Book title is required.');
        $total = max(1, (int)($b['total_copies'] ?? 1));
        $id = DB::exec('INSERT INTO library_books (school_id,isbn,title,author,category,total_copies,available) VALUES (?,?,?,?,?,?,?)',
            [(int)$user['school_id'], $b['isbn'] ?? null, $title, $b['author'] ?? null, $b['category'] ?? null, $total, $total]);
        respond(['id' => $id], 201, 'Book added');
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

// ─── AcademicController ───────────────────────────────────────────────────────
// Academic sessions (years) and their terms. A school needs at least one session
// before classes, grades or attendance can be created.
class AcademicController {
    public static function listYears(array $user): void {
        $sid = (int)$user['school_id'];
        $years = DB::query('SELECT id,name,start_date,end_date,is_current FROM academic_years WHERE school_id=? AND deleted_at IS NULL ORDER BY is_current DESC, id DESC', [$sid]);
        foreach ($years as &$y) {
            $y['terms'] = DB::query('SELECT id,name,start_date,end_date,is_current FROM terms WHERE academic_year_id=? AND deleted_at IS NULL ORDER BY id', [(int)$y['id']]);
        }
        respond($years);
    }

    // Create a session and (by default) auto-generate its three terms, splitting
    // the date range into thirds. If marked current, its first term is current too.
    public static function createYear(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        $b   = body();
        $name  = trim((string)($b['name'] ?? ''));
        $start = trim((string)($b['start_date'] ?? ''));
        $end   = trim((string)($b['end_date'] ?? ''));
        if ($name === '' || $start === '' || $end === '') respond(null, 422, 'Session name, start date and end date are required.');
        if (strtotime($start) === false || strtotime($end) === false || strtotime($end) <= strtotime($start))
            respond(null, 422, 'Provide a valid start date and a later end date.');
        if (DB::one('SELECT id FROM academic_years WHERE school_id=? AND name=? AND deleted_at IS NULL', [$sid, $name]))
            respond(null, 409, 'A session named "'.$name.'" already exists.');
        $makeCurrent = !empty($b['is_current']);
        $makeTerms   = array_key_exists('make_terms', $b) ? !empty($b['make_terms']) : true;

        DB::conn()->beginTransaction();
        try {
            if ($makeCurrent) DB::run('UPDATE academic_years SET is_current=0 WHERE school_id=?', [$sid]);
            $yearId = DB::exec('INSERT INTO academic_years (school_id,name,start_date,end_date,is_current) VALUES (?,?,?,?,?)',
                [$sid, $name, $start, $end, $makeCurrent ? 1 : 0]);

            if ($makeTerms) {
                $s = new DateTime($start); $e = new DateTime($end);
                $seg = max(1, intdiv((int)$s->diff($e)->days, 3));
                $labels = ['1st Term', '2nd Term', '3rd Term'];
                for ($i = 0; $i < 3; $i++) {
                    $ts = (clone $s)->modify('+' . ($seg * $i) . ' days');
                    $te = ($i === 2) ? clone $e : (clone $s)->modify('+' . (($seg * ($i + 1)) - 1) . ' days');
                    DB::run('INSERT INTO terms (academic_year_id,name,start_date,end_date,is_current) VALUES (?,?,?,?,?)',
                        [$yearId, $labels[$i], $ts->format('Y-m-d'), $te->format('Y-m-d'), ($makeCurrent && $i === 0) ? 1 : 0]);
                }
            }
            DB::conn()->commit();
        } catch (Throwable $ex) { DB::conn()->rollBack(); throw $ex; }
        respond(['id' => $yearId], 201, 'Academic session created');
    }

    // Mark a session (and unset the others) as the current one.
    public static function setCurrentYear(array $user, int $id): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        if (!DB::one('SELECT id FROM academic_years WHERE id=? AND school_id=? AND deleted_at IS NULL', [$id, $sid]))
            respond(null, 404, 'Session not found.');
        DB::run('UPDATE academic_years SET is_current=0 WHERE school_id=?', [$sid]);
        DB::run('UPDATE academic_years SET is_current=1 WHERE id=?', [$id]);
        respond(['is_current' => $id]);
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

    // Corrections for one of the student's OWN submissions: each question with the
    // student's answer, whether it was right, the correct answer, and marks.
    // Only available once the score is visible (teacher released results, or the
    // exam shows scores immediately) — never leaks answers before then.
    public static function myResultDetail(array $user, int $subId): void {
        $s = self::me($user);
        $sub = DB::one(
            'SELECT es.*, e.title AS exam_title, e.show_score, e.results_released, sub.name AS subject_name
             FROM exam_submissions es
             JOIN exams e   ON e.id = es.exam_id
             JOIN subjects sub ON sub.id = e.subject_id
             WHERE es.id = ? AND es.student_id = ?', [$subId, $s['id']]);
        if (!$sub) respond(null, 404, 'Result not found.');
        if (!self::scoreVisible($sub)) {
            respond(null, 403, 'Your teacher has not released the corrections for this exam yet.');
        }

        $answers    = json_decode($sub['answers'] ?? '[]', true) ?: [];
        $subjScores = json_decode($sub['subjective_scores'] ?? 'null', true) ?: [];
        $questions  = DB::query('SELECT id,type,question,options,answer,marks FROM exam_questions WHERE exam_id=? ORDER BY sort_order', [(int)$sub['exam_id']]);
        foreach ($questions as &$q) {
            $ans = $answers[$q['id']] ?? null;
            $q['student_answer'] = $ans;
            $q['options'] = json_decode($q['options'] ?? 'null', true);
            if (in_array($q['type'], ['mcq','tf'], true)) {
                $q['objective']  = true;
                $q['is_correct'] = self::isCorrect($q, $ans);
                $q['awarded']    = $q['is_correct'] ? (int)$q['marks'] : 0;
            } else {
                $q['objective'] = false;
                $q['awarded']   = isset($subjScores[$q['id']]) ? (float)$subjScores[$q['id']] : null;
            }
        }
        respond([
            'submission' => [
                'id' => (int)$sub['id'], 'exam_title' => $sub['exam_title'], 'subject_name' => $sub['subject_name'],
                'score' => $sub['score'], 'max_score' => $sub['max_score'], 'needs_review' => (int)$sub['needs_review'],
                'submitted_at' => $sub['submitted_at'],
            ],
            'questions' => $questions,
        ]);
    }

    // Assignments for this student's class, with their submission state.
    public static function myAssignments(array $user): void {
        $s = self::me($user);
        $rows = DB::query(
            'SELECT a.id, a.title, a.instructions, a.resource_url, a.due_date, a.max_marks, a.created_at,
                    sub.name AS subject_name,
                    asm.id AS submission_id, asm.content, asm.link_url, asm.submitted_at, asm.marks, asm.feedback
             FROM assignments a
             LEFT JOIN subjects sub ON sub.id=a.subject_id
             LEFT JOIN assignment_submissions asm ON asm.assignment_id=a.id AND asm.student_id=?
             WHERE a.class_id=? ORDER BY (a.due_date IS NULL), a.due_date ASC, a.created_at DESC',
            [$s['id'], $s['class_id']]);
        foreach ($rows as &$r) {
            $r['submitted'] = !empty($r['submission_id']);
            $r['graded']    = $r['marks'] !== null;
        }
        respond($rows);
    }

    // Create or update this student's submission for an assignment.
    public static function submitAssignment(array $user): void {
        $s = self::me($user);
        $b = body();
        $aid = (int)($b['assignment_id'] ?? 0);
        $a = DB::one('SELECT id, class_id FROM assignments WHERE id=? AND school_id=?', [$aid, (int)$user['school_id']]);
        if (!$a || (int)$a['class_id'] !== (int)$s['class_id']) respond(null, 404, 'Assignment not found for your class.');
        $content = trim((string)($b['content'] ?? ''));
        $link    = trim((string)($b['link_url'] ?? ''));
        if ($content === '' && $link === '') respond(null, 422, 'Enter your answer or a link.');
        // Re-submitting before grading updates the submission; after grading it is locked.
        $existing = DB::one('SELECT id, marks FROM assignment_submissions WHERE assignment_id=? AND student_id=?', [$aid, $s['id']]);
        if ($existing && $existing['marks'] !== null) respond(null, 409, 'This assignment has already been graded.');
        DB::exec('INSERT INTO assignment_submissions (assignment_id,student_id,content,link_url,submitted_at) VALUES (?,?,?,?,NOW())
                  ON DUPLICATE KEY UPDATE content=VALUES(content), link_url=VALUES(link_url), submitted_at=NOW()',
            [$aid, $s['id'], $content ?: null, $link ?: null]);
        respond(['submitted' => true], 201, 'Submitted');
    }

    // Robustly compare a student's answer to the stored correct answer.
    public static function isCorrect(array $q, $ans): bool {
        if ($ans === null || $ans === '') return false;
        $correct = trim((string)($q['answer'] ?? ''));
        if ($correct === '') return false;
        if ($q['type'] === 'mcq') {
            // options may already be decoded to an array by the caller (the admin
            // review path decodes it before calling this), so only json_decode a
            // string — json_decode(array) is a TypeError on PHP 8 and would 500.
            $opts = is_array($q['options'] ?? null)
                ? $q['options']
                : (json_decode($q['options'] ?? '[]', true) ?: []);
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

    // ───────────────────────────────────────────────────────────────────────────
    // Mobile student endpoints — profile, password, fees, attendance, timetable,
    // notices, and a consolidated dashboard. The exam/results/assignment endpoints
    // above complete the set. All resolve the current student via me().
    // ───────────────────────────────────────────────────────────────────────────

    // Consolidated home screen: counts the student cares about at a glance.
    public static function myDashboard(array $user): void {
        $s = self::me($user);
        $openExams = (int)(DB::one(
            'SELECT COUNT(*) c FROM exams e WHERE e.class_id=? AND e.status="active"
             AND NOT EXISTS (SELECT 1 FROM exam_submissions es WHERE es.exam_id=e.id AND es.student_id=?)',
            [$s['class_id'], $s['id']])['c'] ?? 0);
        $pendingAssignments = (int)(DB::one(
            'SELECT COUNT(*) c FROM assignments a WHERE a.class_id=?
             AND NOT EXISTS (SELECT 1 FROM assignment_submissions asm WHERE asm.assignment_id=a.id AND asm.student_id=?)',
            [$s['class_id'], $s['id']])['c'] ?? 0);
        $outstanding = (float)(DB::one('SELECT COALESCE(SUM(balance),0) t FROM invoices WHERE student_id=? AND status<>"paid"', [$s['id']])['t'] ?? 0);
        $att = DB::one('SELECT COUNT(*) total, SUM(status="present") present FROM attendance WHERE student_id=?', [$s['id']]);
        $rate = ($att && (int)$att['total'] > 0) ? (int)round(100 * (int)$att['present'] / (int)$att['total']) : null;
        $unread = (int)(DB::one('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0', [(int)$user['id']])['c'] ?? 0);
        respond([
            'open_exams'           => $openExams,
            'pending_assignments'  => $pendingAssignments,
            'fees_outstanding'     => $outstanding,
            'attendance_rate'      => $rate,
            'unread_notifications' => $unread,
        ]);
    }

    // Full profile for the signed-in student (read-only identity + guardian + school).
    public static function profile(array $user): void {
        $row = DB::one(
            'SELECT s.id, s.student_id, s.admission_number, s.admission_date, s.blood_group, s.genotype,
                    s.guardian_name, s.guardian_phone, s.guardian_email, s.guardian_address,
                    u.first_name, u.last_name, u.email, u.phone, u.gender, u.date_of_birth, u.address, u.avatar_url,
                    c.id AS class_id, c.name AS class_name
             FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
             WHERE s.user_id=? AND s.deleted_at IS NULL', [(int)$user['id']]);
        if (!$row) respond(null, 403, 'This account is not a student.');
        $row['school'] = DB::one('SELECT name, logo_url, motto, email, phone, address FROM schools WHERE id=?', [(int)$user['school_id']]);
        respond($row);
    }

    // Student may update only their own contact details (not name/class/ID).
    public static function updateProfile(array $user): void {
        $s = self::me($user);
        $b = body();
        $uf = []; $up = [];
        foreach (['phone', 'address', 'avatar_url'] as $f) {
            if (array_key_exists($f, $b)) { $uf[] = "`$f`=?"; $up[] = ($b[$f] === '' ? null : $b[$f]); }
        }
        if ($uf) { $up[] = (int)$user['id']; DB::run('UPDATE users SET ' . implode(',', $uf) . ' WHERE id=?', $up); }
        $sf = []; $sp = [];
        foreach (['guardian_phone', 'guardian_email', 'guardian_address'] as $f) {
            if (array_key_exists($f, $b)) { $sf[] = "`$f`=?"; $sp[] = ($b[$f] === '' ? null : $b[$f]); }
        }
        if ($sf) { $sp[] = $s['id']; DB::run('UPDATE students SET ' . implode(',', $sf) . ' WHERE id=?', $sp); }
        respond(['updated' => true], 200, 'Profile updated');
    }

    public static function changePassword(array $user): void {
        $b = body();
        $cur = (string)($b['current_password'] ?? '');
        $new = (string)($b['new_password'] ?? '');
        if (strlen($new) < 6) respond(null, 422, 'New password must be at least 6 characters.');
        $row = DB::one('SELECT password FROM users WHERE id=?', [(int)$user['id']]);
        if (!$row || !password_verify($cur, $row['password'])) respond(null, 401, 'Current password is incorrect.');
        DB::run('UPDATE users SET password=? WHERE id=?', [password_hash($new, PASSWORD_BCRYPT), (int)$user['id']]);
        respond(['updated' => true], 200, 'Password changed');
    }

    // The student's own invoices, balance summary and recent payments.
    public static function myFees(array $user): void {
        $s = self::me($user);
        $summary = DB::one(
            'SELECT COALESCE(SUM(total_amount),0) billed, COALESCE(SUM(amount_paid),0) paid,
                    COALESCE(SUM(balance),0) outstanding
             FROM invoices WHERE student_id=?', [$s['id']]);
        $invoices = DB::query(
            'SELECT i.id, i.invoice_no, i.total_amount, i.amount_paid, i.balance, i.status, i.due_date, i.created_at,
                    t.name AS term_name
             FROM invoices i LEFT JOIN terms t ON t.id=i.term_id
             WHERE i.student_id=? ORDER BY i.id DESC', [$s['id']]);
        $payments = DB::query(
            'SELECT p.amount, p.method, p.payment_date, p.reference, i.invoice_no
             FROM payments p JOIN invoices i ON i.id=p.invoice_id
             WHERE i.student_id=? ORDER BY p.id DESC LIMIT 20', [$s['id']]);
        respond(['summary' => $summary, 'invoices' => $invoices, 'payments' => $payments]);
    }

    // Attendance summary + the most recent records.
    public static function myAttendance(array $user): void {
        $s = self::me($user);
        $summary = DB::one(
            'SELECT COUNT(*) total, SUM(status="present") present,
                    SUM(status LIKE "absent%") absent, SUM(status LIKE "late%") late
             FROM attendance WHERE student_id=?', [$s['id']]);
        $rate = ($summary && (int)$summary['total'] > 0)
            ? (int)round(100 * (int)$summary['present'] / (int)$summary['total']) : null;
        $recent = DB::query('SELECT date, status, comment FROM attendance WHERE student_id=? ORDER BY date DESC LIMIT 30', [$s['id']]);
        respond(['summary' => $summary, 'rate' => $rate, 'recent' => $recent]);
    }

    // The student's class timetable for the current term (all terms if none is current).
    public static function myTimetable(array $user): void {
        $s = self::me($user);
        $where = 'tt.class_id=?'; $p = [$s['class_id']];
        $term = DB::one('SELECT id FROM terms WHERE is_current=1 ORDER BY id DESC LIMIT 1');
        if ($term) { $where .= ' AND tt.term_id=?'; $p[] = (int)$term['id']; }
        $rows = DB::query(
            'SELECT tt.day, tt.period, tt.start_time, tt.end_time, sub.name AS subject_name,
                    CONCAT(u.first_name, " ", u.last_name) AS teacher
             FROM timetable_slots tt
             JOIN subjects sub ON sub.id=tt.subject_id
             LEFT JOIN users u ON u.id=tt.teacher_id
             WHERE ' . $where . '
             ORDER BY FIELD(tt.day,"Monday","Tuesday","Wednesday","Thursday","Friday"), tt.period', $p);
        respond($rows);
    }

    // Personal notifications + upcoming school/class events relevant to the student.
    public static function myNotices(array $user): void {
        $s = self::me($user);
        $notifications = DB::query(
            'SELECT id, title, body, type, is_read, created_at FROM notifications
             WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [(int)$user['id']]);
        $events = DB::query(
            'SELECT id, title, description, event_date, audience FROM events
             WHERE school_id=? AND deleted_at IS NULL AND event_date >= CURDATE()
               AND (audience="all_guardians" OR (audience="class_guardians" AND class_id=?))
             ORDER BY event_date ASC LIMIT 20', [(int)$user['school_id'], $s['class_id']]);
        respond(['notifications' => $notifications, 'events' => $events]);
    }

    // Mark one of the student's own notifications as read.
    public static function markNotification(array $user, int $id): void {
        DB::run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [$id, (int)$user['id']]);
        respond(['updated' => true]);
    }
}

// ─── Notify ───────────────────────────────────────────────────────────────────
// Channel adapters for the Communications module. Email uses PHP mail() (works
// with zero configuration). WhatsApp uses Twilio, but only when config/twilio.php
// is present and filled in — otherwise WhatsApp sends are reported as "skipped".
// Nothing else in the app talks to the mail server or Twilio, so either channel
// can be swapped out here without touching the controllers.
class Notify {
    // Twilio config array, or null when the file is missing / still a placeholder.
    public static function twilioConfig(): ?array {
        $path = dirname(__DIR__, 2) . '/config/twilio.php';
        if (!is_file($path)) return null;
        $cfg = @require $path;
        if (!is_array($cfg)) return null;
        $sid  = trim((string)($cfg['account_sid'] ?? ''));
        $tok  = trim((string)($cfg['auth_token'] ?? ''));
        $from = trim((string)($cfg['whatsapp_from'] ?? ''));
        if ($sid === '' || $tok === '' || $from === '') return null;
        if (strncmp($sid, 'YOUR_', 5) === 0 || strncmp($tok, 'YOUR_', 5) === 0) return null;
        return $cfg;
    }

    public static function whatsAppConfigured(): bool { return self::twilioConfig() !== null; }

    // Normalise a phone number to E.164. Nigerian local formats (0803…, 234803…,
    // +234803…) all map to +234803…. Returns null when it can't be understood.
    public static function toE164(?string $phone, string $country = '234'): ?string {
        $p = preg_replace('/[^\d+]/', '', (string)$phone);
        if ($p === '') return null;
        if ($p[0] === '+')            return strlen($p) >= 8 ? $p : null;
        if (strncmp($p, '00', 2) === 0) $p = substr($p, 2);          // 00<cc>… intl prefix
        if ($p === '')                return null;
        if ($p[0] === '0')            return '+' . $country . substr($p, 1); // local 0803…
        if (strncmp($p, $country, strlen($country)) === 0) return '+' . $p;  // already has cc
        if (strlen($p) >= 10)         return '+' . $country . $p;     // bare subscriber number
        return null;
    }

    // Send an HTML email via the built-in mailer. Returns [bool ok, ?string error].
    public static function email(string $to, string $subject, string $html, array $school): array {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return [false, 'Invalid email address'];
        $domain   = preg_replace('/^(www|portal|api)\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
        $from     = 'noreply@' . $domain;
        $fromName = preg_replace('/[\r\n"]/', '', (string)($school['name'] ?? 'School'));
        $headers  = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n"
                  . "From: \"$fromName\" <$from>\r\n"
                  . (!empty($school['email']) && filter_var($school['email'], FILTER_VALIDATE_EMAIL) ? "Reply-To: {$school['email']}\r\n" : '');
        $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $ok = @mail($to, $subj, $html, $headers);
        return [$ok, $ok ? null : 'Mail server rejected the message'];
    }

    // Send a WhatsApp message via Twilio. $cfg comes from twilioConfig().
    public static function whatsApp(array $cfg, string $toE164, string $text): array {
        $sid  = (string)$cfg['account_sid'];
        $tok  = (string)$cfg['auth_token'];
        $raw  = (string)$cfg['whatsapp_from'];
        $from = 'whatsapp:' . (strncmp($raw, '+', 1) === 0 ? $raw : '+' . $raw);
        $url  = 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($sid) . '/Messages.json';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_USERPWD        => $sid . ':' . $tok,
            CURLOPT_POSTFIELDS     => http_build_query(['From' => $from, 'To' => 'whatsapp:' . $toE164, 'Body' => $text]),
            CURLOPT_TIMEOUT        => (int)($cfg['timeout'] ?? 20),
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $res  = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cerr = curl_error($ch);
        curl_close($ch);
        if ($res === false) return [false, 'Twilio request failed: ' . $cerr];
        $j = json_decode($res, true);
        if ($http >= 400) return [false, is_array($j) ? ($j['message'] ?? ('Twilio HTTP ' . $http)) : ('Twilio HTTP ' . $http)];
        return [true, null];
    }

    // Wrap a plain-text message in a simple, school-branded HTML email body.
    public static function htmlBody(array $school, string $subject, string $message): string {
        $h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $paras = preg_split('/\n{2,}/', trim($message)) ?: [''];
        $body  = implode('', array_map(fn($p) => '<p style="margin:0 0 12px">' . nl2br($h($p)) . '</p>', $paras));
        $name  = $school['name'] ?? 'School';
        return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:auto;color:#1f2937">'
             . '<h2 style="margin:0 0 4px">' . $h($name) . '</h2>'
             . ($subject !== '' ? '<p style="margin:0 0 16px;color:#6b7280;font-size:14px">' . $h($subject) . '</p>' : '')
             . '<div style="font-size:15px;line-height:1.5">' . $body . '</div>'
             . '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">'
             . '<p style="font-size:12px;color:#9ca3af">Sent via ' . $h($name) . ' &middot; LearnersForge</p></div>';
    }
}

// ─── CommunicationController ──────────────────────────────────────────────────
// Admin broadcasts (email + WhatsApp), event reminders, and a read-only parent-
// portal preview. Recipients are resolved from live data — student guardians and
// staff users — and every send is logged in communications / communication_recipients.
class CommunicationController {
    private const AUDIENCES = ['all_guardians', 'class_guardians', 'all_staff'];

    // Resolve an audience to recipients: list of ['name','email','phone'].
    private static function recipients(int $sid, string $audience, ?int $classId): array {
        if ($audience === 'all_staff') {
            return DB::query(
                "SELECT CONCAT(first_name,' ',last_name) name, email, phone
                   FROM users
                  WHERE school_id=? AND deleted_at IS NULL AND is_active=1
                    AND role IN ('school_admin','teacher','accountant')", [$sid]);
        }
        // Guardian audiences read contact details straight off the students table.
        $sql = "SELECT COALESCE(NULLIF(s.guardian_name,''), CONCAT(u.first_name,' ',u.last_name)) name,
                       s.guardian_email email, s.guardian_phone phone
                  FROM students s JOIN users u ON u.id=s.user_id
                 WHERE u.school_id=? AND s.deleted_at IS NULL";
        $params = [$sid];
        if ($audience === 'class_guardians') {
            if (!$classId) respond(null, 422, 'Pick a class for a single-class audience.');
            $sql .= ' AND s.class_id=?'; $params[] = $classId;
        }
        return DB::query($sql, $params);
    }

    // GET /communications/audiences — options with live recipient counts.
    public static function audiences(array $user): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        $guardians = (int)(DB::one(
            "SELECT COUNT(*) c FROM students s JOIN users u ON u.id=s.user_id
              WHERE u.school_id=? AND s.deleted_at IS NULL
                AND (COALESCE(s.guardian_email,'')<>'' OR COALESCE(s.guardian_phone,'')<>'')", [$sid])['c'] ?? 0);
        $staff = (int)(DB::one(
            "SELECT COUNT(*) c FROM users WHERE school_id=? AND deleted_at IS NULL AND is_active=1
                AND role IN ('school_admin','teacher','accountant')", [$sid])['c'] ?? 0);
        $classes = DB::query(
            "SELECT c.id, c.name, COUNT(s.id) students
               FROM classes c LEFT JOIN students s ON s.class_id=c.id AND s.deleted_at IS NULL
              WHERE c.school_id=? AND c.deleted_at IS NULL GROUP BY c.id, c.name ORDER BY c.name", [$sid]);
        respond(['all_guardians' => $guardians, 'all_staff' => $staff, 'classes' => $classes,
                 'whatsapp_configured' => Notify::whatsAppConfigured()]);
    }

    // Shared send path for both ad-hoc notices and event reminders.
    private static function dispatch(array $user, string $subject, string $message, string $audience,
                                     ?int $classId, array $channels, string $kind, ?int $eventId = null): array {
        $sid    = (int)$user['school_id'];
        $school = DB::one('SELECT name,email FROM schools WHERE id=?', [$sid]) ?: ['name' => 'School'];
        $wantEmail = in_array('email', $channels, true);
        $wantWa    = in_array('whatsapp', $channels, true);
        $tw        = $wantWa ? Notify::twilioConfig() : null;      // null => WhatsApp skipped
        $country   = (string)($tw['default_country'] ?? '234');
        $html      = Notify::htmlBody($school, $subject, $message);
        $plain     = ($subject !== '' ? $subject . "\n\n" : '') . $message;
        $mailSubj  = $subject !== '' ? $subject : ('Message from ' . ($school['name'] ?? 'School'));

        $people = self::recipients($sid, $audience, $classId);
        $cid = DB::exec(
            'INSERT INTO communications (school_id,sender_id,kind,event_id,subject,body,audience,class_id,channels)
             VALUES (?,?,?,?,?,?,?,?,?)',
            [$sid, (int)$user['id'], $kind, $eventId, $subject, $message, $audience, $classId, implode(',', $channels)]);

        $sentEmail = 0; $sentWa = 0; $failed = 0; $skipped = 0;
        foreach ($people as $p) {
            if ($wantEmail) {
                $to = trim((string)($p['email'] ?? ''));
                if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
                    self::logRecipient($cid, $p['name'] ?? '', 'email', $to, 'skipped', 'No valid email on file'); $skipped++;
                } else {
                    [$ok, $err] = Notify::email($to, $mailSubj, $html, $school);
                    self::logRecipient($cid, $p['name'] ?? '', 'email', $to, $ok ? 'sent' : 'failed', $err);
                    $ok ? $sentEmail++ : $failed++;
                }
            }
            if ($wantWa) {
                $e164 = Notify::toE164($p['phone'] ?? '', $country);
                if (!$tw) {
                    self::logRecipient($cid, $p['name'] ?? '', 'whatsapp', (string)($p['phone'] ?? ''), 'skipped', 'WhatsApp not configured'); $skipped++;
                } elseif (!$e164) {
                    self::logRecipient($cid, $p['name'] ?? '', 'whatsapp', (string)($p['phone'] ?? ''), 'skipped', 'No valid phone on file'); $skipped++;
                } else {
                    [$ok, $err] = Notify::whatsApp($tw, $e164, $plain);
                    self::logRecipient($cid, $p['name'] ?? '', 'whatsapp', $e164, $ok ? 'sent' : 'failed', $err);
                    $ok ? $sentWa++ : $failed++;
                }
            }
        }
        DB::run('UPDATE communications SET recipients=?, sent_email=?, sent_whatsapp=?, failed=?, skipped=? WHERE id=?',
            [count($people), $sentEmail, $sentWa, $failed, $skipped, $cid]);
        return ['id' => $cid, 'recipients' => count($people), 'sent_email' => $sentEmail, 'sent_whatsapp' => $sentWa,
                'failed' => $failed, 'skipped' => $skipped, 'whatsapp_configured' => $tw !== null];
    }

    private static function logRecipient(int $cid, string $name, string $channel, string $dest, string $status, ?string $err): void {
        DB::run('INSERT INTO communication_recipients (communication_id,name,channel,destination,status,error) VALUES (?,?,?,?,?,?)',
            [$cid, mb_substr($name, 0, 160), $channel, mb_substr($dest, 0, 190), $status, $err !== null ? mb_substr($err, 0, 255) : null]);
    }

    private static function summaryMsg(array $r): string {
        if ((int)$r['recipients'] === 0) return 'No recipients matched that audience.';
        $bits = [];
        if ($r['sent_email'])    $bits[] = $r['sent_email'] . ' email';
        if ($r['sent_whatsapp']) $bits[] = $r['sent_whatsapp'] . ' WhatsApp';
        $head = $bits ? ('Sent ' . implode(' + ', $bits)) : 'Nothing delivered';
        if ($r['failed'])  $head .= ' · ' . $r['failed'] . ' failed';
        if ($r['skipped']) $head .= ' · ' . $r['skipped'] . ' skipped';
        return $head;
    }

    // POST /communications — send an ad-hoc broadcast.
    public static function send(array $user): void {
        Perm::assertAdmin($user);
        $b = body();
        $subject  = trim((string)($b['subject'] ?? ''));
        $message  = trim((string)($b['body'] ?? $b['message'] ?? ''));
        $audience = (string)($b['audience'] ?? '');
        $classId  = isset($b['class_id']) && $b['class_id'] !== '' ? (int)$b['class_id'] : null;
        $channels = array_values(array_intersect(['email', 'whatsapp'], (array)($b['channels'] ?? ['email'])));
        if ($message === '')                           respond(null, 422, 'Message body is required.');
        if (!in_array($audience, self::AUDIENCES, true)) respond(null, 422, 'Choose a valid audience.');
        if (!$channels)                                respond(null, 422, 'Choose at least one channel (email or WhatsApp).');
        $res = self::dispatch($user, $subject, $message, $audience, $classId, $channels, 'notice');
        respond($res, 201, self::summaryMsg($res));
    }

    // GET /communications — recent broadcast history.
    public static function history(array $user): void {
        Perm::assertAdmin($user);
        respond(DB::query(
            "SELECT c.*, CONCAT(u.first_name,' ',u.last_name) sender, cl.name class_name
               FROM communications c LEFT JOIN users u ON u.id=c.sender_id LEFT JOIN classes cl ON cl.id=c.class_id
              WHERE c.school_id=? ORDER BY c.id DESC LIMIT 50", [(int)$user['school_id']]));
    }

    // ── Events ──────────────────────────────────────────────────────────────────
    public static function events(array $user): void {
        Perm::assertAdmin($user);
        respond(DB::query(
            "SELECT e.*, cl.name class_name FROM events e LEFT JOIN classes cl ON cl.id=e.class_id
              WHERE e.school_id=? AND e.deleted_at IS NULL ORDER BY e.event_date DESC, e.id DESC", [(int)$user['school_id']]));
    }

    public static function saveEvent(array $user, ?int $id = null): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id']; $b = body();
        $title = trim((string)($b['title'] ?? ''));
        $date  = trim((string)($b['event_date'] ?? ''));
        if ($title === '' || $date === '' || strtotime($date) === false) respond(null, 422, 'Event title and a valid date are required.');
        $audience = in_array($b['audience'] ?? '', self::AUDIENCES, true) ? $b['audience'] : 'all_guardians';
        $classId  = isset($b['class_id']) && $b['class_id'] !== '' ? (int)$b['class_id'] : null;
        $desc     = trim((string)($b['description'] ?? ''));
        if ($id) {
            if (!DB::one('SELECT id FROM events WHERE id=? AND school_id=? AND deleted_at IS NULL', [$id, $sid]))
                respond(null, 404, 'Event not found.');
            DB::run('UPDATE events SET title=?,description=?,event_date=?,audience=?,class_id=? WHERE id=? AND school_id=?',
                [$title, $desc, $date, $audience, $classId, $id, $sid]);
            respond(['id' => $id], 200, 'Event updated');
        }
        $newId = DB::exec('INSERT INTO events (school_id,title,description,event_date,audience,class_id,created_by) VALUES (?,?,?,?,?,?,?)',
            [$sid, $title, $desc, $date, $audience, $classId, (int)$user['id']]);
        respond(['id' => $newId], 201, 'Event created');
    }

    public static function deleteEvent(array $user, int $id): void {
        Perm::assertAdmin($user);
        DB::run('UPDATE events SET deleted_at=NOW() WHERE id=? AND school_id=?', [$id, (int)$user['school_id']]);
        respond(['deleted' => true]);
    }

    // POST /communications/events/{id}/remind — broadcast a reminder for an event.
    public static function sendReminder(array $user, int $id): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        $e = DB::one('SELECT * FROM events WHERE id=? AND school_id=? AND deleted_at IS NULL', [$id, $sid]);
        if (!$e) respond(null, 404, 'Event not found.');
        $channels = array_values(array_intersect(['email', 'whatsapp'], (array)(body()['channels'] ?? ['email'])));
        if (!$channels) respond(null, 422, 'Choose at least one channel.');
        $when    = date('l, j M Y', strtotime($e['event_date']));
        $subject = 'Reminder: ' . $e['title'];
        $message = "This is a reminder about \"{$e['title']}\", scheduled for {$when}."
                 . ($e['description'] ? "\n\n" . $e['description'] : '');
        $res = self::dispatch($user, $subject, $message, $e['audience'],
            $e['class_id'] !== null ? (int)$e['class_id'] : null, $channels, 'reminder', $id);
        DB::run('UPDATE events SET reminder_sent_at=NOW() WHERE id=?', [$id]);
        respond($res, 201, self::summaryMsg($res));
    }

    // GET /communications/parent-preview/{studentId} — read-only snapshot of a parent's view.
    public static function parentPreview(array $user, int $studentId): void {
        Perm::assertAdmin($user);
        $sid = (int)$user['school_id'];
        $s = DB::one(
            "SELECT s.id, s.student_id, s.guardian_name, s.guardian_email, s.guardian_phone,
                    CONCAT(u.first_name,' ',u.last_name) name, c.name class_name, c.id class_id
               FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
              WHERE s.id=? AND u.school_id=? AND s.deleted_at IS NULL", [$studentId, $sid]);
        if (!$s) respond(null, 404, 'Student not found.');
        $term = DB::one('SELECT t.id,t.name FROM terms t JOIN academic_years ay ON ay.id=t.academic_year_id
                          WHERE ay.school_id=? ORDER BY t.is_current DESC, t.id DESC LIMIT 1', [$sid]);
        $termId = (int)($term['id'] ?? 0);
        $att = DB::one("SELECT COUNT(*) total, COALESCE(SUM(status NOT LIKE 'absent%'),0) present
                          FROM attendance WHERE student_id=? AND term_id=?", [$studentId, $termId]);
        $fees = DB::one('SELECT COALESCE(SUM(total_amount),0) invoiced, COALESCE(SUM(amount_paid),0) paid, COALESCE(SUM(balance),0) balance
                           FROM invoices WHERE student_id=?', [$studentId]);
        $subjects = DB::query(
            "SELECT sub.name subject, SUM(g.score) total FROM grades g JOIN subjects sub ON sub.id=g.subject_id
              WHERE g.student_id=? AND g.term_id=? GROUP BY g.subject_id, sub.name ORDER BY sub.name", [$studentId, $termId]);
        $tot = (int)($att['total'] ?? 0); $pre = (int)($att['present'] ?? 0);
        respond([
            'student'    => $s,
            'term'       => $term,
            'attendance' => ['present' => $pre, 'total' => $tot, 'rate' => $tot ? round(100 * $pre / $tot, 1) : null],
            'fees'       => $fees ?: ['invoiced' => 0, 'paid' => 0, 'balance' => 0],
            'subjects'   => $subjects,
        ]);
    }
}
