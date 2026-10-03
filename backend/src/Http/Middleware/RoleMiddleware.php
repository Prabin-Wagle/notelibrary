<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RoleMiddleware
{
    /** @param list<string> $roles */
    public function __construct(private readonly array $roles)
    {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $auth = $request->getAttribute('auth');
        $role = is_array($auth) ? ($auth['role'] ?? null) : null;
        if (!is_string($role) || !in_array($role, $this->roles, true)) {
            throw new ApiException('ADMIN_ACCESS_REQUIRED', 'Administrator access is required.', 403);
        }
        return $handler->handle($request);
    }
}
