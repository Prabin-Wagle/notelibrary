<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminPortalRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminPortalController
{
    public function __construct(private readonly AdminPortalRepository $portal)
    {
    }

    /** @param array<string, string> $args */
    public function dispatch(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $auth = (array) $request->getAttribute('auth');
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $data = $this->portal->dispatch(
            (string) ($args['entity'] ?? ''),
            strtoupper($request->getMethod()),
            $request->getQueryParams(),
            $body,
            (int) ($auth['user_id'] ?? 0),
        );
        return JsonResponder::success($response, $data);
    }
}

