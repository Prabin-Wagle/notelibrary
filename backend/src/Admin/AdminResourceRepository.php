<?php

declare(strict_types=1);

namespace App\Admin;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

final class AdminResourceRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @param array<string, mixed> $filters @return array{items:list<array<string,mixed>>,total:int,page:int,per_page:int} */
    public function search(array $filters): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 25)));
        $where = [];
        $params = [];
        foreach (['status' => 'r.status', 'type' => 'rt.code'] as $filter => $column) {
            if (isset($filters[$filter]) && is_string($filters[$filter]) && $filters[$filter] !== '') {
                $where[] = "{$column} = :{$filter}";
                $params[$filter] = $filters[$filter];
            }
        }
        if (isset($filters['q']) && is_string($filters['q']) && trim($filters['q']) !== '') {
            $where[] = '(r.title LIKE :q OR r.slug LIKE :q)';
            $params['q'] = '%' . trim($filters['q']) . '%';
        }
        $whereSql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $from = ' FROM resources r INNER JOIN resource_types rt ON rt.id = r.resource_type_id' . $whereSql;
        $count = $this->database->connection()->prepare('SELECT COUNT(*)' . $from);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $statement = $this->database->connection()->prepare(
            'SELECT r.id, r.title, r.slug, r.summary, r.status, r.visibility, r.published_at,
                    r.created_at, r.updated_at, rt.id AS resource_type_id, rt.code AS type'
            . $from . ' ORDER BY r.updated_at DESC, r.id DESC LIMIT :limit OFFSET :offset'
        );
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();
        return ['items' => $statement->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    /** @return list<array<string, mixed>> */
    public function types(): array
    {
        return $this->database->connection()->query(
            'SELECT id, code, name, is_active FROM resource_types ORDER BY name'
        )->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function create(array $data, int $adminId): int
    {
        return $this->database->transaction(function (PDO $pdo) use ($data, $adminId): int {
            $values = $this->validated($data);
            $statement = $pdo->prepare(
                'INSERT INTO resources
                    (resource_type_id, author_user_id, title, slug, summary, body, status, visibility,
                     published_at, created_at, updated_at)
                 VALUES (:type_id, :author_id, :title, :slug, :summary, :body, :status, :visibility,
                         :published_at, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $statement->execute($values + ['author_id' => $adminId]);
            $id = (int) $pdo->lastInsertId();
            $this->syncMappings($pdo, $id, $data);
            return $id;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(int $id, array $data): void
    {
        $this->database->transaction(function (PDO $pdo) use ($id, $data): void {
            $values = $this->validated($data);
            $statement = $pdo->prepare(
                'UPDATE resources SET resource_type_id = :type_id, title = :title, slug = :slug,
                    summary = :summary, body = :body, status = :status, visibility = :visibility,
                    published_at = :published_at, updated_at = UTC_TIMESTAMP()
                 WHERE id = :id'
            );
            $statement->execute($values + ['id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM resources WHERE id = :id');
                $exists->execute(['id' => $id]);
                if ($exists->fetchColumn() === false) {
                    throw new ApiException('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
                }
            }
            $this->syncMappings($pdo, $id, $data);
        });
    }

    public function archive(int $id): void
    {
        $statement = $this->database->connection()->prepare(
            "UPDATE resources SET status = 'archived', updated_at = UTC_TIMESTAMP() WHERE id = :id"
        );
        $statement->execute(['id' => $id]);
        if ($statement->rowCount() === 0) {
            throw new ApiException('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
        }
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function validated(array $data): array
    {
        $title = isset($data['title']) && is_string($data['title']) ? trim($data['title']) : '';
        $slugSource = isset($data['slug']) && is_string($data['slug']) ? $data['slug'] : $title;
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', mb_strtolower($slugSource)) ?? '', '-');
        $status = isset($data['status']) && is_string($data['status']) ? $data['status'] : 'draft';
        $defaultVisibility = 'authenticated';
        $storedDefault = $this->database->connection()->query("SELECT setting_value FROM admin_settings WHERE setting_key='content'")->fetchColumn();
        if (is_string($storedDefault)) {
            $contentSettings = json_decode($storedDefault, true);
            if (is_array($contentSettings) && in_array($contentSettings['default_visibility'] ?? null, ['public', 'authenticated'], true)) {
                $defaultVisibility = $contentSettings['default_visibility'];
            }
        }
        $visibility = isset($data['visibility']) && is_string($data['visibility']) ? $data['visibility'] : $defaultVisibility;
        if ($title === '' || mb_strlen($title) > 250 || $slug === '') {
            throw new ApiException('VALIDATION_FAILED', 'A valid resource title and slug are required.', 422);
        }
        if (!isset($data['resource_type_id']) || !is_numeric($data['resource_type_id'])) {
            throw new ApiException('VALIDATION_FAILED', 'Select a resource type.', 422);
        }
        if (!in_array($status, ['draft', 'published', 'archived'], true)
            || !in_array($visibility, ['public', 'authenticated'], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Invalid resource status or visibility.', 422);
        }
        $publishedAt = isset($data['published_at']) && is_string($data['published_at']) && $data['published_at'] !== ''
            ? $data['published_at']
            : ($status === 'published' ? gmdate('Y-m-d H:i:s') : null);
        return [
            'type_id' => (int) $data['resource_type_id'],
            'title' => $title,
            'slug' => $slug,
            'summary' => isset($data['summary']) && is_string($data['summary']) ? mb_substr(trim($data['summary']), 0, 1000) : null,
            'body' => isset($data['body']) && is_string($data['body']) ? $data['body'] : null,
            'status' => $status,
            'visibility' => $visibility,
            'published_at' => $publishedAt,
        ];
    }

    /** @param array<string, mixed> $data */
    private function syncMappings(PDO $pdo, int $resourceId, array $data): void
    {
        if (isset($data['academic_subject_ids']) && is_array($data['academic_subject_ids'])) {
            $pdo->prepare('DELETE FROM resource_academic_subjects WHERE resource_id = :id')->execute(['id' => $resourceId]);
            $insert = $pdo->prepare(
                'INSERT INTO resource_academic_subjects (resource_id, academic_subject_id) VALUES (:resource_id, :subject_id)'
            );
            foreach (array_unique(array_map('intval', $data['academic_subject_ids'])) as $subjectId) {
                if ($subjectId > 0) {
                    $insert->execute(['resource_id' => $resourceId, 'subject_id' => $subjectId]);
                }
            }
        }
        if (isset($data['unit_ids']) && is_array($data['unit_ids'])) {
            $pdo->prepare('DELETE FROM resource_units WHERE resource_id = :id')->execute(['id' => $resourceId]);
            $insert = $pdo->prepare(
                'INSERT INTO resource_units (resource_id, subject_unit_id) VALUES (:resource_id, :unit_id)'
            );
            foreach (array_unique(array_map('intval', $data['unit_ids'])) as $unitId) {
                if ($unitId > 0) {
                    $insert->execute(['resource_id' => $resourceId, 'unit_id' => $unitId]);
                }
            }
        }
    }
}
