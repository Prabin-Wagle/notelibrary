<?php

declare(strict_types=1);

namespace App\Admin;

use App\Infrastructure\Database\Database;

final class AdminDashboardRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array<string, int|float> */
    public function stats(): array
    {
        $pdo = $this->database->connection();
        $queries = [
            'students' => "SELECT COUNT(*) FROM users WHERE role = 'student' AND status <> 'deleted'",
            'active_students' => "SELECT COUNT(*) FROM users WHERE role = 'student' AND status = 'active'",
            'resources' => "SELECT COUNT(*) FROM resources WHERE status <> 'archived'",
            'published_resources' => "SELECT COUNT(*) FROM resources WHERE status = 'published'",
            'quizzes' => "SELECT COUNT(*) FROM quizzes WHERE status <> 'archived'",
            'open_tickets' => "SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')",
            'pending_payments' => "SELECT COUNT(*) FROM payment_requests WHERE status = 'pending'",
        ];
        $stats = [];
        foreach ($queries as $key => $query) {
            $stats[$key] = (int) $pdo->query($query)->fetchColumn();
        }
        return $stats;
    }

    /** @return list<array<string, mixed>> */
    public function recentAudit(): array
    {
        return $this->database->connection()->query(
            'SELECT a.id, a.action, a.entity_type, a.entity_id, a.request_id, a.created_at,
                    u.email AS admin_email, p.display_name AS admin_name
             FROM admin_audit_logs a
             LEFT JOIN users u ON u.id = a.admin_user_id
             LEFT JOIN student_profiles p ON p.user_id = u.id
             ORDER BY a.created_at DESC LIMIT 20'
        )->fetchAll();
    }
}
