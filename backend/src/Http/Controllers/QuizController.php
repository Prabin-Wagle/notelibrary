<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use App\Quiz\QuizRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class QuizController
{
    public function __construct(private readonly QuizRepository $quizzes)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['quizzes' => $this->quizzes->published($request->getQueryParams(), $this->userId($request))]);
    }

    public function collections(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['collections' => $this->quizzes->collections($this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function collection(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, ['collection' => $this->quizzes->collection((int) $args['collectionId'], $this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function show(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, ['quiz' => $this->quizzes->detail((int) $args['quizId'])]);
    }

    /** @param array<string, string> $args */
    public function start(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = $this->quizzes->startAttempt((int) $args['quizId'], $this->userId($request));
        return JsonResponder::success($response, ['attempt_id' => $id], 201);
    }

    /** @param array<string, string> $args */
    public function answer(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $optionId = isset($body['selected_option_id']) && is_numeric($body['selected_option_id'])
            ? (int) $body['selected_option_id']
            : null;
        $text = isset($body['text_answer']) && is_string($body['text_answer']) ? trim($body['text_answer']) : null;
        if ($optionId === null && ($text === null || $text === '')) {
            throw new ApiException('VALIDATION_FAILED', 'Select or enter an answer.', 422);
        }
        $this->quizzes->saveAnswer(
            (int) $args['attemptId'],
            (int) $args['questionId'],
            $this->userId($request),
            $optionId,
            $text,
        );
        return JsonResponder::success($response, ['saved' => true]);
    }

    /** @param array<string, string> $args */
    public function submit(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $attemptId = (int) $args['attemptId'];
        $userId = $this->userId($request);
        $this->quizzes->submit($attemptId, $userId);
        return JsonResponder::success($response, ['result' => $this->quizzes->result($attemptId, $userId)]);
    }

    /** @param array<string, string> $args */
    public function result(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, [
            'result' => $this->quizzes->result((int) $args['attemptId'], $this->userId($request)),
        ]);
    }

    /** @param array<string, string> $args */
    public function history(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, [
            'history' => $this->quizzes->history((int) $args['quizId'], $this->userId($request)),
        ]);
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }
}
