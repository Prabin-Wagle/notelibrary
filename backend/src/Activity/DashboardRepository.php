<?php

declare(strict_types=1);

namespace App\Activity;

use App\Infrastructure\Database\Database;

final class DashboardRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array<string, mixed> */
    public function summary(int $userId): array
    {
        $pdo = $this->database->connection();
        $scores = $pdo->prepare("SELECT score, maximum_score, DATE(DATE_ADD(submitted_at, INTERVAL 345 MINUTE)) AS activity_date FROM quiz_attempts WHERE user_id = :user AND status = 'submitted' ORDER BY submitted_at DESC");
        $scores->execute(['user' => $userId]);
        $attempts = $scores->fetchAll();
        $average = 0.0;
        $days = [];
        if ($attempts !== []) {
            $ratios = [];
            foreach ($attempts as $attempt) {
                $max = (float) ($attempt['maximum_score'] ?? 0);
                if ($max > 0) $ratios[] = max(0, (float) $attempt['score'] / $max * 100);
                $days[(string) $attempt['activity_date']] = true;
            }
            $average = $ratios === [] ? 0 : array_sum($ratios) / count($ratios);
        }
        $streak = 0;
        $cursor = new \DateTimeImmutable('today');
        if (!isset($days[$cursor->format('Y-m-d')])) $cursor = $cursor->modify('-1 day');
        while (isset($days[$cursor->format('Y-m-d')])) { $streak++; $cursor = $cursor->modify('-1 day'); }
        $today = $pdo->prepare('SELECT COUNT(*) FROM study_targets WHERE user_id = :user AND target_date = :today AND progress = 100');
        $today->execute(['user' => $userId, 'today' => (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Kathmandu')))->format('Y-m-d')]);
        $live = $pdo->prepare("SELECT id, title, starts_at AS start_time, ends_at AS end_time, delivery_mode AS mode FROM quizzes WHERE status = 'published' AND delivery_mode = 'live' AND starts_at IS NOT NULL AND ends_at >= UTC_TIMESTAMP() ORDER BY starts_at LIMIT 5");
        $live->execute();
        $percent = round($average, 1);
        return [
            'streak' => $streak,
            'completedTargets' => (int) $today->fetchColumn(),
            'activeQuizzes' => $live->fetchAll(),
            'totalQuizzes' => count($attempts),
            'avgScore' => $percent,
            'recentRank' => $percent >= 85 ? 'Scholar' : ($percent >= 65 ? 'Aspirant' : null),
        ];
    }
}
