<?php

declare(strict_types=1);

namespace App\Config;

final class Config
{
    /** @return array<string, mixed> */
    public static function load(string $basePath): array
    {
        return [
            'base_path' => $basePath,
            'app' => [
                'env' => Environment::string('APP_ENV', 'production'),
                'debug' => Environment::bool('APP_DEBUG', false),
                'url' => Environment::string('APP_URL', 'http://127.0.0.1:8080'),
                'base_path' => Environment::string('API_BASE_PATH', ''),
                'timezone' => Environment::string('APP_TIMEZONE', 'UTC'),
                'key' => Environment::string('APP_KEY', ''),
            ],
            'cors' => [
                'origins' => Environment::csv('FRONTEND_ORIGINS', []),
            ],
            'database' => [
                'host' => Environment::string('DB_HOST', '127.0.0.1'),
                'port' => Environment::int('DB_PORT', 3306),
                'name' => Environment::string('DB_DATABASE', 'note_library_v2'),
                'username' => Environment::string('DB_USERNAME', 'note_library'),
                'password' => Environment::string('DB_PASSWORD', ''),
                'charset' => Environment::string('DB_CHARSET', 'utf8mb4'),
            ],
            'media' => [
                'directory' => Environment::string('MEDIA_STORAGE_PATH', $basePath . '/storage/uploads'),
            ],
            'session' => [
                'cookie' => Environment::string('SESSION_COOKIE', 'nl_session'),
                'secure' => Environment::bool('SESSION_SECURE', true),
                'same_site' => Environment::string('SESSION_SAMESITE', 'Lax'),
                'idle_minutes' => Environment::int('SESSION_IDLE_MINUTES', 30),
                'absolute_hours' => Environment::int('SESSION_ABSOLUTE_HOURS', 168),
            ],
            'log_level' => Environment::string('LOG_LEVEL', 'warning'),
        ];
    }
}
