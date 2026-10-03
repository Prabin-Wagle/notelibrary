ALTER TABLE users
    ADD COLUMN suspended_until DATETIME NULL AFTER status,
    ADD COLUMN status_reason VARCHAR(500) NULL AFTER suspended_until;

CREATE TABLE user_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    changed_by_user_id BIGINT UNSIGNED NULL,
    previous_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    suspended_until DATETIME NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at DATETIME NOT NULL,
    KEY idx_user_status_history_user (user_id, created_at),
    CONSTRAINT fk_user_status_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_status_history_actor FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
