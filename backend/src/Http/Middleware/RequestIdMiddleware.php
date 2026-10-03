<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Id;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RequestIdMiddleware
{
    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $requestId = Id::request();
        $response = $handler->handle($request->withAttribute('request_id', $requestId));
        return $response->withHeader('X-Request-Id', $requestId);
    }
}
