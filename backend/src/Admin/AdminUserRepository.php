<?php

declare(strict_types=1);

namespace App\Admin;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

final class AdminUserRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @param array<string, mixed> $filters @return array{items:list<array<string,mixed>>,total:int,page:int,per_page:int} */
    public function search(array $filters): array
    {
        $this->expireSuspensions();
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 25)));
        $where = ["u.role = 'student'"];
        $params = [];
        if (isset($filters['status']) && is_string($filters['status']) && $filters['status'] !== '') {
            if (!in_array($filters['status'], ['active', 'suspended', 'banned', 'deleted'], true)) {
                throw new ApiException('VALIDATION_FAILED', 'Invalid account status filter.', 422);
            }
            $where[] = 'u.status = :status';
            $params['status'] = $filters['status'];
        } else {
            $where[] = "u.status <> 'deleted'";
        }
        if (isset($filters['q']) && is_string($filters['q']) && trim($filters['q']) !== '') {
            $where[] = '(u.email LIKE :email_q OR u.username LIKE :username_q OR p.display_name LIKE :name_q)';
            $search = '%' . trim($filters['q']) . '%';
            $params['email_q'] = $search;
            $params['username_q'] = $search;
            $params['name_q'] = $search;
        }
        $whereSql = implode(' AND ', $where);
        $count = $this->database->connection()->prepare(
            "SELECT COUNT(*) FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id WHERE {$whereSql}"
        );
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $statement = $this->database->connection()->prepare(
            "SELECT u.id, u.email, u.username, u.status, u.status_reason, u.suspended_until,
                    u.email_verified_at, u.last_login_at, u.created_at, p.display_name,
                    p.phone, p.avatar_path, p.education_class, p.faculty, p.city
             FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id
             WHERE {$whereSql}
             ORDER BY u.created_at DESC, u.id DESC LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();
        return ['items' => $statement->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $perPage];
    }

    /** @return array{active:int,suspended:int,banned:int,deleted:int} */
    public function counts(): array
    {
        $rows = $this->database->connection()->query(
            "SELECT u.status, COUNT(*) AS total FROM users u WHERE u.role='student' GROUP BY u.status"
        )->fetchAll();
        $counts = ['active' => 0, 'suspended' => 0, 'banned' => 0, 'deleted' => 0];
        foreach ($rows as $row) {
            if (array_key_exists((string) $row['status'], $counts)) {
                $counts[(string) $row['status']] = (int) $row['total'];
            }
        }
        return $counts;
    }

    /** @return array<string, mixed> */
    public function details(int $userId): array
    {
        $this->expireSuspensions();
        $pdo = $this->database->connection();
        $statement = $pdo->prepare(
            "SELECT u.id, u.email, u.username, u.role, u.status, u.status_reason, u.suspended_until,
                    u.email_verified_at, u.last_login_at, u.created_at, u.updated_at,
                    p.display_name, p.phone, p.avatar_path, p.date_of_birth, p.bio, p.province,
                    p.district, p.city, p.education_class, p.faculty, p.competition,
                    pref.theme, pref.locale, pref.timezone, pref.cursor_mode, pref.cursor_size
             FROM users u
             LEFT JOIN student_profiles p ON p.user_id=u.id
             LEFT JOIN user_preferences pref ON pref.user_id=u.id
             WHERE u.id=:id AND u.role='student' LIMIT 1"
        );
        $statement->execute(['id' => $userId]);
        $student = $statement->fetch();
        if ($student === false) {
            throw new ApiException('USER_NOT_FOUND', 'Student account not found.', 404);
        }

        $enrollments = $pdo->prepare(
            "SELECT program.name AS program_name, level.name AS level_name, level.level_type,
                    enrollment.is_primary, enrollment.started_at, enrollment.ended_at
             FROM user_academic_enrollments enrollment
             INNER JOIN academic_levels level ON level.id=enrollment.academic_level_id
             INNER JOIN academic_programs program ON program.id=level.program_id
             WHERE enrollment.user_id=:id ORDER BY enrollment.is_primary DESC, level.sort_order, level.name"
        );
        $enrollments->execute(['id' => $userId]);

        $activity = $pdo->prepare(
            "SELECT
                (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.user_id=:attempts_user) AS quiz_attempts,
                (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.user_id=:completed_user AND qa.status='submitted') AS completed_tests,
                (SELECT ROUND(AVG(qa.score), 2) FROM quiz_attempts qa WHERE qa.user_id=:average_user AND qa.status='submitted') AS average_score,
                (SELECT COUNT(*) FROM bookmarks b WHERE b.user_id=:bookmarks_user) AS saved_resources,
                (SELECT COALESCE(SUM(history.view_count), 0) FROM user_resource_history history WHERE history.user_id=:history_user) AS resource_views,
                (SELECT COUNT(*) FROM study_targets st WHERE st.user_id=:targets_user AND st.target_date >= UTC_DATE()) AS upcoming_targets,
                (SELECT COUNT(*) FROM support_tickets ticket WHERE ticket.user_id=:tickets_user) AS support_tickets,
                (SELECT COUNT(*) FROM payment_requests payment WHERE payment.user_id=:payments_user) AS payment_requests"
        );
        $activity->execute([
            'attempts_user' => $userId,
            'completed_user' => $userId,
            'average_user' => $userId,
            'bookmarks_user' => $userId,
            'history_user' => $userId,
            'targets_user' => $userId,
            'tickets_user' => $userId,
            'payments_user' => $userId,
        ]);

        $attempts = $pdo->prepare(
            "SELECT quiz.title, quiz_attempts.status, quiz_attempts.score, quiz_attempts.maximum_score,
                    quiz_attempts.started_at, quiz_attempts.submitted_at
             FROM quiz_attempts INNER JOIN quizzes quiz ON quiz.id=quiz_attempts.quiz_id
             WHERE quiz_attempts.user_id=:id ORDER BY quiz_attempts.started_at DESC LIMIT 5"
        );
        $attempts->execute(['id' => $userId]);

        $tickets = $pdo->prepare(
            'SELECT id, subject, category, priority, status, created_at, updated_at
             FROM support_tickets WHERE user_id=:id ORDER BY updated_at DESC LIMIT 5'
        );
        $tickets->execute(['id' => $userId]);

        $payments = $pdo->prepare(
            'SELECT amount, currency, provider, reference, status, created_at, reviewed_at
             FROM payment_requests WHERE user_id=:id ORDER BY created_at DESC LIMIT 5'
        );
        $payments->execute(['id' => $userId]);

        $history = $pdo->prepare(
            "SELECT history.previous_status, history.new_status, history.reason, history.suspended_until,
                    history.source, history.created_at, actor.email AS actor_email,
                    actor_profile.display_name AS actor_name
             FROM user_status_history history
             LEFT JOIN users actor ON actor.id=history.changed_by_user_id
             LEFT JOIN student_profiles actor_profile ON actor_profile.user_id=actor.id
             WHERE history.user_id=:id ORDER BY history.created_at DESC, history.id DESC LIMIT 30"
        );
        $history->execute(['id' => $userId]);

        return [
            'student' => $student,
            'enrollments' => $enrollments->fetchAll(),
            'activity' => $activity->fetch() ?: [],
            'recent_attempts' => $attempts->fetchAll(),
            'recent_tickets' => $tickets->fetchAll(),
            'recent_payments' => $payments->fetchAll(),
            'status_history' => $history->fetchAll(),
        ];
    }

    public function avatarPath(int $userId): ?string
    {
        $statement = $this->database->connection()->prepare(
            "SELECT profile.avatar_path FROM users INNER JOIN student_profiles profile ON profile.user_id=users.id
             WHERE users.id=:id AND users.role='student' LIMIT 1"
        );
        $statement->execute(['id' => $userId]);
        $path = $statement->fetchColumn();
        return is_string($path) ? $path : null;
    }

    public function setStatus(int $userId, string $status, ?int $actorId, ?string $reason, ?string $suspendedUntil): void
    {
        if (!in_array($status, ['active', 'suspended', 'banned'], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Invalid account status.', 422);
        }
        $reason = $reason === null ? null : trim($reason);
        if (mb_strlen((string) $reason) > 500) {
            throw new ApiException('VALIDATION_FAILED', 'The moderation reason must be 500 characters or fewer.', 422);
        }
        if (in_array($status, ['suspended', 'banned'], true) && ($reason === null || $reason === '')) {
            throw new ApiException('VALIDATION_FAILED', 'Add a reason before restricting this account.', 422);
        }
        if ($status !== 'suspended' && $suspendedUntil !== null && $suspendedUntil !== '') {
            throw new ApiException('VALIDATION_FAILED', 'Only a suspension can have an end date.', 422);
        }
        $until = null;
        if ($status === 'suspended' && $suspendedUntil !== null && $suspendedUntil !== '') {
            try {
                $until = (new \DateTimeImmutable($suspendedUntil))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            } catch (\Throwable) {
                throw new ApiException('VALIDATION_FAILED', 'Choose a valid suspension end date.', 422);
            }
            if ($until <= gmdate('Y-m-d H:i:s')) {
                throw new ApiException('VALIDATION_FAILED', 'The suspension end date must be in the future.', 422);
            }
        }

        $this->database->transaction(function (PDO $pdo) use ($userId, $status, $actorId, $reason, $until): void {
            $current = $pdo->prepare("SELECT status, suspended_until FROM users WHERE id=:id AND role='student' FOR UPDATE");
            $current->execute(['id' => $userId]);
            $existing = $current->fetch();
            if ($existing === false || $existing['status'] === 'deleted') {
                throw new ApiException('USER_NOT_FOUND', 'Student account not found.', 404);
            }
            $previous = (string) $existing['status'];
            if ($previous === $status && (($existing['suspended_until'] ?? null) === $until)) {
                return;
            }
            $pdo->prepare(
                'UPDATE users SET status=:status, suspended_until=:until, status_reason=:reason, updated_at=UTC_TIMESTAMP() WHERE id=:id'
            )->execute(['status' => $status, 'until' => $until, 'reason' => $status === 'active' ? null : $reason, 'id' => $userId]);
            $pdo->prepare(
                'INSERT INTO user_status_history
                    (user_id, changed_by_user_id, previous_status, new_status, reason, suspended_until, source, created_at)
                 VALUES (:user_id, :actor_id, :previous, :new, :reason, :until, \'admin\', UTC_TIMESTAMP())'
            )->execute([
                'user_id' => $userId, 'actor_id' => $actorId, 'previous' => $previous,
                'new' => $status, 'reason' => $reason, 'until' => $until,
            ]);
        });
    }

    public function softDelete(int $userId, ?int $actorId, ?string $reason): void
    {
        $reason = trim((string) $reason);
        if (mb_strlen($reason) > 500) throw new ApiException('VALIDATION_FAILED', 'The deletion reason must be 500 characters or fewer.', 422);
        $this->database->transaction(function (PDO $pdo) use ($userId, $actorId, $reason): void {
            $current = $pdo->prepare("SELECT status FROM users WHERE id=:id AND role='student' FOR UPDATE");
            $current->execute(['id' => $userId]);
            $existing = $current->fetch();
            if ($existing === false || $existing['status'] === 'deleted') {
                throw new ApiException('USER_NOT_FOUND', 'Student account not found.', 404);
            }
            $previous = (string) $existing['status'];
            $pdo->prepare(
                "UPDATE users SET status='deleted', suspended_until=NULL, status_reason=:reason,
                    email=CONCAT('deleted+', id, '+', UNIX_TIMESTAMP(), '@invalid.local'),
                    username=CONCAT('deleted-', id, '-', UNIX_TIMESTAMP()), updated_at=UTC_TIMESTAMP() WHERE id=:id"
            )->execute(['reason' => $reason !== '' ? $reason : 'Account removed by an administrator.', 'id' => $userId]);
            $pdo->prepare(
                "UPDATE student_profiles SET display_name='Deleted account', phone=NULL, avatar_path=NULL,
                    date_of_birth=NULL, bio=NULL, province=NULL, district=NULL, city=NULL,
                    education_class=NULL, faculty=NULL, competition=NULL, updated_at=UTC_TIMESTAMP() WHERE user_id=:id"
            )->execute(['id' => $userId]);
            $pdo->prepare(
                'INSERT INTO user_status_history
                    (user_id, changed_by_user_id, previous_status, new_status, reason, source, created_at)
                 VALUES (:user_id, :actor_id, :previous, \'deleted\', :reason, \'admin\', UTC_TIMESTAMP())'
            )->execute([
                'user_id' => $userId, 'actor_id' => $actorId, 'previous' => $previous,
                'reason' => $reason !== '' ? $reason : 'Account removed by an administrator.',
            ]);
        });
    }

    private function expireSuspensions(): void
    {
        $this->database->transaction(function (PDO $pdo): void {
            $expired = $pdo->query(
                "SELECT id FROM users WHERE role='student' AND status='suspended'
                    AND suspended_until IS NOT NULL AND suspended_until<=UTC_TIMESTAMP() FOR UPDATE"
            )->fetchAll(PDO::FETCH_COLUMN);
            if ($expired === []) return;
            $update = $pdo->prepare(
                "UPDATE users SET status='active', suspended_until=NULL, status_reason=NULL, updated_at=UTC_TIMESTAMP()
                 WHERE id=:id AND status='suspended' AND suspended_until IS NOT NULL AND suspended_until<=UTC_TIMESTAMP()"
            );
            $history = $pdo->prepare(
                "INSERT INTO user_status_history
                    (user_id, changed_by_user_id, previous_status, new_status, reason, source, created_at)
                 VALUES (:id, NULL, 'suspended', 'active', 'Suspension period ended.', 'system', UTC_TIMESTAMP())"
            );
            foreach ($expired as $id) {
                $update->execute(['id' => (int) $id]);
                if ($update->rowCount() > 0) $history->execute(['id' => (int) $id]);
            }
        });
    }
}
