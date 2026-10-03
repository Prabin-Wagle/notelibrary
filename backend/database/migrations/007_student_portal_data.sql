CREATE TABLE study_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(180) NOT NULL,
    target_date DATE NOT NULL,
    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_targets_user_date (user_id, target_date),
    CONSTRAINT fk_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO academic_levels
    (program_id, parent_id, level_type, code, name, slug, sort_order, is_active, created_at, updated_at)
SELECT p.id, NULL, 'grade', CONCAT('G', grades.grade), CONCAT('Grade ', grades.grade),
       CONCAT('grade-', grades.grade), grades.grade, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM academic_programs p
CROSS JOIN (SELECT 8 AS grade UNION ALL SELECT 9 UNION ALL SELECT 10) grades
WHERE p.code = 'NEB'
  AND NOT EXISTS (SELECT 1 FROM academic_levels l WHERE l.program_id = p.id AND l.parent_id IS NULL AND l.code = CONCAT('G', grades.grade));

INSERT INTO academic_levels
    (program_id, parent_id, level_type, code, name, slug, sort_order, is_active, created_at, updated_at)
SELECT p.id, parent.id, 'stream', streams.code, streams.name, LOWER(streams.code), streams.sort_order,
       1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM academic_programs p
JOIN academic_levels parent ON parent.program_id = p.id AND parent.code IN ('G11', 'G12')
CROSS JOIN (
    SELECT 'SCI' AS code, 'Science' AS name, 10 AS sort_order
    UNION ALL SELECT 'MGT', 'Management', 20
    UNION ALL SELECT 'HUM', 'Humanities', 30
) streams
WHERE p.code = 'NEB'
  AND NOT EXISTS (SELECT 1 FROM academic_levels child WHERE child.program_id = p.id AND child.parent_id = parent.id AND child.code = streams.code);
