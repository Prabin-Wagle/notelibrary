ALTER TABLE resources
    ADD COLUMN legacy_class_level VARCHAR(80) NULL,
    ADD COLUMN legacy_faculty VARCHAR(120) NULL,
    ADD COLUMN legacy_subject VARCHAR(150) NULL,
    ADD COLUMN legacy_exam_type VARCHAR(80) NULL,
    ADD COLUMN legacy_thumbnail_url VARCHAR(2000) NULL,
    ADD KEY idx_resources_legacy_filters (legacy_class_level, legacy_faculty, legacy_subject, status);

ALTER TABLE quizzes
    ADD COLUMN series_uid VARCHAR(80) NULL,
    ADD COLUMN competitive_exam VARCHAR(80) NULL,
    ADD COLUMN negative_marking DECIMAL(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN delivery_mode VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN starts_at DATETIME NULL,
    ADD COLUMN ends_at DATETIME NULL,
    ADD UNIQUE KEY uq_quizzes_series_uid (series_uid),
    ADD KEY idx_quizzes_mode_window (delivery_mode, starts_at, ends_at);

ALTER TABLE quiz_questions
    ADD COLUMN image_url VARCHAR(2000) NULL,
    ADD COLUMN unit_id BIGINT UNSIGNED NULL,
    ADD COLUMN chapter_id VARCHAR(100) NULL,
    ADD CONSTRAINT fk_quiz_question_unit FOREIGN KEY (unit_id) REFERENCES subject_units(id) ON DELETE SET NULL,
    ADD KEY idx_quiz_question_unit (unit_id, quiz_id);

ALTER TABLE quiz_collections
    ADD COLUMN competitive_exam VARCHAR(80) NULL AFTER title;

INSERT INTO resource_types (code, name, is_active)
VALUES ('notice', 'Notices', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1;

CREATE TABLE video_playlist_subjects (
    playlist_id BIGINT UNSIGNED NOT NULL,
    academic_subject_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (playlist_id, academic_subject_id),
    KEY idx_playlist_subject_reverse (academic_subject_id, playlist_id),
    CONSTRAINT fk_vps_playlist FOREIGN KEY (playlist_id) REFERENCES video_playlists(id) ON DELETE CASCADE,
    CONSTRAINT fk_vps_subject FOREIGN KEY (academic_subject_id) REFERENCES academic_subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_question_bank (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_uid VARCHAR(100) NOT NULL,
    academic_subject_id BIGINT UNSIGNED NULL,
    subject_unit_id BIGINT UNSIGNED NULL,
    chapter VARCHAR(200) NULL,
    question_text MEDIUMTEXT NOT NULL,
    image_url VARCHAR(2000) NULL,
    explanation MEDIUMTEXT NULL,
    correct_option SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    marks DECIMAL(8,2) NOT NULL DEFAULT 1,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_admin_question_uid (question_uid),
    KEY idx_admin_question_subject_unit (academic_subject_id, subject_unit_id, is_active),
    CONSTRAINT fk_admin_question_subject FOREIGN KEY (academic_subject_id) REFERENCES academic_subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_admin_question_unit FOREIGN KEY (subject_unit_id) REFERENCES subject_units(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_question_options (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    option_text MEDIUMTEXT NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    KEY idx_admin_qoptions_order (question_id, sort_order),
    CONSTRAINT fk_admin_qoptions_question FOREIGN KEY (question_id) REFERENCES admin_question_bank(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSON NOT NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_admin_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_media_assets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(180) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_admin_media_filename (file_name),
    KEY idx_admin_media_recent (created_at),
    CONSTRAINT fk_admin_media_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
