<?php

declare(strict_types=1);

namespace App\Auth;

use App\Infrastructure\Database\Database;
use PDO;

final class UserRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array<string, mixed>|null */
    public function findByLogin(string $login): ?array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT u.id, u.email, u.username, u.password_hash, u.role, u.status, u.email_verified_at,
                    p.display_name
             FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id
             WHERE u.email = :email_login OR u.username = :username_login LIMIT 1'
        );
        $normalized = mb_strtolower(trim($login));
        $statement->execute(['email_login' => $normalized, 'username_login' => $normalized]);
        $user = $statement->fetch();
        return $user === false ? null : $user;
    }

    /** @return array<string, mixed>|null */
    public function findAdminByEmail(string $email): ?array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT u.id, u.email, u.username, u.password_hash, u.role, u.status,
                    u.email_verified_at, p.display_name
             FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id
             WHERE u.email = :email AND u.role = 'admin' LIMIT 1"
        );
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $user = $statement->fetch();
        return $user === false ? null : $user;
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email): ?array
    {
        $statement = $this->database->connection()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $user = $statement->fetch();
        return $user === false ? null : $user;
    }

    public function emailOrUsernameExists(string $email, string $username): bool
    {
        $statement = $this->database->connection()->prepare(
            'SELECT 1 FROM users WHERE email = :email OR username = :username LIMIT 1'
        );
        $statement->execute(['email' => $email, 'username' => $username]);
        return $statement->fetchColumn() !== false;
    }

    public function create(string $email, string $username, string $passwordHash, string $displayName): int
    {
        return $this->database->transaction(function (PDO $pdo) use ($email, $username, $passwordHash, $displayName): int {
            $statement = $pdo->prepare(
                'INSERT INTO users
                    (email, username, password_hash, role, status, created_at, updated_at)
                 VALUES (:email, :username, :password_hash, :role, :status, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $statement->execute([
                'email' => $email,
                'username' => $username,
                'password_hash' => $passwordHash,
                'role' => 'student',
                'status' => 'active',
            ]);
            $userId = (int) $pdo->lastInsertId();

            $profile = $pdo->prepare(
                'INSERT INTO student_profiles (user_id, display_name, created_at, updated_at)
                 VALUES (:user_id, :display_name, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $profile->execute(['user_id' => $userId, 'display_name' => $displayName]);

            $preferences = $pdo->prepare(
                'INSERT INTO user_preferences (user_id, created_at, updated_at)
                 VALUES (:user_id, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $preferences->execute(['user_id' => $userId]);

            return $userId;
        });
    }

    public function markLogin(int $userId): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE users SET last_login_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id'
        );
        $statement->execute(['id' => $userId]);
    }

    public function updatePassword(int $userId, string $passwordHash): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE users SET password_hash = :password_hash, updated_at = UTC_TIMESTAMP() WHERE id = :id'
        );
        $statement->execute(['id' => $userId, 'password_hash' => $passwordHash]);
    }

    public function markEmailVerified(int $userId): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()), updated_at = UTC_TIMESTAMP()
             WHERE id = :id'
        );
        $statement->execute(['id' => $userId]);
    }
}
