<?php

declare(strict_types=1);

namespace App\Activity;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;

final class StudyTargetRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function list(int $userId, string $from, string $to): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, label, target_date, progress FROM study_targets
             WHERE user_id = :user_id AND target_date BETWEEN :date_from AND :date_to
             ORDER BY target_date, id'
        );
        $statement->execute(['user_id' => $userId, 'date_from' => $from, 'date_to' => $to]);
        return $statement->fetchAll();
    }

    public function create(int $userId, string $label, string $date): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO study_targets (user_id, label, target_date, created_at, updated_at)
             VALUES (:user_id, :label, :target_date, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute(['user_id' => $userId, 'label' => $label, 'target_date' => $date]);
        return (int) $this->database->connection()->lastInsertId();
    }

    public function update(int $userId, int $id, ?int $progress, ?string $label = null): void
    {
        $statement = $this->database->connection()->prepare(
            'UPDATE study_targets SET progress = COALESCE(:progress, progress), label = COALESCE(:label, label), updated_at = UTC_TIMESTAMP()
             WHERE id = :id AND user_id = :user_id'
        );
        $statement->execute(['progress' => $progress, 'label' => $label, 'id' => $id, 'user_id' => $userId]);
        if ($statement->rowCount() === 0 && !$this->exists($userId, $id)) {
            throw new ApiException('TARGET_NOT_FOUND', 'Study target not found.', 404);
        }
    }

    public function delete(int $userId, int $id): void
    {
        $statement = $this->database->connection()->prepare('DELETE FROM study_targets WHERE id = :id AND user_id = :user_id');
        $statement->execute(['id' => $id, 'user_id' => $userId]);
        if ($statement->rowCount() === 0) {
            throw new ApiException('TARGET_NOT_FOUND', 'Study target not found.', 404);
        }
    }

    private function exists(int $userId, int $id): bool
    {
        $statement = $this->database->connection()->prepare('SELECT 1 FROM study_targets WHERE id = :id AND user_id = :user_id');
        $statement->execute(['id' => $id, 'user_id' => $userId]);
        return $statement->fetchColumn() !== false;
    }
}
