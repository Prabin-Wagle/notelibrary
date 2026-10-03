<?php

declare(strict_types=1);

namespace App\Academic;

use App\Infrastructure\Database\Database;

final class AcademicRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function programs(): array
    {
        return $this->database->connection()->query(
            'SELECT id, code, name, program_type, description
             FROM academic_programs WHERE is_active = 1 ORDER BY sort_order, name'
        )->fetchAll();
    }

    /** @return array{classes:list<string>,faculties:list<string>,competitions:list<array{id:int,exam_name:string}>} */
    public function registrationOptions(): array
    {
        $pdo = $this->database->connection();
        $classes = $pdo->query(
            "SELECT DISTINCT l.code, l.name FROM academic_levels l
             INNER JOIN academic_programs p ON p.id = l.program_id
             WHERE p.code = 'NEB' AND l.is_active = 1 AND l.level_type = 'grade'
             ORDER BY l.sort_order, l.name"
        )->fetchAll();
        $faculties = $pdo->query(
            "SELECT DISTINCT child.name FROM academic_levels child
             INNER JOIN academic_levels parent ON parent.id = child.parent_id
             INNER JOIN academic_programs p ON p.id = child.program_id
             WHERE p.code = 'NEB' AND child.level_type = 'stream' AND child.is_active = 1
             ORDER BY child.sort_order, child.name"
        )->fetchAll();
        $programs = $pdo->query(
            "SELECT id, name FROM academic_programs
             WHERE is_active = 1 AND program_type IN ('entrance', 'university')
             ORDER BY sort_order, name"
        )->fetchAll();

        return [
            'classes' => array_map(static fn (array $row): string => 'class' . substr((string) $row['code'], 1), $classes),
            'faculties' => array_map(static fn (array $row): string => (string) $row['name'], $faculties),
            'competitions' => array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'exam_name' => (string) $row['name']], $programs),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function levels(string $programCode, ?int $parentId): array
    {
        $sql = 'SELECT l.id, l.parent_id, l.level_type, l.code, l.name, l.slug, l.sort_order
                FROM academic_levels l
                INNER JOIN academic_programs p ON p.id = l.program_id
                WHERE p.code = :program_code AND l.is_active = 1 AND ';
        $sql .= $parentId === null ? 'l.parent_id IS NULL' : 'l.parent_id = :parent_id';
        $sql .= ' ORDER BY l.sort_order, l.name';
        $statement = $this->database->connection()->prepare($sql);
        $params = ['program_code' => $programCode];
        if ($parentId !== null) {
            $params['parent_id'] = $parentId;
        }
        $statement->execute($params);
        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function subjects(int $levelId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT a.id AS academic_subject_id, s.id AS subject_id, s.code, s.name, s.slug,
                    s.description, a.display_code, a.credit_hours, a.sort_order
             FROM academic_subjects a
             INNER JOIN subjects s ON s.id = a.subject_id
             WHERE a.academic_level_id = :level_id AND a.is_active = 1 AND s.is_active = 1
             ORDER BY a.sort_order, s.name'
        );
        $statement->execute(['level_id' => $levelId]);
        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function units(int $academicSubjectId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT id, parent_id, code, title, slug, description, sort_order
             FROM subject_units
             WHERE academic_subject_id = :academic_subject_id AND is_active = 1
             ORDER BY parent_id, sort_order, title'
        );
        $statement->execute(['academic_subject_id' => $academicSubjectId]);
        return $statement->fetchAll();
    }
}
