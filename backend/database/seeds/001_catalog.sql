INSERT INTO resource_types (code, name, is_active) VALUES
('note', 'Notes', 1),
('book', 'Books', 1),
('blog', 'Articles', 1),
('video', 'Videos', 1),
('playlist', 'Playlists', 1),
('question-set', 'Question sets', 1);

INSERT INTO academic_programs
    (code, name, program_type, description, sort_order, is_active, created_at, updated_at)
VALUES
('NEB', 'National Examinations Board', 'school', 'Nepal secondary-level curriculum.', 10, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('IOE', 'IOE Entrance', 'entrance', 'Engineering entrance preparation.', 20, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('CEE', 'Common Entrance Examination', 'entrance', 'Medical entrance preparation.', 30, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('TU-BSC-CSIT', 'TU B.Sc. CSIT', 'university', 'Tribhuvan University B.Sc. CSIT.', 40, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());

SET @neb_id = (SELECT id FROM academic_programs WHERE code = 'NEB');
INSERT INTO academic_levels
    (program_id, parent_id, level_type, code, name, slug, sort_order, is_active, created_at, updated_at)
VALUES
(@neb_id, NULL, 'grade', 'G11', 'Grade 11', 'grade-11', 11, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
(@neb_id, NULL, 'grade', 'G12', 'Grade 12', 'grade-12', 12, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());

SET @grade12_id = (SELECT id FROM academic_levels WHERE program_id = @neb_id AND code = 'G12');
INSERT INTO academic_levels
    (program_id, parent_id, level_type, code, name, slug, sort_order, is_active, created_at, updated_at)
VALUES
(@neb_id, @grade12_id, 'stream', 'SCI', 'Science', 'science', 10, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());

INSERT INTO subjects (code, name, slug, description, is_active, created_at, updated_at) VALUES
('PHY', 'Physics', 'physics', 'Motion, forces, energy and the laws of the physical world.', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('CHE', 'Chemistry', 'chemistry', 'Matter, reactions and the patterns connecting each element.', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('MAT', 'Mathematics', 'mathematics', 'Concepts, proofs and worked problems.', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('ENG', 'English', 'english', 'Language, communication and literature.', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());

SET @science_id = (SELECT id FROM academic_levels WHERE program_id = @neb_id AND code = 'SCI');
INSERT INTO academic_subjects
    (academic_level_id, subject_id, display_code, sort_order, is_active, created_at, updated_at)
SELECT @science_id, id, CONCAT(code, '-12'),
       CASE code WHEN 'PHY' THEN 10 WHEN 'CHE' THEN 20 WHEN 'MAT' THEN 30 ELSE 40 END,
       1, UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM subjects WHERE code IN ('PHY', 'CHE', 'MAT', 'ENG');

SET @physics_offering = (
    SELECT a.id FROM academic_subjects a INNER JOIN subjects s ON s.id = a.subject_id
    WHERE a.academic_level_id = @science_id AND s.code = 'PHY'
);
INSERT INTO subject_units
    (academic_subject_id, parent_id, code, title, slug, description, sort_order, is_active, created_at, updated_at)
VALUES
(@physics_offering, NULL, 'MECH', 'Mechanics', 'mechanics', 'Motion, forces and energy.', 10, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());
