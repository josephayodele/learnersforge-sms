<?php
// ═══════════════════════════════════════════════════════════
// app/Controllers/AuthController.php
// ═══════════════════════════════════════════════════════════
class AuthController {
    public static function login(): void {
        $b = body();
        $email    = trim($b['email']    ?? '');
        $password = trim($b['password'] ?? '');
        if (!$email || !$password) respond(null, 422, 'Email and password required');

        $user = DB::one(
            'SELECT u.*, s.name AS school_name FROM users u
             JOIN schools s ON s.id = u.school_id
             WHERE u.email = ? AND u.is_active = 1 AND u.deleted_at IS NULL',
            [$email]
        );
        if (!$user || !password_verify($password, $user['password'])) {
            respond(null, 401, 'Invalid credentials');
        }
        // Simple demo token: base64 of user id — replace with JWT in production
        $token = base64_encode((string)$user['id']);
        DB::run('UPDATE users SET last_login = NOW() WHERE id = ?', [$user['id']]);
        unset($user['password']);
        respond(['token' => $token, 'user' => $user]);
    }

    public static function me(array $user): void {
        respond($user);
    }
}
