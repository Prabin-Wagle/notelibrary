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
            'SELECT id, code, name, program_type, competitive_exam, faculty, description, sort_order, is_active, created_at, updated_at
             FROM academic_programs ORDER BY sort_order, name'
        )->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createProgram(array $data): int
    {
        $name = $this->required($data, 'name', 150);
        $statement = $this->database->connection()->prepare(
            'INSERT INTO academic_programs
                (code, name, program_type, competitive_exam, faculty, description, sort_order, is_active, created_at, updated_at)
             VALUES (:code, :name, :program_type, :competitive_exam, :faculty, :description, :sort_order, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $programType = $this->required($data, 'program_type', 40);
        $statement->execute([
            'code' => isset($data['code']) && is_string($data['code']) && trim($data['code']) !== ''
                ? $this->required($data, 'code', 40)
                : $this->generateProgramCode($name),
            'name' => $name,
            'program_type' => $programType,
            'competitive_exam' => $programType === 'school' ? $this->nullable($data, 'competitive_exam', 150) : null,
            'faculty' => $this->faculty($data),
            'description' => $this->nullable($data, 'description', 1000),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @param array<string, mixed> $data */
    public function updateProgram(int $id, array $data): void
    {
        $this->assertExists('academic_programs', $id, 'PROGRAM_NOT_FOUND', 'Program not found.');
        $statement = $this->database->connection()->prepare(
            'UPDATE academic_programs
             SET name = :name, program_type = :program_type, competitive_exam = :competitive_exam,
                 faculty = :faculty,
                 updated_at = UTC_TIMESTAMP()
             WHERE id = :id'
        );
        $programType = $this->required($data, 'program_type', 40);
        $statement->execute([
            'name' => $this->required($data, 'name', 150),
            'program_type' => $programType,
            'competitive_exam' => $programType === 'school' ? $this->nullable($data, 'competitive_exam', 150) : null,
            'faculty' => $this->faculty($data),
            'id' => $id,
        ]);
    }

    public function deleteProgram(int $id): void
    {
        $this->assertExists('academic_programs', $id, 'PROGRAM_NOT_FOUND', 'Program not found.');
        $connection = $this->database->connection();
        $levels = $connection->prepare('SELECT COUNT(*) FROM academic_levels WHERE program_id = :id');
        $levels->execute(['id' => $id]);
        $subjects = $connection->prepare('SELECT COUNT(*) FROM subjects WHERE program_id = :id');
        $subjects->execute(['id' => $id]);
        if ((int) $levels->fetchColumn() > 0 || (int) $subjects->fetchColumn() > 0) {
            throw new ApiException('PROGRAM_IN_USE', 'Move or delete this program’s subjects and levels before deleting the program.', 409);
        }

        $statement = $connection->prepare('DELETE FROM academic_programs WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    private function generateProgramCode(string $name): string
    {
        $normalized = function_exists('iconv') ? iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) : false;
        $base = strtoupper(trim(preg_replace('/[^A-Za-z0-9]+/', '_', $normalized === false ? $name : $normalized) ?? '', '_'));
        $base = $base === '' ? 'PROGRAM' : substr($base, 0, 40);
        $candidate = $base;
        $suffix = 2;
        $connection = $this->database->connection();
        $check = $connection->prepare('SELECT 1 FROM academic_programs WHERE code = :code LIMIT 1');

        while (true) {
            $check->execute(['code' => $candidate]);
            if ($check->fetchColumn() === false) {
                return $candidate;
            }

            $tail = '_' . $suffix++;
            $candidate = substr($base, 0, 40 - strlen($tail)) . $tail;
        }
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
            'SELECT s.id, s.program_id, p.name AS program_name, s.name, s.slug, s.description,
                    s.is_active, s.created_at, s.updated_at
             FROM subjects s
             LEFT JOIN academic_programs p ON p.id = s.program_id
             ORDER BY p.name, s.name'
        )->fetchAll();
    }

    /** @param array<string, mixed> $data */
    public function createSubject(array $data): int
    {
        $programId = $this->requiredInt($data, 'program_id');
        $this->assertExists('academic_programs', $programId, 'PROGRAM_NOT_FOUND', 'Select a valid program.');
        $name = $this->required($data, 'name', 150);
        $slug = $this->slug(['slug' => $name]);
        $this->assertUniqueSubjectSlug($programId, $slug);
        $statement = $this->database->connection()->prepare(
            'INSERT INTO subjects (program_id, code, name, slug, description, is_active, created_at, updated_at)
             VALUES (:program_id, NULL, :name, :slug, :description, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'program_id' => $programId,
            'name' => $name,
            'slug' => $slug,
            'description' => $this->nullable($data, 'description', 1000),
        ]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @param array<string, mixed> $data */
    public function updateSubject(int $id, array $data): void
    {
        $this->assertExists('subjects', $id, 'SUBJECT_NOT_FOUND', 'Subject not found.');
        $programId = $this->requiredInt($data, 'program_id');
        $this->assertExists('academic_programs', $programId, 'PROGRAM_NOT_FOUND', 'Select a valid program.');
        $name = $this->required($data, 'name', 150);
        $slug = $this->slug(['slug' => $name]);
        $this->assertUniqueSubjectSlug($programId, $slug, $id);

        $connection = $this->database->connection();
        $usage = $connection->prepare(
            'SELECT COUNT(DISTINCT level.program_id)
             FROM academic_subjects offering
             INNER JOIN academic_levels level ON level.id = offering.academic_level_id
             WHERE offering.subject_id = :id'
        );
        $usage->execute(['id' => $id]);
        $usedByPrograms = (int) $usage->fetchColumn();
        if ($usedByPrograms > 0) {
            $usedInSelectedProgram = $connection->prepare(
                'SELECT COUNT(*)
                 FROM academic_subjects offering
                 INNER JOIN academic_levels level ON level.id = offering.academic_level_id
                 WHERE offering.subject_id = :id AND level.program_id = :program_id'
            );
            $usedInSelectedProgram->execute(['id' => $id, 'program_id' => $programId]);
            if ($usedByPrograms > 1 || (int) $usedInSelectedProgram->fetchColumn() === 0) {
                throw new ApiException('SUBJECT_IN_USE', 'This subject is attached to existing levels; keep it in its current program or remove those offerings first.', 409);
            }
        }

        $statement = $connection->prepare(
            'UPDATE subjects
             SET program_id = :program_id, code = NULL, name = :name, slug = :slug, updated_at = UTC_TIMESTAMP()
             WHERE id = :id'
        );
        $statement->execute(['program_id' => $programId, 'name' => $name, 'slug' => $slug, 'id' => $id]);
    }

    public function deleteSubject(int $id): void
    {
        $this->assertExists('subjects', $id, 'SUBJECT_NOT_FOUND', 'Subject not found.');
        $connection = $this->database->connection();
        $usage = $connection->prepare('SELECT COUNT(*) FROM academic_subjects WHERE subject_id = :id');
        $usage->execute(['id' => $id]);
        if ((int) $usage->fetchColumn() > 0) {
            throw new ApiException('SUBJECT_IN_USE', 'Remove this subject from its academic levels before deleting it.', 409);
        }

        $statement = $connection->prepare('DELETE FROM subjects WHERE id = :id');
        $statement->execute(['id' => $id]);
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

    private function assertExists(string $table, int $id, string $errorCode, string $message): void
    {
        $statement = $this->database->connection()->prepare("SELECT 1 FROM {$table} WHERE id = :id LIMIT 1");
        $statement->execute(['id' => $id]);
        if ($statement->fetchColumn() === false) {
            throw new ApiException($errorCode, $message, 404);
        }
    }

    private function assertUniqueSubjectSlug(int $programId, string $slug, ?int $exceptId = null): void
    {
        $sql = 'SELECT 1 FROM subjects WHERE program_id = :program_id AND slug = :slug';
        $params = ['program_id' => $programId, 'slug' => $slug];
        if ($exceptId !== null) {
            $sql .= ' AND id <> :except_id';
            $params['except_id'] = $exceptId;
        }
        $sql .= ' LIMIT 1';
        $statement = $this->database->connection()->prepare($sql);
        $statement->execute($params);
        if ($statement->fetchColumn() !== false) {
            throw new ApiException('SUBJECT_EXISTS', 'A subject with this name already exists in the selected program.', 409);
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
    private function faculty(array $data): ?string
    {
        $faculty = $this->nullable($data, 'faculty', 80);
        if ($faculty !== null && !in_array($faculty, ['Science', 'Management'], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Select a supported faculty.', 422, [
                'faculty' => ['Choose Science or Management.'],
            ]);
        }
        return $faculty;
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
