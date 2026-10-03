<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

final class CorsMiddleware
{
    /** @param list<string> $allowedOrigins */
    public function __construct(private readonly array $allowedOrigins)
    {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        if ($origin !== '' && !in_array($origin, $this->allowedOrigins, true)) {
            throw new ApiException('ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.', 403);
        }

        $response = $request->getMethod() === 'OPTIONS' ? new Response(204) : $handler->handle($request);
        if ($origin !== '') {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->withHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With')
                ->withHeader('Access-Control-Max-Age', '600')
                ->withAddedHeader('Vary', 'Origin');
        }

        return $response;
    }
}
