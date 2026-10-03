<?php

declare(strict_types=1);

namespace App\Admin;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;

final class AdminCatalogRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function programs(): array
    {
        return $this->database->connection()->query(
            'SELECT id, code, name, program_type, description, sort_order, is_active, created_at, updated_at
             FROM academic_programs ORDER BY sort_order, name'
        )->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createProgram(array $data): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO academic_programs
                (code, name, program_type, description, sort_order, is_active, created_at, updated_at)
             VALUES (:code, :name, :program_type, :description, :sort_order, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'code' => $this->required($data, 'code', 40),
            'name' => $this->required($data, 'name', 150),
            'program_type' => $this->required($data, 'program_type', 40),
            'description' => $this->nullable($data, 'description', 1000),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @return list<array<string, mixed>> */
    public function levels(?int $programId, ?int $parentId): array
    {
        $where = [];
        $params = [];
        if ($programId !== null) {
            $where[] = 'program_id = :program_id';
            $params['program_id'] = $programId;
        }
        if ($parentId !== null) {
            $where[] = 'parent_id = :parent_id';
            $params['parent_id'] = $parentId;
        }
        $sql = 'SELECT id, program_id, parent_id, level_type, code, name, slug, sort_order, is_active
                FROM academic_levels' . ($where === [] ? '' : ' WHERE ' . implode(' AND ', $where))
            . ' ORDER BY program_id, parent_id, sort_order, name';
        $statement = $this->database->connection()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createLevel(array $data): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO academic_levels
                (program_id, parent_id, level_type, code, name, slug, sort_order, is_active, created_at, updated_at)
             VALUES (:program_id, :parent_id, :level_type, :code, :name, :slug, :sort_order, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'program_id' => $this->requiredInt($data, 'program_id'),
            'parent_id' => isset($data['parent_id']) && is_numeric($data['parent_id']) ? (int) $data['parent_id'] : null,
            'level_type' => $this->required($data, 'level_type', 40),
            'code' => $this->required($data, 'code', 60),
            'name' => $this->required($data, 'name', 150),
            'slug' => $this->slug($data),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @return list<array<string, mixed>> */
    public function subjects(): array
    {
        return $this->database->connection()->query(
            'SELECT id, code, name, slug, description, is_active, created_at, updated_at
             FROM subjects ORDER BY name'
        )->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createSubject(array $data): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO subjects (code, name, slug, description, is_active, created_at, updated_at)
             VALUES (:code, :name, :slug, :description, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'code' => $this->nullable($data, 'code', 60),
            'name' => $this->required($data, 'name', 150),
            'slug' => $this->slug($data),
            'description' => $this->nullable($data, 'description', 1000),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @return list<array<string, mixed>> */
    public function offerings(?int $levelId): array
    {
        $sql = 'SELECT a.id, a.academic_level_id, a.subject_id, a.display_code, a.credit_hours,
                       a.sort_order, a.is_active, s.name AS subject_name, l.name AS level_name
                FROM academic_subjects a
                INNER JOIN subjects s ON s.id = a.subject_id
                INNER JOIN academic_levels l ON l.id = a.academic_level_id';
        $params = [];
        if ($levelId !== null) {
            $sql .= ' WHERE a.academic_level_id = :level_id';
            $params['level_id'] = $levelId;
        }
        $sql .= ' ORDER BY l.name, a.sort_order, s.name';
        $statement = $this->database->connection()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createOffering(array $data): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO academic_subjects
                (academic_level_id, subject_id, display_code, credit_hours, sort_order, is_active, created_at, updated_at)
             VALUES (:level_id, :subject_id, :display_code, :credit_hours, :sort_order, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'level_id' => $this->requiredInt($data, 'academic_level_id'),
            'subject_id' => $this->requiredInt($data, 'subject_id'),
            'display_code' => $this->nullable($data, 'display_code', 60),
            'credit_hours' => isset($data['credit_hours']) && is_numeric($data['credit_hours']) ? $data['credit_hours'] : null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @return list<array<string, mixed>> */
    public function units(?int $offeringId): array
    {
        $sql = 'SELECT id, academic_subject_id, parent_id, code, title, slug, description, sort_order, is_active
                FROM subject_units';
        $params = [];
        if ($offeringId !== null) {
            $sql .= ' WHERE academic_subject_id = :offering_id';
            $params['offering_id'] = $offeringId;
        }
        $sql .= ' ORDER BY academic_subject_id, parent_id, sort_order, title';
        $statement = $this->database->connection()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createUnit(array $data): int
    {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO subject_units
                (academic_subject_id, parent_id, code, title, slug, description, sort_order, is_active, created_at, updated_at)
             VALUES (:offering_id, :parent_id, :code, :title, :slug, :description, :sort_order, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'offering_id' => $this->requiredInt($data, 'academic_subject_id'),
            'parent_id' => isset($data['parent_id']) && is_numeric($data['parent_id']) ? (int) $data['parent_id'] : null,
            'code' => $this->nullable($data, 'code', 60),
            'title' => $this->required($data, 'title', 200),
            'slug' => $this->slug($data),
            'description' => $this->nullable($data, 'description', 1000),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    public function setActive(string $entity, int $id, bool $active): void
    {
        $tables = [
            'program' => 'academic_programs',
            'level' => 'academic_levels',
            'subject' => 'subjects',
            'offering' => 'academic_subjects',
            'unit' => 'subject_units',
        ];
        if (!isset($tables[$entity])) {
            throw new ApiException('ENTITY_INVALID', 'Unsupported catalog entity.', 422);
        }
        $statement = $this->database->connection()->prepare(
            "UPDATE {$tables[$entity]} SET is_active = :active, updated_at = UTC_TIMESTAMP() WHERE id = :id"
        );
        $statement->execute(['active' => $active ? 1 : 0, 'id' => $id]);
        if ($statement->rowCount() === 0) {
            throw new ApiException('ENTITY_NOT_FOUND', 'Catalog entry not found.', 404);
        }
    }

    /** @param array<string, mixed> $data */
    private function required(array $data, string $field, int $max): string
    {
        $value = isset($data[$field]) && is_string($data[$field]) ? trim($data[$field]) : '';
        if ($value === '' || mb_strlen($value) > $max) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [$field => ['This field is required.']]);
        }
        return $value;
    }

    /** @param array<string, mixed> $data */
    private function nullable(array $data, string $field, int $max): ?string
    {
        if (!isset($data[$field]) || !is_string($data[$field]) || trim($data[$field]) === '') {
            return null;
        }
        return mb_substr(trim($data[$field]), 0, $max);
    }

    /** @param array<string, mixed> $data */
    private function requiredInt(array $data, string $field): int
    {
        if (!isset($data[$field]) || !is_numeric($data[$field]) || (int) $data[$field] < 1) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [$field => ['Select a valid value.']]);
        }
        return (int) $data[$field];
    }

    /** @param array<string, mixed> $data */
    private function slug(array $data): string
    {
        $source = isset($data['slug']) && is_string($data['slug']) ? $data['slug'] : ($data['name'] ?? $data['title'] ?? '');
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', mb_strtolower((string) $source)) ?? '', '-');
        if ($slug === '') {
            throw new ApiException('VALIDATION_FAILED', 'A valid slug is required.', 422);
        }
        return $slug;
    }
}
