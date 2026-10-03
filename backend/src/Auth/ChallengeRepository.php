<?php

declare(strict_types=1);

namespace App\Auth;

use App\Infrastructure\Database\Database;
use PDO;

final class ChallengeRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    public function create(?int $userId, string $purpose, string $destination, string $rawSecret, int $minutes, string $ipHash): void
    {
        $this->database->transaction(function (PDO $pdo) use ($userId, $purpose, $destination, $rawSecret, $minutes, $ipHash): void {
            $consume = $pdo->prepare(
                'UPDATE auth_challenges SET consumed_at = UTC_TIMESTAMP()
                 WHERE destination = :destination AND purpose = :purpose AND consumed_at IS NULL'
            );
            $consume->execute(['destination' => $destination, 'purpose' => $purpose]);

            $insert = $pdo->prepare(
                'INSERT INTO auth_challenges
                    (user_id, purpose, destination, secret_hash, attempt_count, max_attempts,
                     expires_at, requested_ip_hash, created_at)
                 VALUES (:user_id, :purpose, :destination, :secret_hash, 0, 5,
                         DATE_ADD(UTC_TIMESTAMP(), INTERVAL :minutes MINUTE), :ip_hash, UTC_TIMESTAMP())'
            );
            $insert->bindValue('user_id', $userId, $userId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $insert->bindValue('purpose', $purpose);
            $insert->bindValue('destination', $destination);
            $insert->bindValue('secret_hash', hash('sha256', $rawSecret, true), PDO::PARAM_LOB);
            $insert->bindValue('minutes', $minutes, PDO::PARAM_INT);
            $insert->bindValue('ip_hash', $ipHash, PDO::PARAM_LOB);
            $insert->execute();
        });
    }

    /** @return array<string, mixed>|null */
    public function consume(string $purpose, string $destination, string $rawSecret): ?array
    {
        return $this->database->transaction(function (PDO $pdo) use ($purpose, $destination, $rawSecret): ?array {
            $select = $pdo->prepare(
                'SELECT * FROM auth_challenges
                 WHERE purpose = :purpose AND destination = :destination AND consumed_at IS NULL
                   AND expires_at > UTC_TIMESTAMP() AND attempt_count < max_attempts
                 ORDER BY id DESC LIMIT 1 FOR UPDATE'
            );
            $select->execute(['purpose' => $purpose, 'destination' => $destination]);
            $challenge = $select->fetch();
            if ($challenge === false) {
                return null;
            }

            if (!hash_equals((string) $challenge['secret_hash'], hash('sha256', $rawSecret, true))) {
                $pdo->prepare('UPDATE auth_challenges SET attempt_count = attempt_count + 1 WHERE id = :id')
                    ->execute(['id' => $challenge['id']]);
                return null;
            }

            $pdo->prepare('UPDATE auth_challenges SET consumed_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['id' => $challenge['id']]);
            return $challenge;
        });
    }
}
