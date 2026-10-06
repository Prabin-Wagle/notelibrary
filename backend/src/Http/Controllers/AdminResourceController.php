<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminResourceRepository;
use App\Admin\AuditRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminResourceController
{
    public function __construct(private readonly AdminResourceRepository $resources, private readonly AuditRepository $audit)
    {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $result = $this->resources->search($request->getQueryParams());
        return JsonResponder::success($response, ['resources' => $result['items']], 200, [
            'pagination' => [
                'page' => $result['page'], 'per_page' => $result['per_page'], 'total' => $result['total'],
                'last_page' => max(1, (int) ceil($result['total'] / $result['per_page'])),
            ],
        ]);
    }

    public function types(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['types' => $this->resources->types()]);
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $adminId = $this->adminId($request);
        $id = $this->resources->create($this->body($request), $adminId);
        $this->record($request, 'resource.created', $id);
        return JsonResponder::success($response, ['id' => $id], 201);
    }

    /** @param array<string, string> $args */
    public function update(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int) $args['id'];
        $this->resources->update($id, $this->body($request));
        $this->record($request, 'resource.updated', $id);
        return JsonResponder::success($response, ['id' => $id]);
    }

    /** @param array<string, string> $args */
    public function archive(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $id = (int) $args['id'];
        $this->resources->archive($id);
        $this->record($request, 'resource.archived', $id);
        return $response->withStatus(204);
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

    private function record(ServerRequestInterface $request, string $action, int $id): void
    {
        $server = $request->getServerParams();
        $this->audit->record($this->adminId($request), $action, 'resource', $id,
            (string) ($server['REMOTE_ADDR'] ?? 'unknown'), (string) $request->getAttribute('request_id', ''));
    }
}
