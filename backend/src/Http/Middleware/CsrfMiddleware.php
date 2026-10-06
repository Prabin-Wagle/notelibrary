<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Auth\CsrfService;
use App\Domain\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class CsrfMiddleware
{
    /** @param list<string> $allowedOrigins */
    public function __construct(
        private readonly CsrfService $csrf,
        private readonly array $allowedOrigins,
        private readonly string $cookieName = CsrfService::COOKIE,
    )
    {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (in_array($request->getMethod(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $origin = $request->getHeaderLine('Origin');
            if ($origin === '' || !in_array($origin, $this->allowedOrigins, true)) {
                throw new ApiException('CSRF_ORIGIN_INVALID', 'The request origin could not be verified.', 403);
            }
            $cookies = $request->getCookieParams();
            $this->csrf->assertValid($cookies[$this->cookieName] ?? null, $request->getHeaderLine('X-CSRF-Token') ?: null);
        }

        return $handler->handle($request);
    }
}
