<?php

declare(strict_types=1);

namespace App\Resources;

use App\Infrastructure\Database\Database;

final class ResourceRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @param array<string, mixed> $filters @return array{items:list<array<string,mixed>>,total:int,page:int,per_page:int} */
    public function search(array $filters): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($filters['per_page'] ?? 20)));
        $where = ["r.status = 'published'", 'r.published_at <= UTC_TIMESTAMP()'];
        $params = [];

        $map = [
            'type' => ['rt.code = :type', 'type'],
            'program' => ['ap.code = :program', 'program'],
            'level' => ['al.slug = :level', 'level'],
            'subject' => ['s.slug = :subject', 'subject'],
            'unit' => ['su.slug = :unit', 'unit'],
        ];
        foreach ($map as $filter => [$clause, $param]) {
            if (isset($filters[$filter]) && is_string($filters[$filter]) && $filters[$filter] !== '') {
                $where[] = $clause;
                $params[$param] = $filters[$filter];
            }
        }
        if (isset($filters['q']) && is_string($filters['q']) && trim($filters['q']) !== '') {
            $where[] = '(r.title LIKE :query OR r.summary LIKE :query)';
            $params['query'] = '%' . trim($filters['q']) . '%';
        }

        $from = ' FROM resources r
                  INNER JOIN resource_types rt ON rt.id = r.resource_type_id
                  LEFT JOIN resource_academic_subjects ras ON ras.resource_id = r.id
                  LEFT JOIN academic_subjects axs ON axs.id = ras.academic_subject_id
                  LEFT JOIN subjects s ON s.id = axs.subject_id
                  LEFT JOIN academic_levels al ON al.id = axs.academic_level_id
                  LEFT JOIN academic_programs ap ON ap.id = al.program_id
                  LEFT JOIN resource_units ru ON ru.resource_id = r.id
                  LEFT JOIN subject_units su ON su.id = ru.subject_unit_id
                  WHERE ' . implode(' AND ', $where);

        $count = $this->database->connection()->prepare('SELECT COUNT(DISTINCT r.id)' . $from);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $sql = 'SELECT DISTINCT r.id, r.title, r.slug, r.summary, rt.code AS type,
                       r.visibility, r.published_at, r.updated_at'
            . $from . ' ORDER BY r.published_at DESC, r.id DESC LIMIT :limit OFFSET :offset';
        $statement = $this->database->connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $perPage, \PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, \PDO::PARAM_INT);
        $statement->execute();

        return ['items' => $statement->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    /** @return array<string, mixed>|null */
    public function findBySlug(string $slug): ?array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT r.id, r.title, r.slug, r.summary, r.body, rt.code AS type,
                    r.visibility, r.published_at, r.updated_at
             FROM resources r
             INNER JOIN resource_types rt ON rt.id = r.resource_type_id
             WHERE r.slug = :slug AND r.status = 'published' AND r.published_at <= UTC_TIMESTAMP()
             LIMIT 1"
        );
        $statement->execute(['slug' => $slug]);
        $resource = $statement->fetch();
        if ($resource === false) {
            return null;
        }

        $assets = $this->database->connection()->prepare(
            'SELECT id, asset_type, external_url, original_filename, mime_type, file_size, page_count, sort_order
             FROM resource_assets WHERE resource_id = :resource_id ORDER BY sort_order, id'
        );
        $assets->execute(['resource_id' => $resource['id']]);
        $resource['assets'] = $assets->fetchAll();
        return $resource;
    }
}
