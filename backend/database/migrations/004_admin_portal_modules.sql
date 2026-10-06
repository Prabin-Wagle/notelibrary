CREATE TABLE quiz_collections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000) NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_price DECIMAL(12,2) NULL,
    image_url VARCHAR(2000) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_quiz_collections_active (is_active, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE quizzes
    ADD COLUMN collection_id BIGINT UNSIGNED NULL AFTER id,
    ADD CONSTRAINT fk_quizzes_collection FOREIGN KEY (collection_id) REFERENCES quiz_collections(id) ON DELETE SET NULL,
    ADD KEY idx_quizzes_collection_status (collection_id, status, created_at);

ALTER TABLE payment_requests
    ADD COLUMN collection_id BIGINT UNSIGNED NULL AFTER user_id,
    ADD COLUMN promo_code VARCHAR(80) NULL AFTER reference,
    ADD CONSTRAINT fk_payments_collection FOREIGN KEY (collection_id) REFERENCES quiz_collections(id) ON DELETE SET NULL,
    ADD KEY idx_payments_collection (collection_id, status);

CREATE TABLE video_playlists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    academic_subject_id BIGINT UNSIGNED NULL,
    title VARCHAR(250) NOT NULL,
    description VARCHAR(1000) NULL,
    thumbnail_url VARCHAR(2000) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_playlists_subject_sort (academic_subject_id, is_active, sort_order),
    CONSTRAINT fk_playlists_subject FOREIGN KEY (academic_subject_id) REFERENCES academic_subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE videos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    playlist_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(250) NOT NULL,
    description VARCHAR(1000) NULL,
    video_url VARCHAR(2000) NOT NULL,
    thumbnail_url VARCHAR(2000) NULL,
    duration_seconds INT UNSIGNED NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    KEY idx_videos_playlist_sort (playlist_id, is_active, sort_order),
    CONSTRAINT fk_videos_playlist FOREIGN KEY (playlist_id) REFERENCES video_playlists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

