<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminOperationsRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminOperationsController
{
    public function __construct(private readonly AdminOperationsRepository $operations)
    {
    }

    public function promoCodes(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        if (strtoupper($request->getMethod()) === 'GET') {
            return JsonResponder::success($response, ['promocodes' => $this->operations->promoCodes()]);
        }
        return JsonResponder::success($response, ['message' => $this->operations->promoAction($this->body($request), $this->adminId($request))]);
    }

    public function payments(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['data' => $this->operations->payments((string) ($request->getQueryParams()['status'] ?? 'all'))]);
    }

    public function paymentAction(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['message' => $this->operations->paymentAction($this->body($request), $this->adminId($request))]);
    }

    public function tickets(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['tickets' => $this->operations->tickets()]);
    }

    public function ticketDetails(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['replies' => $this->operations->ticketReplies((int) ($request->getQueryParams()['ticket_id'] ?? 0))]);
    }

    public function reply(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['message' => $this->operations->reply($this->body($request), $this->adminId($request))]);
    }

    /** @return array<string, mixed> */
    private function body(ServerRequestInterface $request): array
    {
        return is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
    }

    private function adminId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }
}

