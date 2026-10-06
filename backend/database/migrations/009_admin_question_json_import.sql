ALTER TABLE admin_question_bank
    ADD COLUMN exam_code VARCHAR(16) NULL AFTER question_uid,
    ADD COLUMN source_subject VARCHAR(140) NULL AFTER exam_code,
    ADD COLUMN source_file VARCHAR(500) NULL AFTER source_subject,
    ADD COLUMN source_question_id VARCHAR(120) NULL AFTER source_file,
    ADD COLUMN source_row_number INT UNSIGNED NULL AFTER source_question_id,
    ADD COLUMN source_chapter_id VARCHAR(200) NULL AFTER source_question_id,
    ADD COLUMN source_tags JSON NULL AFTER source_chapter_id,
    ADD COLUMN source_question_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER source_file,
    ADD KEY idx_admin_question_exam_subject (exam_code, source_subject, is_active),
    ADD UNIQUE KEY uq_admin_question_source_key (source_question_key);
