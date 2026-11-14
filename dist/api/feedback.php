<?php
// Receives guest feedback from the Testimonials page form (reviews.html).
// Entries are stored as "pending" in nuzha_feedback and only appear on the website after an admin
// approves them in /admin/ → Reviews and saves. Basic spam protection: hidden honeypot field,
// minimum fill time, same-origin check, 3 submissions per visitor per hour, 500 pending entries maximum.
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') json_response(['ok' => false, 'error' => 'Unknown operation.'], 405);

$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
$host = (string)($_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . $host, PHP_URL_HOST)) {
    json_response(['ok' => false, 'error' => 'Request not allowed.'], 403);
}

$input = request_json();
// Bots tend to fill every field and submit instantly; real visitors leave "website" empty.
if (trim((string)($input['website'] ?? '')) !== '' || (int)($input['elapsed'] ?? 0) < 3000) {
    json_response(['ok' => true]);
}

// Character-safe length helpers (work with Arabic text without needing the mbstring extension).
$length = static fn(string $s): int => (int)preg_match_all('/./us', $s);
$cut = static fn(string $s, int $n): string => preg_match('/^.{0,' . $n . '}/us', $s, $m) ? $m[0] : '';
$clean = static function ($value, int $max) use ($cut): string {
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', trim((string)$value)) ?? '';
    return $cut($text, $max);
};
$name = $clean($input['name'] ?? '', 80);
$message = $clean($input['message'] ?? '', 1000);
$contact = $clean($input['contact'] ?? '', 120);
$rating = (float)($input['rating'] ?? 0);
$consent = !empty($input['consent']) ? 1 : 0; // guest agreed that name, rating and message may be published
$lang = preg_match('/\p{Arabic}/u', $message) ? 'ar' : 'en';

if ($length($name) < 2) json_response(['ok' => false, 'error' => 'name'], 422);
if ($rating < 1 || $rating > 5 || fmod($rating * 2, 1.0) !== 0.0) json_response(['ok' => false, 'error' => 'rating'], 422);
if ($length($message) < 10) json_response(['ok' => false, 'error' => 'message'], 422);

$ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|feedback|' . (string)$config['setup_token']);
$stmt = $pdo->prepare('SELECT COUNT(*) FROM nuzha_feedback WHERE ip_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)');
$stmt->execute([$ipHash]);
if ((int)$stmt->fetchColumn() >= 3) json_response(['ok' => false, 'error' => 'limit'], 429);
if ((int)$pdo->query("SELECT COUNT(*) FROM nuzha_feedback WHERE status = 'pending'")->fetchColumn() >= 500) {
    json_response(['ok' => false, 'error' => 'limit'], 429);
}

$stmt = $pdo->prepare('INSERT INTO nuzha_feedback (name, rating, message, contact, consent, lang, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$name, $rating, $message, $contact !== '' ? $contact : null, $consent, $lang, $ipHash]);
json_response(['ok' => true]);
