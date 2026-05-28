<?php
// /api/upload.php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed. Only POST is allowed.']);
    exit();
}

// Execute Session Authentication Guard
require_once __DIR__ . '/auth_guard.php';

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No image uploaded or upload error.']);
    exit();
}

$file = $_FILES['image'];
$size = $file['size'];
$tmpName = $file['tmp_name'];

// Validate size < 2MB
if ($size > 2 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File size exceeds 2MB limit.']);
    exit();
}

// Validate type using fileinfo extension if available, otherwise fall back to secure magic bytes verification
$mimeType = null;
if (function_exists('finfo_open')) {
    $finfo = @finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo !== false) {
        $mimeType = @finfo_file($finfo, $tmpName);
        @finfo_close($finfo);
    }
}

if (!$mimeType && function_exists('mime_content_type')) {
    $mimeType = @mime_content_type($tmpName);
}

// Fallback to robust binary header signature validation if PHP lacks extensions
if (!$mimeType) {
    $handle = @fopen($tmpName, 'rb');
    if ($handle) {
        $bytes = @fread($handle, 12);
        @fclose($handle);
        
        if ($bytes !== false) {
            if (strpos($bytes, "\xFF\xD8\xFF") === 0) {
                $mimeType = 'image/jpeg';
            } else if (strpos($bytes, "\x89PNG\r\n\x1a\n") === 0) {
                $mimeType = 'image/png';
            } else if (strpos($bytes, 'RIFF') === 0 && strpos(substr($bytes, 8, 4), 'WEBP') === 0) {
                $mimeType = 'image/webp';
            }
        }
    }
}

$allowedTypes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!$mimeType || !array_key_exists($mimeType, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid file type or format. Only JPG, PNG, and WEBP are allowed.']);
    exit();
}

// Validate image dimensions to protect against image bombs
$imageInfo = @getimagesize($tmpName);
if ($imageInfo === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Uploaded file is not a valid image.']);
    exit();
}
$maxDimension = 4096;
if ($imageInfo[0] > $maxDimension || $imageInfo[1] > $maxDimension) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Image dimensions exceed the maximum of {$maxDimension}x{$maxDimension} pixels."]);
    exit();
}

// Verify sufficient disk space before writing (require at least 10MB free)
$freeSpace = @disk_free_space($uploadDir);
if ($freeSpace !== false && $freeSpace < 10 * 1024 * 1024) {
    http_response_code(507); // Insufficient Storage
    echo json_encode(['success' => false, 'error' => 'Server storage is critically low. Upload rejected.']);
    exit();
}

$ext = $allowedTypes[$mimeType];
$filename = uniqid() . '.' . $ext;
$targetPath = $uploadDir . $filename;

if (move_uploaded_file($tmpName, $targetPath)) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $domainName = $_SERVER['HTTP_HOST'];
    $uri = $_SERVER['REQUEST_URI'];
    $baseUri = dirname(dirname(explode('?', $uri)[0]));
    if ($baseUri === '/' || $baseUri === '\\') $baseUri = '';
    
    $relativeUrl = 'uploads/' . $filename;
    $fullUrl = $protocol . $domainName . $baseUri . '/' . $relativeUrl;

    echo json_encode([
        'success' => true,
        'url' => $relativeUrl,
        'fullUrl' => $fullUrl
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save uploaded file.']);
}
