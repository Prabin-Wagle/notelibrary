<?php

declare(strict_types=1);

namespace App\Activity;

use App\Infrastructure\Database\Database;

final class ActivityRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function bookmarks(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT r.id, r.title, r.slug, r.summary, rt.code AS type, b.created_at AS bookmarked_at
             FROM bookmarks b
             INNER JOIN resources r ON r.id = b.resource_id
             INNER JOIN resource_types rt ON rt.id = r.resource_type_id
             WHERE b.user_id = :user_id AND r.status = :status
             ORDER BY b.created_at DESC'
        );
        $statement->execute(['user_id' => $userId, 'status' => 'published']);
        return $statement->fetchAll();
    }

    public function addBookmark(int $userId, int $resourceId): void
    {
        $setting = $this->database->connection()->query("SELECT setting_value FROM admin_settings WHERE setting_key='content'")->fetchColumn();
        $content = is_string($setting) ? json_decode($setting, true) : null;
        if (is_array($content) && ($content['allow_student_bookmarks'] ?? true) === false) {
            throw new \App\Domain\Exceptions\ApiException('BOOKMARKS_DISABLED', 'Student bookmarks are currently disabled.', 403);
        }
        $statement = $this->database->connection()->prepare(
            'INSERT INTO bookmarks (user_id, resource_id, created_at)
             SELECT :user_id, id, UTC_TIMESTAMP() FROM resources WHERE id = :resource_id
             ON DUPLICATE KEY UPDATE created_at = created_at'
        );
        $statement->execute(['user_id' => $userId, 'resource_id' => $resourceId]);
    }

    public function removeBookmark(int $userId, int $resourceId): void
    {
        $statement = $this->database->connection()->prepare(
            'DELETE FROM bookmarks WHERE user_id = :user_id AND resource_id = :resource_id'
        );
        $statement->execute(['user_id' => $userId, 'resource_id' => $resourceId]);
    }

    /** @return list<array<string, mixed>> */
    public function history(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT r.id, r.title, r.slug, rt.code AS type, h.last_viewed_at,
                    h.view_count, h.last_page, h.progress_percent
             FROM user_resource_history h
             INNER JOIN resources r ON r.id = h.resource_id
             INNER JOIN resource_types rt ON rt.id = r.resource_type_id
             WHERE h.user_id = :user_id
             ORDER BY h.last_viewed_at DESC LIMIT 100'
        );
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchAll();
    }

    public function recordProgress(int $userId, int $resourceId, ?int $lastPage, float $progress): void
    {
        $progress = min(100, max(0, $progress));
        $statement = $this->database->connection()->prepare(
            'INSERT INTO user_resource_history
                (user_id, resource_id, first_viewed_at, last_viewed_at, view_count, last_page, progress_percent)
             SELECT :user_id, id, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 1, :last_page, :progress
             FROM resources WHERE id = :resource_id
             ON DUPLICATE KEY UPDATE
                last_viewed_at = UTC_TIMESTAMP(), view_count = view_count + 1,
                last_page = VALUES(last_page), progress_percent = VALUES(progress_percent)'
        );
        $statement->execute([
            'user_id' => $userId,
            'resource_id' => $resourceId,
            'last_page' => $lastPage,
            'progress' => $progress,
        ]);
    }
}
