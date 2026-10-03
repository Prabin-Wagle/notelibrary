<?php

declare(strict_types=1);

namespace App\Support;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

final class SupportTicketRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return list<array<string, mixed>> */
    public function listForStudent(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT t.id, t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at,
                    (SELECT r.message FROM support_replies r WHERE r.ticket_id = t.id ORDER BY r.id LIMIT 1) AS message
             FROM support_tickets t WHERE t.user_id = :user_id ORDER BY t.updated_at DESC, t.id DESC"
        );
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed> */
    public function create(int $userId, string $subject, string $message, string $category): array
    {
        return $this->database->transaction(function (PDO $pdo) use ($userId, $subject, $message, $category): array {
            $ticket = $pdo->prepare(
                "INSERT INTO support_tickets (user_id, subject, category, priority, status, created_at, updated_at)
                 VALUES (:user_id, :subject, :category, 'normal', 'open', UTC_TIMESTAMP(), UTC_TIMESTAMP())"
            );
            $ticket->execute(['user_id' => $userId, 'subject' => $subject, 'category' => $category]);
            $ticketId = (int) $pdo->lastInsertId();
            $reply = $pdo->prepare(
                "INSERT INTO support_replies (ticket_id, author_user_id, author_role, message, created_at)
                 VALUES (:ticket_id, :user_id, 'student', :message, UTC_TIMESTAMP())"
            );
            $reply->execute(['ticket_id' => $ticketId, 'user_id' => $userId, 'message' => $message]);
            return $this->find($ticketId, $userId, $pdo);
        });
    }

    /** @return array<string, mixed> */
    public function detail(int $ticketId, int $userId): array
    {
        return $this->find($ticketId, $userId, $this->database->connection());
    }

    public function reply(int $ticketId, int $userId, string $message): void
    {
        $this->database->transaction(function (PDO $pdo) use ($ticketId, $userId, $message): void {
            $ticket = $pdo->prepare('SELECT status FROM support_tickets WHERE id = :id AND user_id = :user_id FOR UPDATE');
            $ticket->execute(['id' => $ticketId, 'user_id' => $userId]);
            $status = $ticket->fetchColumn();
            if ($status === false) {
                throw new ApiException('TICKET_NOT_FOUND', 'Support request not found.', 404);
            }
            if ($status === 'closed') {
                throw new ApiException('TICKET_CLOSED', 'This support request is closed.', 409);
            }
            $pdo->prepare(
                "INSERT INTO support_replies (ticket_id, author_user_id, author_role, message, created_at)
                 VALUES (:ticket_id, :user_id, 'student', :message, UTC_TIMESTAMP())"
            )->execute(['ticket_id' => $ticketId, 'user_id' => $userId, 'message' => $message]);
            $pdo->prepare("UPDATE support_tickets SET status = 'open', updated_at = UTC_TIMESTAMP() WHERE id = :id")
                ->execute(['id' => $ticketId]);
        });
    }

    public function close(int $ticketId, int $userId): void
    {
        $check = $this->database->connection()->prepare('SELECT 1 FROM support_tickets WHERE id = :id AND user_id = :user_id');
        $check->execute(['id' => $ticketId, 'user_id' => $userId]);
        if ($check->fetchColumn() === false) {
            throw new ApiException('TICKET_NOT_FOUND', 'Support request not found.', 404);
        }
        $this->database->connection()->prepare(
            "UPDATE support_tickets SET status = 'closed', closed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE id = :id AND user_id = :user_id"
        )->execute(['id' => $ticketId, 'user_id' => $userId]);
    }

    /** @return array<string, mixed> */
    private function find(int $ticketId, int $userId, PDO $pdo): array
    {
        $statement = $pdo->prepare(
            'SELECT id, subject, category, priority, status, created_at, updated_at
             FROM support_tickets WHERE id = :id AND user_id = :user_id'
        );
        $statement->execute(['id' => $ticketId, 'user_id' => $userId]);
        $ticket = $statement->fetch();
        if ($ticket === false) {
            throw new ApiException('TICKET_NOT_FOUND', 'Support request not found.', 404);
        }
        $replies = $pdo->prepare(
            'SELECT id, author_user_id AS user_id, author_role, message, created_at
             FROM support_replies WHERE ticket_id = :ticket_id ORDER BY id'
        );
        $replies->execute(['ticket_id' => $ticketId]);
        $ticket['replies'] = array_map(static function (array $reply): array {
            $reply['is_admin'] = $reply['author_role'] !== 'student';
            unset($reply['author_role']);
            return $reply;
        }, $replies->fetchAll());
        $ticket['message'] = $ticket['replies'][0]['message'] ?? '';
        $ticket['admin_reply'] = null;
        foreach ($ticket['replies'] as $reply) {
            if ($reply['is_admin']) {
                $ticket['admin_reply'] = $reply['message'];
            }
        }
        return $ticket;
    }
}
