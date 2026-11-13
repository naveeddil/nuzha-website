<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$action = (string)($_GET['action'] ?? 'session');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$userCount = (int)$pdo->query('SELECT COUNT(*) FROM nuzha_admin_users')->fetchColumn();

if ($action === 'session' && $method === 'GET') {
    json_response(['ok' => true, 'authenticated' => !empty($_SESSION['admin_id']), 'needsSetup' => $userCount === 0, 'csrf' => !empty($_SESSION['admin_id']) ? csrf_token() : null]);
}
if ($action === 'setup' && $method === 'POST') {
    if ($userCount !== 0) json_response(['ok' => false, 'error' => 'Setup is already complete.'], 409);
    $input = request_json();
    $token = (string)($input['setupToken'] ?? '');
    if (!$token || !hash_equals((string)$config['setup_token'], $token)) json_response(['ok' => false, 'error' => 'Invalid setup token.'], 403);
    $email = filter_var(trim((string)($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
    $password = (string)($input['password'] ?? '');
    if (!$email || strlen($password) < 12) json_response(['ok' => false, 'error' => 'Use a valid email and a password of at least 12 characters.'], 422);
    $stmt = $pdo->prepare('INSERT INTO nuzha_admin_users (email, password_hash) VALUES (?, ?)');
    $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT)]);
    session_regenerate_id(true); $_SESSION['admin_id'] = (int)$pdo->lastInsertId();
    json_response(['ok' => true, 'csrf' => csrf_token()]);
}
if ($action === 'login' && $method === 'POST') {
    if ($userCount === 0) json_response(['ok' => false, 'error' => 'Complete first-time setup.'], 409);
    $ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|' . (string)$config['setup_token']);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM nuzha_login_attempts WHERE ip_hash = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'); $stmt->execute([$ipHash]);
    if ((int)$stmt->fetchColumn() >= 8) json_response(['ok' => false, 'error' => 'Too many attempts. Try again in 15 minutes.'], 429);
    $input = request_json(); $email = strtolower(trim((string)($input['email'] ?? ''))); $password = (string)($input['password'] ?? '');
    $stmt = $pdo->prepare('SELECT id, password_hash FROM nuzha_admin_users WHERE email = ?'); $stmt->execute([$email]); $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        $pdo->prepare('INSERT INTO nuzha_login_attempts (ip_hash) VALUES (?)')->execute([$ipHash]);
        usleep(350000); json_response(['ok' => false, 'error' => 'Invalid email or password.'], 401);
    }
    $pdo->prepare('DELETE FROM nuzha_login_attempts WHERE ip_hash = ?')->execute([$ipHash]);
    session_regenerate_id(true); $_SESSION['admin_id'] = (int)$user['id'];
    $pdo->prepare('UPDATE nuzha_admin_users SET last_login_at = NOW() WHERE id = ?')->execute([(int)$user['id']]);
    json_response(['ok' => true, 'csrf' => csrf_token()]);
}
if ($action === 'logout' && $method === 'POST') {
    require_admin(); require_csrf(); $_SESSION = []; session_destroy(); json_response(['ok' => true]);
}
if ($action === 'content' && $method === 'GET') {
    require_admin(); $row = $pdo->query('SELECT content_json, updated_at FROM nuzha_content WHERE id = 1')->fetch();
    json_response(['ok' => true, 'content' => $row ? json_decode($row['content_json'], true) : null, 'updatedAt' => $row['updated_at'] ?? null, 'csrf' => csrf_token()]);
}
if ($action === 'content' && $method === 'POST') {
    $adminId = require_admin(); require_csrf(); $content = clean_content(request_json());
    $encoded = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false || strlen($encoded) > 5 * 1024 * 1024) json_response(['ok' => false, 'error' => 'Content is too large.'], 422);
    $stmt = $pdo->prepare('INSERT INTO nuzha_content (id, content_json, updated_by) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content_json = VALUES(content_json), updated_by = VALUES(updated_by)');
    $stmt->execute([$encoded, $adminId]); json_response(['ok' => true, 'savedAt' => gmdate('c')]);
}
if ($action === 'upload' && $method === 'POST') {
    require_admin(); require_csrf();
    if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) json_response(['ok' => false, 'error' => 'Select an image.'], 422);
    $file = $_FILES['image']; if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > (int)$config['max_upload_bytes']) json_response(['ok' => false, 'error' => 'Upload failed or exceeded 8 MB.'], 422);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']); $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($types[$mime]) || getimagesize($file['tmp_name']) === false) json_response(['ok' => false, 'error' => 'Only valid JPG, PNG or WebP images are accepted.'], 422);
    $dir = dirname(__DIR__) . '/uploads/gallery'; if (!is_dir($dir) && !mkdir($dir, 0755, true)) json_response(['ok' => false, 'error' => 'Upload directory is unavailable.'], 500);
    $name = bin2hex(random_bytes(16)) . '.' . $types[$mime]; $destination = $dir . '/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $destination)) json_response(['ok' => false, 'error' => 'Could not store image.'], 500);
    chmod($destination, 0644); json_response(['ok' => true, 'path' => 'uploads/gallery/' . $name]);
}
json_response(['ok' => false, 'error' => 'Unknown operation.'], 404);
