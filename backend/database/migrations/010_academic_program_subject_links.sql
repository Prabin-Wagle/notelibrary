ALTER TABLE academic_programs
    ADD COLUMN competitive_exam VARCHAR(150) NULL AFTER program_type;

ALTER TABLE subjects
    ADD COLUMN program_id BIGINT UNSIGNED NULL AFTER id,
    DROP INDEX uq_subjects_slug,
    ADD UNIQUE KEY uq_subjects_program_slug (program_id, slug),
    ADD KEY idx_subjects_program_active (program_id, is_active, name),
    ADD CONSTRAINT fk_subjects_program FOREIGN KEY (program_id)
        REFERENCES academic_programs(id) ON DELETE SET NULL;

UPDATE subjects subject
INNER JOIN (
    SELECT offering.subject_id, MIN(level.program_id) AS program_id
    FROM academic_subjects offering
    INNER JOIN academic_levels level ON level.id = offering.academic_level_id
    GROUP BY offering.subject_id
    HAVING COUNT(DISTINCT level.program_id) = 1
) existing_program ON existing_program.subject_id = subject.id
SET subject.program_id = existing_program.program_id;
