<?php
// /api/save.php

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Only POST is allowed.']);
    exit();
}

// Execute Session Authentication Guard
require_once __DIR__ . '/auth_guard.php';

// Enforce a strict server-side payload size limit (300KB)
$maxPayloadSize = 300 * 1024;
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;

if ($contentLength > $maxPayloadSize) {
    http_response_code(413); // Payload Too Large
    echo json_encode(['error' => 'Request payload exceeds the maximum permitted size limit (300KB).']);
    exit();
}

// Read JSON payload
$input = file_get_contents('php://input');
$payload = json_decode($input, true);

// Validate payload structure
if (!$payload || !isset($payload['version']) || !isset($payload['data'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload. Missing version or data object.']);
    exit();
}

// Auto-generate lastModified if missing
if (!isset($payload['lastModified'])) {
    $payload['lastModified'] = time() * 1000;
}

$dataFile = __DIR__ . '/data.json';
$backupFile = __DIR__ . '/data_backup.json';

// Open file for read/write (create if not exists)
$fp = fopen($dataFile, 'c+');
if ($fp === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open data file. Check folder permissions.']);
    exit();
}

// Acquire Exclusive Lock (blocks until lock is acquired)
if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    http_response_code(500);
    echo json_encode(['error' => 'Server busy. Could not acquire exclusive write lock.']);
    exit();
}

// Read current content safely while holding lock to create safety backup
rewind($fp);
$currentContent = stream_get_contents($fp);
if ($currentContent !== false && !empty($currentContent)) {
    if (file_put_contents($backupFile, $currentContent, LOCK_EX) === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(500);
        echo json_encode(['error' => 'Server failed to write safety backup file.']);
        exit();
    }
}

// Prepare JSON string
$jsonString = json_encode($payload, JSON_PRETTY_PRINT);

// Truncate file and write new data
ftruncate($fp, 0);
rewind($fp);

$writeResult = fwrite($fp, $jsonString);
if ($writeResult === false) {
    // Failure! Attempt self-healing rollback from backup
    if ($currentContent !== false && !empty($currentContent)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $currentContent);
    }
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write data to disk. Restored from safety backup.']);
    exit();
}

// Flush buffers to disk before releasing lock
fflush($fp);

// Release Lock
flock($fp, LOCK_UN);

// Close file handle
fclose($fp);

// Return success
http_response_code(200);
echo json_encode([
    'success' => true,
    'savedAt' => $payload['lastModified']
]);
