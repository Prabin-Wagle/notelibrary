CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    username VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'student',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    email_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_username (username),
    KEY idx_users_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_profiles (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NULL,
    avatar_path VARCHAR(500) NULL,
    date_of_birth DATE NULL,
    bio VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_preferences (
    user_id BIGINT UNSIGNED PRIMARY KEY,
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kathmandu',
    cursor_mode VARCHAR(20) NOT NULL DEFAULT 'default',
    cursor_size VARCHAR(20) NOT NULL DEFAULT 'medium',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash BINARY(32) NOT NULL,
    user_agent VARCHAR(500) NOT NULL DEFAULT '',
    ip_hash BINARY(32) NOT NULL,
    last_used_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_auth_sessions_token (token_hash),
    KEY idx_auth_sessions_user_active (user_id, revoked_at, expires_at),
    KEY idx_auth_sessions_expiry (expires_at),
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_challenges (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    purpose VARCHAR(40) NOT NULL,
    destination VARCHAR(254) NOT NULL,
    secret_hash BINARY(32) NOT NULL,
    attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    requested_ip_hash BINARY(32) NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_challenges_destination (purpose, destination, created_at),
    KEY idx_challenges_user (user_id, purpose, consumed_at),
    KEY idx_challenges_expiry (expires_at),
    CONSTRAINT fk_challenges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_programs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    program_type VARCHAR(40) NOT NULL,
    description VARCHAR(1000) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_programs_code (code),
    KEY idx_programs_active_sort (is_active, sort_order, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_levels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    level_type VARCHAR(40) NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_levels_code (program_id, parent_id, code),
    UNIQUE KEY uq_levels_slug (program_id, parent_id, slug),
    KEY idx_levels_tree (program_id, parent_id, is_active, sort_order),
    CONSTRAINT fk_levels_program FOREIGN KEY (program_id) REFERENCES academic_programs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_levels_parent FOREIGN KEY (parent_id) REFERENCES academic_levels(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subjects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(60) NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    description VARCHAR(1000) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_subjects_slug (slug),
    UNIQUE KEY uq_subjects_code (code),
    KEY idx_subjects_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_subjects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    academic_level_id BIGINT UNSIGNED NOT NULL,
    subject_id BIGINT UNSIGNED NOT NULL,
    display_code VARCHAR(60) NULL,
    credit_hours DECIMAL(5,2) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_academic_subject (academic_level_id, subject_id),
    KEY idx_academic_subject_sort (academic_level_id, is_active, sort_order),
    KEY idx_academic_subject_subject (subject_id, academic_level_id),
    CONSTRAINT fk_academic_subject_level FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE RESTRICT,
    CONSTRAINT fk_academic_subject_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subject_units (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    academic_subject_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    code VARCHAR(60) NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    description VARCHAR(1000) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_units_slug (academic_subject_id, parent_id, slug),
    KEY idx_units_tree (academic_subject_id, parent_id, is_active, sort_order),
    CONSTRAINT fk_units_academic_subject FOREIGN KEY (academic_subject_id) REFERENCES academic_subjects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_units_parent FOREIGN KEY (parent_id) REFERENCES subject_units(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_academic_enrollments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    academic_level_id BIGINT UNSIGNED NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    started_at DATE NULL,
    ended_at DATE NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_user_enrollment (user_id, academic_level_id),
    KEY idx_enrollments_user_primary (user_id, is_primary, ended_at),
    CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_level FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resource_types (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_resource_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resources (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resource_type_id SMALLINT UNSIGNED NOT NULL,
    author_user_id BIGINT UNSIGNED NULL,
    title VARCHAR(250) NOT NULL,
    slug VARCHAR(280) NOT NULL,
    summary VARCHAR(1000) NULL,
    body MEDIUMTEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    visibility VARCHAR(30) NOT NULL DEFAULT 'authenticated',
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_resources_slug (slug),
    KEY idx_resources_published (status, published_at, id),
    KEY idx_resources_type_published (resource_type_id, status, published_at),
    CONSTRAINT fk_resources_type FOREIGN KEY (resource_type_id) REFERENCES resource_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_resources_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resource_assets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    resource_id BIGINT UNSIGNED NOT NULL,
    asset_type VARCHAR(30) NOT NULL,
    storage_disk VARCHAR(30) NOT NULL DEFAULT 'local',
    storage_path VARCHAR(700) NULL,
    external_url VARCHAR(2000) NULL,
    original_filename VARCHAR(255) NULL,
    mime_type VARCHAR(150) NULL,
    file_size BIGINT UNSIGNED NULL,
    checksum CHAR(64) NULL,
    page_count INT UNSIGNED NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_assets_resource_sort (resource_id, sort_order),
    CONSTRAINT fk_assets_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resource_academic_subjects (
    resource_id BIGINT UNSIGNED NOT NULL,
    academic_subject_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (resource_id, academic_subject_id),
    KEY idx_resource_subject_reverse (academic_subject_id, resource_id),
    CONSTRAINT fk_resource_subject_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    CONSTRAINT fk_resource_subject_subject FOREIGN KEY (academic_subject_id) REFERENCES academic_subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE resource_units (
    resource_id BIGINT UNSIGNED NOT NULL,
    subject_unit_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (resource_id, subject_unit_id),
    KEY idx_resource_units_reverse (subject_unit_id, resource_id),
    CONSTRAINT fk_resource_units_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    CONSTRAINT fk_resource_units_unit FOREIGN KEY (subject_unit_id) REFERENCES subject_units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookmarks (
    user_id BIGINT UNSIGNED NOT NULL,
    resource_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, resource_id),
    KEY idx_bookmarks_user_recent (user_id, created_at),
    KEY idx_bookmarks_resource (resource_id),
    CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookmarks_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_resource_history (
    user_id BIGINT UNSIGNED NOT NULL,
    resource_id BIGINT UNSIGNED NOT NULL,
    first_viewed_at DATETIME NOT NULL,
    last_viewed_at DATETIME NOT NULL,
    view_count INT UNSIGNED NOT NULL DEFAULT 1,
    last_page INT UNSIGNED NULL,
    progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, resource_id),
    KEY idx_history_user_recent (user_id, last_viewed_at),
    KEY idx_history_resource (resource_id),
    CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
