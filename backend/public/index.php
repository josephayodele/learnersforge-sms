<?php
// public/index.php  — LearnersForge API entry point
// Compatible with PHP 7.4+

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');

// ── CORS ──────────────────────────────────────────────────────────────────────
$allowed_origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Autoload ──────────────────────────────────────────────────────────────────
$base = dirname(__DIR__);
require $base . '/app/Models/DB.php';
require $base . '/app/Controllers/AuthController.php';
require $base . '/app/Controllers/AllControllers.php';

// ── Helpers ───────────────────────────────────────────────────────────────────
function respond($data, int $code = 200, string $message = 'success'): void {
    http_response_code($code);
    echo json_encode([
        'status'  => $code < 400 ? 'success' : 'error',
        'data'    => $data,
        'message' => $message,
    ]);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw ?: '{}', true) ?? [];
}

function authGuard(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION']
       ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
       ?? '';

    if (strpos($header, 'Bearer ') !== 0) {
        respond(null, 401, 'Unauthenticated');
    }
    $token = substr($header, 7);
    $userId = base64_decode($token);
    $user = DB::one(
        'SELECT id, role, school_id, first_name, last_name, email
         FROM users WHERE id = ? AND is_active = 1',
        [$userId]
    );
    if (!$user) {
        respond(null, 401, 'Invalid token');
    }
    return $user;
}

// ── Parse URI ─────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip XAMPP subdirectory prefix e.g. /learnersforge/public
$uri = preg_replace('#^/learnersforge(?:/public)?#', '', $uri);
$uri = '/' . trim($uri, '/');

// Extract numeric ID from end of path e.g. /api/v1/students/5 -> id=5
$id   = null;
$path = $uri;
if (preg_match('#^(.*)/(\d+)$#', $uri, $m)) {
    $path = $m[1];
    $id   = (int)$m[2];
}

