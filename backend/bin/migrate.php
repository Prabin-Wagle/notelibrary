<?php

declare(strict_types=1);

use App\Config\Config;
use App\Infrastructure\Database\Database;
use Dotenv\Dotenv;

$basePath = dirname(__DIR__);
require $basePath . '/vendor/autoload.php';
Dotenv::createImmutable($basePath)->safeLoad();
$database = new Database(Config::load($basePath)['database']);
$pdo = $database->connection();

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        migration VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

$applied = array_flip($pdo->query('SELECT migration FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
$files = glob($basePath . '/database/migrations/*.sql') ?: [];
sort($files, SORT_NATURAL);

foreach ($files as $file) {
    $name = basename($file);
    if (isset($applied[$name])) {
        echo "skip {$name}\n";
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException("Unable to read migration {$name}");
    }

    try {
        $pdo->exec($sql);
        $statement = $pdo->prepare('INSERT INTO schema_migrations (migration, applied_at) VALUES (:migration, UTC_TIMESTAMP())');
        $statement->execute(['migration' => $name]);
        echo "applied {$name}\n";
    } catch (Throwable $exception) {
        throw $exception;
    }
}
