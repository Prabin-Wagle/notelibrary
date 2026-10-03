<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminCatalogRepository;
use App\Admin\AuditRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminCatalogController
{
    public function __construct(private readonly AdminCatalogRepository $catalog, private readonly AuditRepository $audit)
    {
    }

    public function programs(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['programs' => $this->catalog->programs()]);
    }

    public function createProgram(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->created($request, $response, 'program', $this->catalog->createProgram($this->body($request)));
    }

    public function levels(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $query = $request->getQueryParams();
        return JsonResponder::success($response, ['levels' => $this->catalog->levels(
            isset($query['program_id']) && is_numeric($query['program_id']) ? (int) $query['program_id'] : null,
            isset($query['parent_id']) && is_numeric($query['parent_id']) ? (int) $query['parent_id'] : null,
        )]);
    }

    public function createLevel(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->created($request, $response, 'level', $this->catalog->createLevel($this->body($request)));
    }

    public function subjects(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['subjects' => $this->catalog->subjects()]);
    }

    public function createSubject(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->created($request, $response, 'subject', $this->catalog->createSubject($this->body($request)));
    }

    public function offerings(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $value = $request->getQueryParams()['academic_level_id'] ?? null;
        return JsonResponder::success($response, ['offerings' => $this->catalog->offerings(is_numeric($value) ? (int) $value : null)]);
    }

    public function createOffering(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->created($request, $response, 'offering', $this->catalog->createOffering($this->body($request)));
    }

    public function units(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $value = $request->getQueryParams()['academic_subject_id'] ?? null;
        return JsonResponder::success($response, ['units' => $this->catalog->units(is_numeric($value) ? (int) $value : null)]);
    }

    public function createUnit(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return $this->created($request, $response, 'unit', $this->catalog->createUnit($this->body($request)));
    }

    /** @param array<string, string> $args */
    public function active(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = $this->body($request);
        $active = filter_var($body['is_active'] ?? false, FILTER_VALIDATE_BOOL);
        $this->catalog->setActive($args['entity'], (int) $args['id'], $active);
        $this->record($request, 'catalog.active_changed', $args['entity'], (int) $args['id'], ['is_active' => $active]);
        return JsonResponder::success($response, ['is_active' => $active]);
    }

    private function created(ServerRequestInterface $request, ResponseInterface $response, string $entity, int $id): ResponseInterface
    {
        $this->record($request, 'catalog.created', $entity, $id);
        return JsonResponder::success($response, ['id' => $id], 201);
    }

    /** @return array<string, mixed> */
    private function body(ServerRequestInterface $request): array
    {
        return is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
    }

    /** @param array<string, mixed> $metadata */
    private function record(ServerRequestInterface $request, string $action, string $type, int $id, array $metadata = []): void
    {
        $auth = (array) $request->getAttribute('auth');
        $server = $request->getServerParams();
        $this->audit->record((int) $auth['user_id'], $action, $type, $id,
            (string) ($server['REMOTE_ADDR'] ?? 'unknown'), (string) $request->getAttribute('request_id', ''), $metadata);
    }
}
