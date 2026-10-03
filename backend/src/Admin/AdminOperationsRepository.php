<?php

declare(strict_types=1);

namespace App\Admin;

use App\Infrastructure\Database\Database;
use PDO;

final class AdminOperationsRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function promoCodes(): array
    {
        return $this->database->connection()->query(
            "SELECT id, code, discount_value AS discount_percent, usage_limit AS max_uses,
                    usage_count AS used_count, IF(is_active = 1, 'active', 'inactive') AS status, created_at
             FROM promo_codes ORDER BY created_at DESC"
        )->fetchAll();
    }

    /** @param array<string, mixed> $body */
    public function promoAction(array $body, int $adminId): string
    {
        $action = (string) ($body['action'] ?? 'add');
        $pdo = $this->database->connection();
        if ($action === 'toggle') {
            $pdo->prepare('UPDATE promo_codes SET is_active = NOT is_active, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['id' => (int) ($body['id'] ?? 0)]);
            return 'Promo code status updated.';
        }
        if ($action === 'delete') {
            $pdo->prepare('DELETE FROM promo_codes WHERE id = :id')->execute(['id' => (int) ($body['id'] ?? 0)]);
            return 'Promo code deleted.';
        }
        $pdo->prepare(
            "INSERT INTO promo_codes
                (code, discount_type, discount_value, usage_limit, usage_count, is_active, created_by, created_at, updated_at)
             VALUES (:code, 'percent', :value, :limit, 0, 1, :admin, UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        )->execute([
            'code' => strtoupper(trim((string) ($body['code'] ?? ''))),
            'value' => (float) ($body['discount_percent'] ?? 0),
            'limit' => ($body['max_uses'] ?? '') === '' ? null : (int) $body['max_uses'],
            'admin' => $adminId,
        ]);
        return 'Promo code created.';
    }

    /** @return list<array<string, mixed>> */
    public function payments(string $status): array
    {
        $where = $status === 'all' ? '' : 'WHERE pr.status = :status';
        $statement = $this->database->connection()->prepare(
            "SELECT pr.id, pr.user_id, p.display_name AS user_name, u.email AS user_email,
                    pr.collection_id, COALESCE(qc.title, 'Unassigned collection') AS collection_title,
                    pr.proof_path AS screenshot_path, pr.status, pr.reference AS transaction_code,
                    pr.promo_code, pr.created_at, p.avatar_path AS user_profile_picture
             FROM payment_requests pr
             INNER JOIN users u ON u.id = pr.user_id
             INNER JOIN student_profiles p ON p.user_id = u.id
             LEFT JOIN quiz_collections qc ON qc.id = pr.collection_id
             {$where} ORDER BY pr.created_at DESC"
        );
        $statement->execute($status === 'all' ? [] : ['status' => $status]);
        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $body */
    public function paymentAction(array $body, int $adminId): string
    {
        $action = (string) ($body['action'] ?? '');
        $status = match ($action) { 'approve' => 'approved', 'reject' => 'rejected', 'revoke' => 'pending', default => 'pending' };
        $this->database->connection()->prepare(
            'UPDATE payment_requests SET status = :status, reference = COALESCE(NULLIF(:reference, \'\'), reference),
             review_note = :note, reviewed_by = :admin, reviewed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE id = :id'
        )->execute([
            'status' => $status,
            'reference' => trim((string) ($body['transaction_code'] ?? '')),
            'note' => trim((string) ($body['note'] ?? '')),
            'admin' => $adminId,
            'id' => (int) ($body['request_id'] ?? 0),
        ]);
        return "Payment request {$status}.";
    }

    /** @return list<array<string, mixed>> */
    public function tickets(): array
    {
        return $this->database->connection()->query(
            "SELECT t.id, t.user_id, t.subject, t.status, t.created_at, t.updated_at,
                    p.display_name AS user_name, u.email AS user_email, p.avatar_path AS user_profile_picture,
                    COALESCE((SELECT message FROM support_replies r WHERE r.ticket_id = t.id ORDER BY r.created_at ASC LIMIT 1), '') AS message,
                    (SELECT message FROM support_replies r WHERE r.ticket_id = t.id AND r.author_role = 'admin' ORDER BY r.created_at DESC LIMIT 1) AS admin_reply,
                    NULL AS question_id
             FROM support_tickets t
             INNER JOIN users u ON u.id = t.user_id
             INNER JOIN student_profiles p ON p.user_id = u.id
             ORDER BY t.updated_at DESC"
        )->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function ticketReplies(int $ticketId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT r.id, r.ticket_id, r.author_user_id, r.author_role, r.message, r.created_at,
                    COALESCE(p.display_name, u.username) AS author_name
             FROM support_replies r INNER JOIN users u ON u.id = r.author_user_id
             LEFT JOIN student_profiles p ON p.user_id = u.id
             WHERE r.ticket_id = :ticket ORDER BY r.created_at ASC'
        );
        $statement->execute(['ticket' => $ticketId]);
        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $body */
    public function reply(array $body, int $adminId): string
    {
        $ticketId = (int) ($body['ticket_id'] ?? 0);
        $status = (string) ($body['status'] ?? 'answered');
        $message = trim((string) ($body['admin_reply'] ?? ''));
        $this->database->transaction(function (PDO $pdo) use ($ticketId, $status, $message, $adminId): void {
            if ($message !== '') {
                $pdo->prepare(
                    "INSERT INTO support_replies (ticket_id, author_user_id, author_role, message, created_at)
                     VALUES (:ticket, :admin, 'admin', :message, UTC_TIMESTAMP())"
                )->execute(['ticket' => $ticketId, 'admin' => $adminId, 'message' => $message]);
            }
            $pdo->prepare(
                "UPDATE support_tickets SET status = :status,
                 closed_at = IF(:status = 'closed', UTC_TIMESTAMP(), NULL), updated_at = UTC_TIMESTAMP() WHERE id = :id"
            )->execute(['status' => $status, 'id' => $ticketId]);
        });
        return $status === 'closed' ? 'Ticket closed.' : 'Reply sent.';
    }
}

