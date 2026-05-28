<?php
// /api/load.php

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed. Only GET is allowed.']);
    exit();
}

$dataFile = __DIR__ . '/data.json';

// Return file if exists safely using shared read lock (LOCK_SH)
if (file_exists($dataFile)) {
    $fp = fopen($dataFile, 'r');
    if ($fp !== false) {
        if (flock($fp, LOCK_SH)) {
            $data = stream_get_contents($fp);
            flock($fp, LOCK_UN);
            fclose($fp);
            http_response_code(200);
            echo $data;
            exit();
        }
        fclose($fp);
    }
}

// If file does not exist, return a default fresh state structure
http_response_code(200);

$defaultState = [
    'version' => 2,
    'lastModified' => 0,
    'data' => [
        'hero' => [
            'image' => '',
            'imageId' => ''
        ],
        'portfolio' => [],
        'feedbacks' => []
    ]
];

echo json_encode($defaultState);
