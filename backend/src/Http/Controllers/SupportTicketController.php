<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use App\Support\SupportTicketRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class SupportTicketController
{
    public function __construct(private readonly SupportTicketRepository $tickets)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['tickets' => $this->tickets->listForStudent($this->userId($request))]);
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $subject = $this->required($body, 'subject', 3, 250);
        $message = $this->required($body, 'message', 5, 10000);
        $category = isset($body['category']) && is_string($body['category']) ? trim($body['category']) : 'general';
        if (!in_array($category, ['general', 'account', 'study_material', 'test_series', 'billing', 'technical'], true)) {
            $category = 'general';
        }
        return JsonResponder::success($response, ['ticket' => $this->tickets->create($this->userId($request), $subject, $message, $category)], 201);
    }

    /** @param array<string, string> $args */
    public function show(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, ['ticket' => $this->tickets->detail((int) $args['ticketId'], $this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function reply(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $this->tickets->reply((int) $args['ticketId'], $this->userId($request), $this->required($body, 'message', 1, 10000));
        return JsonResponder::success($response, ['ticket' => $this->tickets->detail((int) $args['ticketId'], $this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function close(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->tickets->close((int) $args['ticketId'], $this->userId($request));
        return JsonResponder::success($response, ['ticket' => $this->tickets->detail((int) $args['ticketId'], $this->userId($request))]);
    }

    /** @param array<string, mixed> $body */
    private function required(array $body, string $field, int $min, int $max): string
    {
        $value = isset($body[$field]) && is_string($body[$field]) ? trim($body[$field]) : '';
        $length = mb_strlen($value);
        if ($length < $min || $length > $max) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                $field => ["Must contain between {$min} and {$max} characters."],
            ]);
        }
        return $value;
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }
}
