<?php

declare(strict_types=1);

namespace App\Quiz;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use PDO;

final class QuizRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @param array<string, mixed> $filters @return list<array<string, mixed>> */
    public function published(array $filters, int $userId): array
    {
        $where = ["q.status = 'published'", 'q.published_at <= UTC_TIMESTAMP()'];
        $params = [];
        if (isset($filters['academic_subject_id']) && is_numeric($filters['academic_subject_id'])) {
            $where[] = 'q.academic_subject_id = :subject_id';
            $params['subject_id'] = (int) $filters['academic_subject_id'];
        }
        if (isset($filters['collection_id']) && is_numeric($filters['collection_id'])) {
            $where[] = 'q.collection_id = :collection_id';
            $params['collection_id'] = (int) $filters['collection_id'];
        }
        $statement = $this->database->connection()->prepare(
            'SELECT q.id, q.collection_id, q.title, q.slug, q.description, q.duration_seconds, q.total_marks,
                    q.pass_marks, q.negative_marking, q.delivery_mode, q.starts_at, q.ends_at,
                    q.published_at, COUNT(qq.id) AS question_count,
                    (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = :user_id AND qa.status = \'submitted\') AS attempt_count,
                    (SELECT qa.id FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = :user_id_latest AND qa.status = \'submitted\' ORDER BY qa.submitted_at DESC, qa.id DESC LIMIT 1) AS latest_attempt_id
             FROM quizzes q
             LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
             WHERE ' . implode(' AND ', $where) . '
             GROUP BY q.id
             ORDER BY q.published_at DESC, q.id DESC
             LIMIT 100'
        );
        $statement->execute(['user_id' => $userId, 'user_id_latest' => $userId] + $params);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed> */
    public function detail(int $quizId): array
    {
        $quiz = $this->publishedQuiz($quizId);
        $questions = $this->database->connection()->prepare(
            'SELECT id, question_type, question_text, image_url, marks, negative_marks, sort_order
             FROM quiz_questions WHERE quiz_id = :quiz_id ORDER BY sort_order, id'
        );
        $questions->execute(['quiz_id' => $quizId]);
        $quiz['questions'] = $questions->fetchAll();

        $options = $this->database->connection()->prepare(
            'SELECT id, option_text, sort_order FROM question_options
             WHERE question_id = :question_id ORDER BY sort_order, id'
        );
        foreach ($quiz['questions'] as &$question) {
            $options->execute(['question_id' => $question['id']]);
            $question['options'] = $options->fetchAll();
        }
        unset($question);
        return $quiz;
    }

    public function startAttempt(int $quizId, int $userId): int
    {
        $quiz = $this->publishedQuiz($quizId);
        $this->assertCollectionAccess($quiz, $userId);
        $statement = $this->database->connection()->prepare(
            "INSERT INTO quiz_attempts (quiz_id, user_id, status, started_at)
             VALUES (:quiz_id, :user_id, 'in_progress', UTC_TIMESTAMP())"
        );
        $statement->execute(['quiz_id' => $quizId, 'user_id' => $userId]);
        return (int) $this->database->connection()->lastInsertId();
    }

    /** @return list<array<string, mixed>> */
    public function collections(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT c.id, c.title, c.description, c.price, c.discount_price, c.image_url, c.competitive_exam,
                    COUNT(DISTINCT q.id) AS test_count,
                    (COALESCE(c.discount_price, c.price) = 0 OR EXISTS (
                        SELECT 1 FROM payment_requests p WHERE p.collection_id = c.id AND p.user_id = :user_id AND p.status = 'approved'
                    )) AS has_access
             FROM quiz_collections c
             LEFT JOIN quizzes q ON q.collection_id = c.id AND q.status = 'published' AND q.published_at <= UTC_TIMESTAMP()
             WHERE c.is_active = 1
             GROUP BY c.id ORDER BY c.created_at DESC, c.id DESC"
        );
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed> */
    public function collection(int $collectionId, int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT c.id, c.title, c.description, c.price, c.discount_price, c.image_url, c.competitive_exam,
                    (COALESCE(c.discount_price, c.price) = 0 OR EXISTS (
                        SELECT 1 FROM payment_requests p WHERE p.collection_id = c.id AND p.user_id = :user_id AND p.status = 'approved'
                    )) AS has_access,
                    EXISTS (SELECT 1 FROM payment_requests pending WHERE pending.collection_id = c.id AND pending.user_id = :pending_user_id AND pending.status = 'pending') AS has_pending_payment
             FROM quiz_collections c WHERE c.id = :collection_id AND c.is_active = 1"
        );
        $statement->execute(['user_id' => $userId, 'pending_user_id' => $userId, 'collection_id' => $collectionId]);
        $collection = $statement->fetch();
        if ($collection === false) {
            throw new ApiException('COLLECTION_NOT_FOUND', 'Test collection not found.', 404);
        }
        $collection['quizzes'] = $this->published(['collection_id' => $collectionId], $userId);
        return $collection;
    }

    public function saveAnswer(int $attemptId, int $questionId, int $userId, ?int $optionId, ?string $text): void
    {
        $pdo = $this->database->connection();
        $check = $pdo->prepare(
            "SELECT qa.id FROM quiz_attempts qa
             INNER JOIN quiz_questions qq ON qq.quiz_id = qa.quiz_id AND qq.id = :question_id
             WHERE qa.id = :attempt_id AND qa.user_id = :user_id AND qa.status = 'in_progress'"
        );
        $check->execute(['question_id' => $questionId, 'attempt_id' => $attemptId, 'user_id' => $userId]);
        if ($check->fetchColumn() === false) {
            throw new ApiException('ATTEMPT_NOT_EDITABLE', 'This quiz attempt cannot be edited.', 409);
        }

        if ($optionId !== null) {
            $option = $pdo->prepare('SELECT 1 FROM question_options WHERE id = :option_id AND question_id = :question_id');
            $option->execute(['option_id' => $optionId, 'question_id' => $questionId]);
            if ($option->fetchColumn() === false) {
                throw new ApiException('OPTION_NOT_FOUND', 'That answer option does not belong to the question.', 422);
            }
        }

        $statement = $pdo->prepare(
            'INSERT INTO attempt_answers
                (attempt_id, question_id, selected_option_id, text_answer, answered_at)
             VALUES (:attempt_id, :question_id, :option_id, :text_answer, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id),
                 text_answer = VALUES(text_answer), is_correct = NULL, marks_awarded = NULL,
                 answered_at = UTC_TIMESTAMP()'
        );
        $statement->execute([
            'attempt_id' => $attemptId,
            'question_id' => $questionId,
            'option_id' => $optionId,
            'text_answer' => $text,
        ]);
    }

    public function submit(int $attemptId, int $userId): void
    {
        $this->database->transaction(function (PDO $pdo) use ($attemptId, $userId): void {
            $attempt = $pdo->prepare(
                'SELECT qa.id, qa.quiz_id, qa.status
                 FROM quiz_attempts qa WHERE qa.id = :id AND qa.user_id = :user_id FOR UPDATE'
            );
            $attempt->execute(['id' => $attemptId, 'user_id' => $userId]);
            $row = $attempt->fetch();
            if ($row === false) {
                throw new ApiException('ATTEMPT_NOT_FOUND', 'Quiz attempt not found.', 404);
            }
            if ($row['status'] !== 'in_progress') {
                throw new ApiException('ATTEMPT_ALREADY_SUBMITTED', 'This quiz attempt has already been submitted.', 409);
            }

            $questions = $pdo->prepare(
                'SELECT q.id, q.marks, q.negative_marks, a.id AS answer_id,
                        o.is_correct
                 FROM quiz_questions q
                 LEFT JOIN attempt_answers a ON a.question_id = q.id AND a.attempt_id = :attempt_id
                 LEFT JOIN question_options o ON o.id = a.selected_option_id
                 WHERE q.quiz_id = :quiz_id'
            );
            $questions->execute(['attempt_id' => $attemptId, 'quiz_id' => $row['quiz_id']]);
            $score = 0.0;
            $maximum = 0.0;
            $grade = $pdo->prepare(
                'UPDATE attempt_answers SET is_correct = :is_correct, marks_awarded = :marks WHERE id = :id'
            );
            foreach ($questions->fetchAll() as $question) {
                $marks = (float) $question['marks'];
                $maximum += $marks;
                if ($question['answer_id'] === null) {
                    continue;
                }
                $correct = (int) $question['is_correct'] === 1;
                $awarded = $correct ? $marks : -(float) $question['negative_marks'];
                $score += $awarded;
                $grade->execute([
                    'is_correct' => $correct ? 1 : 0,
                    'marks' => $awarded,
                    'id' => $question['answer_id'],
                ]);
            }

            $finish = $pdo->prepare(
                "UPDATE quiz_attempts
                 SET status = 'submitted', submitted_at = UTC_TIMESTAMP(), score = :score,
                     maximum_score = :maximum_score,
                     duration_seconds = TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP())
                 WHERE id = :id"
            );
            $finish->execute(['score' => $score, 'maximum_score' => $maximum, 'id' => $attemptId]);
        });
    }

    /** @return array<string, mixed> */
    public function result(int $attemptId, int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT a.id, a.quiz_id, a.status, a.started_at, a.submitted_at, a.score,
                    a.maximum_score, a.duration_seconds, q.title, q.pass_marks
             FROM quiz_attempts a INNER JOIN quizzes q ON q.id = a.quiz_id
             WHERE a.id = :id AND a.user_id = :user_id AND a.status = 'submitted'"
        );
        $statement->execute(['id' => $attemptId, 'user_id' => $userId]);
        $result = $statement->fetch();
        if ($result === false) {
            throw new ApiException('RESULT_NOT_FOUND', 'Submitted quiz result not found.', 404);
        }

        $answers = $this->database->connection()->prepare(
            'SELECT q.id AS question_id, q.question_text, q.explanation, q.marks, q.negative_marks,
                    a.selected_option_id, a.text_answer, a.is_correct, a.marks_awarded,
                    selected_option.option_text AS selected_option_text,
                    correct_option.id AS correct_option_id, correct_option.option_text AS correct_option_text
             FROM quiz_questions q
             LEFT JOIN attempt_answers a ON a.question_id = q.id AND a.attempt_id = :attempt_id
             LEFT JOIN question_options selected_option ON selected_option.id = a.selected_option_id
             LEFT JOIN question_options correct_option ON correct_option.question_id = q.id AND correct_option.is_correct = 1
             WHERE q.quiz_id = :quiz_id
             ORDER BY q.sort_order, q.id'
        );
        $answers->execute(['attempt_id' => $attemptId, 'quiz_id' => $result['quiz_id']]);
        $result['answers'] = $answers->fetchAll();
        return $result;
    }

    /** @return array<string, mixed> */
    public function history(int $quizId, int $userId): array
    {
        $quiz = $this->publishedQuiz($quizId);
        $statement = $this->database->connection()->prepare(
            "SELECT a.id, a.score, a.maximum_score, a.duration_seconds, a.submitted_at,
                    COUNT(q.id) AS total_questions,
                    SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
                    SUM(CASE WHEN aa.id IS NOT NULL AND aa.is_correct = 0 THEN 1 ELSE 0 END) AS incorrect_count
             FROM quiz_attempts a
             LEFT JOIN quiz_questions q ON q.quiz_id = a.quiz_id
             LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id AND aa.question_id = q.id
             WHERE a.quiz_id = :quiz_id AND a.user_id = :user_id AND a.status = 'submitted'
             GROUP BY a.id ORDER BY a.submitted_at DESC, a.id DESC"
        );
        $statement->execute(['quiz_id' => $quizId, 'user_id' => $userId]);
        $attempts = $statement->fetchAll();
        foreach ($attempts as $index => &$attempt) {
            $attempt['attempt_number'] = count($attempts) - $index;
            $attempt['attempt_date'] = $attempt['submitted_at'];
            foreach (['id', 'duration_seconds', 'total_questions', 'correct_count', 'incorrect_count', 'attempt_number'] as $field) {
                $attempt[$field] = (int) ($attempt[$field] ?? 0);
            }
            foreach (['score', 'maximum_score'] as $field) {
                $attempt[$field] = (float) ($attempt[$field] ?? 0);
            }
        }
        unset($attempt);
        return [
            'quiz' => ['id' => $quiz['id'], 'title' => $quiz['title']],
            'high_score' => $attempts === [] ? 0 : max(array_map(static fn (array $attempt): float => (float) $attempt['score'], $attempts)),
            'attempts' => $attempts,
        ];
    }

    /** @return array<string, mixed> */
    private function publishedQuiz(int $quizId): array
    {
        $statement = $this->database->connection()->prepare(
            "SELECT id, collection_id, academic_subject_id, title, slug, description, duration_seconds,
                    total_marks, pass_marks, published_at
             FROM quizzes WHERE id = :id AND status = 'published' AND published_at <= UTC_TIMESTAMP()"
        );
        $statement->execute(['id' => $quizId]);
        $quiz = $statement->fetch();
        if ($quiz === false) {
            throw new ApiException('QUIZ_NOT_FOUND', 'Quiz not found.', 404);
        }
        return $quiz;
    }

    /** @param array<string, mixed> $quiz */
    private function assertCollectionAccess(array $quiz, int $userId): void
    {
        if (empty($quiz['collection_id'])) {
            return;
        }
        $statement = $this->database->connection()->prepare(
            "SELECT COALESCE(c.discount_price, c.price) = 0 OR EXISTS (
                SELECT 1 FROM payment_requests p WHERE p.collection_id = c.id AND p.user_id = :user_id AND p.status = 'approved'
             ) AS has_access FROM quiz_collections c WHERE c.id = :collection_id AND c.is_active = 1"
        );
        $statement->execute(['user_id' => $userId, 'collection_id' => $quiz['collection_id']]);
        if ((int) $statement->fetchColumn() !== 1) {
            throw new ApiException('COLLECTION_ACCESS_REQUIRED', 'Get access to this collection before starting the test.', 403);
        }
    }
}
