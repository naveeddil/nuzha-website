<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
$row = $pdo->query('SELECT content_json, updated_at FROM nuzha_content WHERE id = 1')->fetch();
if (!$row) json_response(['ok' => true, 'content' => null, 'updatedAt' => null]);
$content = json_decode($row['content_json'], true);
json_response(['ok' => true, 'content' => is_array($content) ? $content : null, 'updatedAt' => $row['updated_at']]);
