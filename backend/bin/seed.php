<?php

declare(strict_types=1);

use App\Config\Config;
use App\Infrastructure\Database\Database;
use Dotenv\Dotenv;

$basePath = dirname(__DIR__);
require $basePath . '/vendor/autoload.php';
Dotenv::createImmutable($basePath)->safeLoad();
$pdo = (new Database(Config::load($basePath)['database']))->connection();

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_seeds (
        seed VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
$applied = array_flip($pdo->query('SELECT seed FROM schema_seeds')->fetchAll(PDO::FETCH_COLUMN));

$files = glob($basePath . '/database/seeds/*.sql') ?: [];
sort($files, SORT_NATURAL);
foreach ($files as $file) {
    $name = basename($file);
    if (isset($applied[$name])) {
        echo "skip {$name}\n";
        continue;
    }
    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException('Unable to read seed: ' . basename($file));
    }
    $pdo->exec($sql);
    $statement = $pdo->prepare('INSERT INTO schema_seeds (seed, applied_at) VALUES (:seed, UTC_TIMESTAMP())');
    $statement->execute(['seed' => $name]);
    echo "seeded {$name}\n";
}
