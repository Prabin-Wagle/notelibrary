<?php
declare(strict_types=1);

// Terminal-only check; do not publish a public database diagnostic endpoint.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

try {
    $pdo = require __DIR__ . '/db.php';
    $pdo->query('SELECT 1')->fetchColumn();
    fwrite(STDOUT, "Database connection successful.\n");
} catch (Throwable $exception) {
    fwrite(STDERR, "Database connection failed. Check configuration, pdo_mysql and database user permissions.\n");
    exit(1);
}
