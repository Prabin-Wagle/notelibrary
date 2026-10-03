<?php

declare(strict_types=1);

namespace App\Profile;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

final class EnrollmentRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function allForUser(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT e.id, e.academic_level_id, e.is_primary, e.started_at, e.ended_at,
                    l.code AS level_code, l.name AS level_name, l.slug AS level_slug,
                    p.code AS program_code, p.name AS program_name
             FROM user_academic_enrollments e
             INNER JOIN academic_levels l ON l.id = e.academic_level_id
             INNER JOIN academic_programs p ON p.id = l.program_id
             WHERE e.user_id = :user_id
             ORDER BY e.is_primary DESC, e.created_at DESC'
        );
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchAll();
    }

    public function save(int $userId, int $levelId, bool $primary): int
    {
        return $this->database->transaction(function (PDO $pdo) use ($userId, $levelId, $primary): int {
            $exists = $pdo->prepare('SELECT 1 FROM academic_levels WHERE id = :id AND is_active = 1');
            $exists->execute(['id' => $levelId]);
            if ($exists->fetchColumn() === false) {
                throw new ApiException('ACADEMIC_LEVEL_NOT_FOUND', 'Academic level not found.', 404);
            }

            if ($primary) {
                $pdo->prepare('UPDATE user_academic_enrollments SET is_primary = 0, updated_at = UTC_TIMESTAMP() WHERE user_id = :user_id')
                    ->execute(['user_id' => $userId]);
            }

            $statement = $pdo->prepare(
                'INSERT INTO user_academic_enrollments
                    (user_id, academic_level_id, is_primary, started_at, created_at, updated_at)
                 VALUES (:user_id, :level_id, :is_primary, UTC_DATE(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
                 ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), ended_at = NULL, updated_at = UTC_TIMESTAMP()'
            );
            $statement->execute([
                'user_id' => $userId,
                'level_id' => $levelId,
                'is_primary' => $primary ? 1 : 0,
            ]);

            if ((int) $pdo->lastInsertId() > 0) {
                return (int) $pdo->lastInsertId();
            }
            $find = $pdo->prepare(
                'SELECT id FROM user_academic_enrollments WHERE user_id = :user_id AND academic_level_id = :level_id'
            );
            $find->execute(['user_id' => $userId, 'level_id' => $levelId]);
            return (int) $find->fetchColumn();
        });
    }

    public function makePrimary(int $userId, int $enrollmentId): void
    {
        $this->database->transaction(function (PDO $pdo) use ($userId, $enrollmentId): void {
            $find = $pdo->prepare('SELECT id FROM user_academic_enrollments WHERE id = :id AND user_id = :user_id AND ended_at IS NULL');
            $find->execute(['id' => $enrollmentId, 'user_id' => $userId]);
            if ($find->fetchColumn() === false) {
                throw new ApiException('ENROLLMENT_NOT_FOUND', 'Enrollment not found.', 404);
            }
            $pdo->prepare('UPDATE user_academic_enrollments SET is_primary = 0, updated_at = UTC_TIMESTAMP() WHERE user_id = :user_id')
                ->execute(['user_id' => $userId]);
            $pdo->prepare('UPDATE user_academic_enrollments SET is_primary = 1, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['id' => $enrollmentId]);
        });
    }

    public function remove(int $userId, int $enrollmentId): void
    {
        $statement = $this->database->connection()->prepare(
            'DELETE FROM user_academic_enrollments WHERE id = :id AND user_id = :user_id'
        );
        $statement->execute(['id' => $enrollmentId, 'user_id' => $userId]);
    }
}