// ── Route ─────────────────────────────────────────────────────────────────────
try {

    // ── Auth ──────────────────────────────────────────────────────────────────
    if ($path === '/api/v1/auth/login' && $method === 'POST') {
        AuthController::login();

    } elseif ($path === '/api/v1/auth/me' && $method === 'GET') {
        AuthController::me(authGuard());

    } elseif ($path === '/api/v1/auth/logout' && $method === 'POST') {
        respond(null, 200, 'Logged out');

    // ── Dashboard ─────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/dashboard' && $method === 'GET') {
        DashboardController::index(authGuard());

    // ── Students ──────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/students' && $method === 'GET') {
        StudentController::index(authGuard());

    } elseif ($path === '/api/v1/students/import' && $method === 'POST') {
        StudentController::import(authGuard());

    } elseif ($path === '/api/v1/students/bulk-delete' && $method === 'POST') {
        StudentController::bulkDestroy(authGuard());

    } elseif ($path === '/api/v1/students' && $method === 'POST') {
        StudentController::store(authGuard());

    } elseif ($path === '/api/v1/students' && $id && $method === 'GET') {
        StudentController::show(authGuard(), $id);

    } elseif ($path === '/api/v1/students' && $id && $method === 'PUT') {
        StudentController::update(authGuard(), $id);

    } elseif ($path === '/api/v1/students' && $id && $method === 'DELETE') {
        StudentController::destroy(authGuard(), $id);

    // ── Staff ─────────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/staff' && $method === 'GET') {
        StaffController::index(authGuard());

    } elseif ($path === '/api/v1/staff' && $method === 'POST') {
        StaffController::store(authGuard());

    } elseif (preg_match('#^/api/v1/staff/(\d+)/assignments$#', $path, $mstaff) && $method === 'GET') {
        StaffController::assignments(authGuard(), (int)$mstaff[1]);

    } elseif (preg_match('#^/api/v1/staff/(\d+)/assignments$#', $path, $mstaff) && $method === 'POST') {
        StaffController::saveAssignments(authGuard(), (int)$mstaff[1]);

    } elseif ($path === '/api/v1/staff' && $id && $method === 'GET') {
        StaffController::show(authGuard(), $id);

    // ── Attendance ────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/attendance' && $method === 'GET') {
        AttendanceController::index(authGuard());

    } elseif ($path === '/api/v1/attendance/bulk' && $method === 'POST') {
        AttendanceController::bulk(authGuard());

    } elseif ($path === '/api/v1/attendance/summary' && $method === 'GET') {
        AttendanceController::summary(authGuard());

    // ── Grades ────────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/ca-types' && $method === 'GET') {
        GradeController::caTypes(authGuard());

    // ── Report-card remark ranges ───────────────────────────────────────────
    } elseif ($path === '/api/v1/remark-ranges' && $method === 'GET') {
        RemarkController::index(authGuard());

    } elseif ($path === '/api/v1/remark-ranges' && $method === 'POST') {
        RemarkController::store(authGuard());

    } elseif ($path === '/api/v1/remark-ranges' && $id && $method === 'PUT') {
        RemarkController::update(authGuard(), $id);

    } elseif ($path === '/api/v1/remark-ranges' && $id && $method === 'DELETE') {
        RemarkController::destroy(authGuard(), $id);

    } elseif ($path === '/api/v1/grades' && $method === 'GET') {
        GradeController::index(authGuard());

    } elseif ($path === '/api/v1/grades/bulk' && $method === 'POST') {
        GradeController::bulk(authGuard());

    } elseif ($path === '/api/v1/grades/report-card' && $method === 'GET') {
        GradeController::reportCard(authGuard());

    } elseif ($path === '/api/v1/grades/cumulative' && $method === 'GET') {
        GradeController::cumulative(authGuard());

    } elseif ($path === '/api/v1/behaviour' && $method === 'GET') {
        GradeController::behaviour(authGuard());

    } elseif ($path === '/api/v1/behaviour/bulk' && $method === 'POST') {
        GradeController::saveBehaviour(authGuard());

    } elseif ($path === '/api/v1/comments' && $method === 'GET') {
        GradeController::comments(authGuard());

    } elseif ($path === '/api/v1/comments/bulk' && $method === 'POST') {
        GradeController::saveComments(authGuard());

    // ── Fees & Finance ────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/fees/invoices' && $method === 'GET') {
        FeeController::invoices(authGuard());

    } elseif ($path === '/api/v1/fees/payments' && $method === 'POST') {
        FeeController::recordPayment(authGuard());

    } elseif ($path === '/api/v1/fees/expenses' && $method === 'GET') {
        FeeController::expenses(authGuard());

    } elseif ($path === '/api/v1/fees/expenses' && $method === 'POST') {
        FeeController::addExpense(authGuard());

    } elseif ($path === '/api/v1/fees/payroll' && $method === 'GET') {
        FeeController::payroll(authGuard());

    } elseif ($path === '/api/v1/fees/summary' && $method === 'GET') {
        FeeController::summary(authGuard());

    // ── Timetable ─────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/timetable' && $method === 'GET') {
        TimetableController::index(authGuard());

    } elseif ($path === '/api/v1/timetable' && $method === 'POST') {
        TimetableController::save(authGuard());

    // ── Exams / CBT ───────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/exams' && $method === 'GET') {
        ExamController::index(authGuard());

    } elseif ($path === '/api/v1/exams' && $method === 'POST') {
        ExamController::store(authGuard());

    } elseif ($path === '/api/v1/exams' && $id && $method === 'GET') {
        ExamController::show(authGuard(), $id);

    } elseif ($path === '/api/v1/exams' && $id && $method === 'PUT') {
        ExamController::update(authGuard(), $id);

    } elseif ($path === '/api/v1/exams/submit' && $method === 'POST') {
        ExamController::submit(authGuard());

    // ── Inventory ─────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/inventory' && $method === 'GET') {
        InventoryController::index(authGuard());

    } elseif ($path === '/api/v1/inventory' && $method === 'POST') {
        InventoryController::store(authGuard());

    } elseif ($path === '/api/v1/inventory/issue' && $method === 'POST') {
        InventoryController::issue(authGuard());

    } elseif ($path === '/api/v1/inventory/restock' && $method === 'POST') {
        InventoryController::restock(authGuard());

    } elseif ($path === '/api/v1/inventory/transactions' && $method === 'GET') {
        InventoryController::transactions(authGuard());

    // ── Hostel ────────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/hostels' && $method === 'GET') {
        HostelController::index(authGuard());

    } elseif ($path === '/api/v1/hostel/rooms' && $method === 'GET') {
        HostelController::rooms(authGuard());

    } elseif ($path === '/api/v1/hostel/allocate' && $method === 'POST') {
        HostelController::allocate(authGuard());

    } elseif ($path === '/api/v1/hostel/visitors' && $method === 'GET') {
        HostelController::visitors(authGuard());

    } elseif ($path === '/api/v1/hostel/visitors' && $method === 'POST') {
        HostelController::logVisitor(authGuard());

    // ── Library ───────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/library/books' && $method === 'GET') {
        LibraryController::books(authGuard());

    } elseif ($path === '/api/v1/library/loans' && $method === 'GET') {
        LibraryController::loans(authGuard());

    } elseif ($path === '/api/v1/library/issue' && $method === 'POST') {
        LibraryController::issue(authGuard());

    } elseif ($path === '/api/v1/library/return' && $method === 'POST') {
        LibraryController::returnBook(authGuard());

    // ── Messaging ─────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/messages' && $method === 'GET') {
        MessagingController::index(authGuard());

    } elseif ($path === '/api/v1/messages' && $method === 'POST') {
        MessagingController::send(authGuard());

    } elseif ($path === '/api/v1/notifications' && $method === 'GET') {
        MessagingController::notifications(authGuard());

    // ── Admissions ────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/admissions' && $method === 'GET') {
        AdmissionController::index(authGuard());

    } elseif ($path === '/api/v1/admissions' && $method === 'POST') {
        AdmissionController::store(authGuard());

    } elseif ($path === '/api/v1/admissions' && $id && $method === 'PUT') {
        AdmissionController::update(authGuard(), $id);

    // ── Settings (school profile / branding) ───────────────────────────────────
    } elseif ($path === '/api/v1/settings/school' && $method === 'GET') {
        SettingsController::getSchool(authGuard());

    } elseif ($path === '/api/v1/settings/school' && ($method === 'PUT' || $method === 'POST')) {
        SettingsController::updateSchool(authGuard());

    // ── Utilities ─────────────────────────────────────────────────────────────
    } elseif ($path === '/api/v1/classes' && $method === 'GET') {
        respond(DB::query(
            'SELECT * FROM classes WHERE school_id = ? AND deleted_at IS NULL ORDER BY name',
            [1]
        ));

    } elseif ($path === '/api/v1/classes' && $method === 'POST') {
        $u = authGuard();
        $b = body();
        $name = trim($b['name'] ?? '');
        if ($name === '') respond(null, 422, 'Class name is required.');
        $ay = DB::one('SELECT id FROM academic_years WHERE school_id=? ORDER BY is_current DESC, id DESC LIMIT 1', [(int)$u['school_id']]);
        if (!$ay) respond(null, 422, 'No academic year is set up for this school.');
        $dup = DB::one('SELECT id FROM classes WHERE school_id=? AND name=? AND deleted_at IS NULL', [(int)$u['school_id'], $name]);
        if ($dup) respond(null, 409, 'A class named "' . $name . '" already exists.');
        $newId = DB::exec(
            'INSERT INTO classes (school_id, academic_year_id, name, level, form, arm, capacity) VALUES (?,?,?,?,?,?,?)',
            [(int)$u['school_id'], (int)$ay['id'], $name, $b['level'] ?? null, $b['form'] ?? null, $b['arm'] ?? null, (int)($b['capacity'] ?? 40)]
        );
        respond(['id' => $newId, 'name' => $name], 201, 'Class created');

    } elseif ($path === '/api/v1/subjects' && $method === 'GET') {
        respond(DB::query(
            'SELECT * FROM subjects WHERE school_id = ? AND deleted_at IS NULL ORDER BY name',
            [1]
        ));

    } elseif ($path === '/api/v1/terms' && $method === 'GET') {
        respond(DB::query(
            'SELECT t.*, ay.name AS year_name
             FROM terms t
             JOIN academic_years ay ON ay.id = t.academic_year_id
             WHERE ay.school_id = 1
             ORDER BY t.id',
            []
        ));

    // ── 404 ───────────────────────────────────────────────────────────────────
    } else {
        respond(null, 404, "Endpoint not found: $method $path");
    }

} catch (Throwable $e) {
    respond(
        ['error' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()],
        500,
        'Server error'
    );
}