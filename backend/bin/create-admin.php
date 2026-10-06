<?php

declare(strict_types=1);

use App\Config\Config;
use App\Infrastructure\Database\Database;
use Dotenv\Dotenv;

$basePath = dirname(__DIR__);
require $basePath . '/vendor/autoload.php';
Dotenv::createImmutable($basePath)->safeLoad();

[$script, $email, $username, $displayName] = array_pad($argv, 4, null);
if (!$email || !$username || !$displayName) {
    fwrite(STDERR, "Usage: php bin/create-admin.php email username \"Display Name\"\n");
    exit(1);
}

fwrite(STDOUT, 'Password: ');
$password = trim((string) fgets(STDIN));
if (strlen($password) < 12) {
    fwrite(STDERR, "Admin passwords must contain at least 12 characters.\n");
    exit(1);
}

$pdo = (new Database(Config::load($basePath)['database']))->connection();
$pdo->beginTransaction();
try {
    $statement = $pdo->prepare(
        "INSERT INTO users
            (email, username, password_hash, role, status, email_verified_at, created_at, updated_at)
         VALUES (:email, :username, :password_hash, 'admin', 'active', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())"
    );
    $statement->execute([
        'email' => mb_strtolower(trim($email)),
        'username' => mb_strtolower(trim($username)),
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    $userId = (int) $pdo->lastInsertId();
    $pdo->prepare(
        'INSERT INTO student_profiles (user_id, display_name, created_at, updated_at)
         VALUES (:user_id, :display_name, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
    )->execute(['user_id' => $userId, 'display_name' => trim($displayName)]);
    $pdo->prepare(
        'INSERT INTO user_preferences (user_id, created_at, updated_at)
         VALUES (:user_id, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
    )->execute(['user_id' => $userId]);
    $pdo->commit();
    fwrite(STDOUT, "Admin created with ID {$userId}.\n");
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}
