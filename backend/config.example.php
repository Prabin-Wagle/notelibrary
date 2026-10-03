<?php
declare(strict_types=1);

// Copy to config.local.php on the server and set its private values there.
return [
    'APP_ENV' => 'production',
    'APP_DEBUG' => false,
    'APP_URL' => 'https://admin.notelibraryapp.com',
    'API_BASE_PATH' => '',
    'APP_TIMEZONE' => 'Asia/Kathmandu',
    // Generate a unique secret with: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'APP_KEY' => 'REPLACE_WITH_A_UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS',
    'FRONTEND_ORIGINS' => 'https://admin.notelibraryapp.com',
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => 'notelibr_YOUR_DATABASE',
    'DB_USER' => 'notelibr_YOUR_DB_USER',
    'DB_PASSWORD' => 'REPLACE_WITH_DATABASE_PASSWORD',
    'DB_CHARSET' => 'utf8mb4',
    'ADMIN_SESSION_SECURE' => true,
    'ADMIN_SESSION_SAMESITE' => 'Lax',
    'LOG_LEVEL' => 'warning',
];
