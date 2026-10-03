<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use App\Resources\ResourceRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ResourceController
{
    public function __construct(private readonly ResourceRepository $resources)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $result = $this->resources->search($request->getQueryParams());
        return JsonResponder::success($response, ['resources' => $result['items']], 200, [
            'pagination' => [
                'page' => $result['page'],
                'per_page' => $result['per_page'],
                'total' => $result['total'],
                'last_page' => max(1, (int) ceil($result['total'] / $result['per_page'])),
            ],
        ]);
    }

    /** @param array<string, string> $args */
    public function show(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $resource = $this->resources->findBySlug($args['slug']);
        if ($resource === null) {
            throw new ApiException('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
        }
        return JsonResponder::success($response, ['resource' => $resource]);
    }
}
