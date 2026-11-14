<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

$configFile = dirname(__DIR__) . '/private/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Admin portal is not configured.']);
    exit;
}
$config = require $configFile;
if (!is_array($config)) {
    throw new RuntimeException('Invalid private configuration.');
}

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name((string)($config['session_name'] ?? 'nuzha_secure_admin'));
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
        (string)$config['db_user'],
        (string)$config['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (Throwable $e) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Database connection is unavailable.']);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS nuzha_admin_users (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 last_login_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$pdo->exec("CREATE TABLE IF NOT EXISTS nuzha_content (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 content_json LONGTEXT NOT NULL,
 updated_by INT UNSIGNED NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$pdo->exec("CREATE TABLE IF NOT EXISTS nuzha_login_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ip_hash CHAR(64) NOT NULL,
 attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX attempt_lookup (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Guest feedback sent from the Testimonials page; nothing is published until an admin approves it.
$pdo->exec("CREATE TABLE IF NOT EXISTS nuzha_feedback (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 rating DECIMAL(2,1) NOT NULL,
 message TEXT NOT NULL,
 contact VARCHAR(120) NULL,
 consent TINYINT(1) NOT NULL DEFAULT 0,
 lang CHAR(2) NOT NULL DEFAULT 'en',
 ip_hash CHAR(64) NOT NULL,
 status ENUM('pending','approved','dismissed') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX feedback_status (status, created_at),
 INDEX feedback_ip (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

function json_response(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function request_json(): array {
    $raw = file_get_contents('php://input');
    $value = json_decode($raw ?: '{}', true);
    if (!is_array($value)) json_response(['ok' => false, 'error' => 'Invalid request.'], 400);
    return $value;
}
function require_admin(): int {
    if (empty($_SESSION['admin_id'])) json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    return (int)$_SESSION['admin_id'];
}
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function require_csrf(): void {
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($received) || !hash_equals(csrf_token(), $received)) json_response(['ok' => false, 'error' => 'Security token expired. Refresh and try again.'], 419);
}
function clean_content(array $data): array {
    foreach (['menu', 'gallery', 'reviews', 'settings'] as $key) if (!array_key_exists($key, $data)) json_response(['ok' => false, 'error' => 'Incomplete content data.'], 422);
    if (!is_array($data['menu']) || !is_array($data['gallery']) || !is_array($data['reviews']) || !is_array($data['settings'])) json_response(['ok' => false, 'error' => 'Invalid content data.'], 422);
    if (count($data['menu']) > 500 || count($data['gallery']) > 1000 || count($data['reviews']) > 500) json_response(['ok' => false, 'error' => 'Content limit exceeded.'], 422);
    return $data;
}
