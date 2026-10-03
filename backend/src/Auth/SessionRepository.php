<?php

declare(strict_types=1);

namespace App\Auth;

use App\Infrastructure\Database\Database;
use DateTimeImmutable;
use PDO;

final class SessionRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array<string, mixed>|null */
    public function findActive(string $rawToken): ?array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT s.id AS session_id, s.user_id, s.last_used_at, s.expires_at,
                    u.email, u.username, u.role, u.status, u.email_verified_at,
                    p.display_name
             FROM auth_sessions s
             INNER JOIN users u ON u.id = s.user_id
             LEFT JOIN student_profiles p ON p.user_id = u.id
             WHERE s.token_hash = :token_hash
               AND s.revoked_at IS NULL
               AND s.expires_at > UTC_TIMESTAMP()
               AND u.status = :status
             LIMIT 1'
        );
        $statement->execute([
            'token_hash' => hash('sha256', $rawToken, true),
            'status' => 'active',
        ]);
        $session = $statement->fetch();

        return $session === false ? null : $session;
    }

    public function create(int $userId, string $rawToken, int $absoluteHours, string $userAgent, string $ipHash): int
    {
        $expiresAt = (new DateTimeImmutable('now', new \DateTimeZone('UTC')))
            ->modify("+{$absoluteHours} hours")
            ->format('Y-m-d H:i:s');

        $statement = $this->database->connection()->prepare(
            'INSERT INTO auth_sessions
                (user_id, token_hash, user_agent, ip_hash, last_used_at, expires_at, created_at)
             VALUES (:user_id, :token_hash, :user_agent, :ip_hash, UTC_TIMESTAMP(), :expires_at, UTC_TIMESTAMP())'
        );
        $statement->bindValue('user_id', $userId, PDO::PARAM_INT);
        $statement->bindValue('token_hash', hash('sha256', $rawToken, true), PDO::PARAM_LOB);
        $statement->bindValue('user_agent', mb_substr($userAgent, 0, 500));
        $statement->bindValue('ip_hash', $ipHash, PDO::PARAM_LOB);
        $statement->bindValue('expires_at', $expiresAt);
        $statement->execute();

        return (int) $this->database->connection()->lastInsertId();
    }

    public function touch(int $sessionId): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE auth_sessions SET last_used_at = UTC_TIMESTAMP()
             WHERE id = :id AND last_used_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)'
        );
        $statement->execute(['id' => $sessionId]);
    }

    public function revokeByToken(string $rawToken): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
             WHERE token_hash = :token_hash AND revoked_at IS NULL'
        );
        $statement->bindValue('token_hash', hash('sha256', $rawToken, true), PDO::PARAM_LOB);
        $statement->execute();
    }

    public function revokeAllForUser(int $userId): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
             WHERE user_id = :user_id AND revoked_at IS NULL'
        );
        $statement->execute(['user_id' => $userId]);
    }
}
