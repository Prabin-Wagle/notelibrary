<?php
declare(strict_types=1);

// Include from an authenticated PHP admin endpoint: $pdo = require '/home/notelibr/admin-backend/db.php';
// Keep this directory outside public_html. Never put database credentials in Vite.
return (static function (): PDO {
    $configPath = __DIR__ . '/config.local.php';
    $config = is_file($configPath) ? require $configPath : [];
    if (!is_array($config)) {
        throw new RuntimeException('Invalid database configuration.');
    }

    $get = static function (string $name, string $default = '') use ($config): string {
        $value = getenv($name);
        return $value !== false ? $value : (string) ($config[$name] ?? $default);
    };

    $host = $get('DB_HOST', 'localhost');
    $port = $get('DB_PORT', '3306');
    $database = $get('DB_NAME');
    $username = $get('DB_USER');
    $password = $get('DB_PASSWORD');
    if ($database === '' || $username === '' || $password === '') {
        throw new RuntimeException('Set DB_NAME, DB_USER and DB_PASSWORD on the server.');
    }
    if (!ctype_digit($port) || (int) $port < 1 || (int) $port > 65535
        || preg_match('/[;\x00-\x1f]/', $host . $database)) {
        throw new RuntimeException('Invalid database host, port or name.');
    }

    try {
        return new PDO(
            "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 10,
            ]
        );
    } catch (PDOException $exception) {
        // Do not expose server addresses, usernames or driver errors to HTTP clients.
        error_log('Admin database connection failed. SQLSTATE: ' . $exception->getCode());
        throw new RuntimeException('Database connection unavailable.');
    }
})();
