<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use App\Profile\EnrollmentRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class EnrollmentController
{
    public function __construct(private readonly EnrollmentRepository $enrollments)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['enrollments' => $this->enrollments->allForUser($this->userId($request))]);
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        if (!isset($body['academic_level_id']) || !is_numeric($body['academic_level_id'])) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                'academic_level_id' => ['Select an academic level.'],
            ]);
        }
        $id = $this->enrollments->save(
            $this->userId($request),
            (int) $body['academic_level_id'],
            filter_var($body['is_primary'] ?? false, FILTER_VALIDATE_BOOL),
        );
        return JsonResponder::success($response, ['enrollment_id' => $id], 201);
    }

    /** @param array<string, string> $args */
    public function makePrimary(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->enrollments->makePrimary($this->userId($request), (int) $args['id']);
        return JsonResponder::success($response, ['primary' => true]);
    }

    /** @param array<string, string> $args */
    public function delete(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->enrollments->remove($this->userId($request), (int) $args['id']);
        return $response->withStatus(204);
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }
}
