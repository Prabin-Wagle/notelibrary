<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Activity\StudyTargetRepository;
use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use DateTimeImmutable;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class StudyTargetController
{
    public function __construct(private readonly StudyTargetRepository $targets)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $query = $request->getQueryParams();
        $from = $this->date($query['from'] ?? null);
        $to = $this->date($query['to'] ?? null);
        if ($to < $from || (new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days > 42) {
            throw new ApiException('INVALID_DATE_RANGE', 'Choose a date range of no more than 43 days.', 422);
        }
        return JsonResponder::success($response, ['targets' => $this->targets->list($this->userId($request), $from, $to)]);
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $label = trim((string) ($body['label'] ?? ''));
        if ($label === '' || mb_strlen($label) > 180) {
            throw new ApiException('VALIDATION_FAILED', 'Enter a target up to 180 characters.', 422, ['label' => ['A target is required.']]);
        }
        $id = $this->targets->create($this->userId($request), $label, $this->date($body['target_date'] ?? null));
        return JsonResponder::success($response, ['id' => $id], 201);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $progress = filter_var($body['progress'] ?? null, FILTER_VALIDATE_INT);
        $label = isset($body['label']) && is_string($body['label']) ? trim($body['label']) : null;
        if (($progress === false && $label === null) || ($progress !== false && ($progress < 0 || $progress > 100)) || ($label !== null && ($label === '' || mb_strlen($label) > 180))) {
            throw new ApiException('VALIDATION_FAILED', 'Progress must be from 0 to 100.', 422);
        }
        $this->targets->update($this->userId($request), (int) $args['id'], $progress === false ? null : $progress, $label);
        return JsonResponder::success($response, ['updated' => true]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->targets->delete($this->userId($request), (int) $args['id']);
        return JsonResponder::success($response, ['deleted' => true]);
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }

    private function date(mixed $value): string
    {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new ApiException('VALIDATION_FAILED', 'A valid calendar date is required.', 422);
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new ApiException('VALIDATION_FAILED', 'A valid calendar date is required.', 422);
        }
        return $value;
    }
}
