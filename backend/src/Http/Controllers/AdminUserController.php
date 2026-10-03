<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminUserRepository;
use App\Admin\AuditRepository;
use App\Auth\SessionRepository;
use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminUserController
{
    public function __construct(
        private readonly AdminUserRepository $users,
        private readonly SessionRepository $sessions,
        private readonly AuditRepository $audit,
        private readonly string $storageDirectory,
    ) {
    }

    public function index(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $result = $this->users->search($request->getQueryParams());
        return JsonResponder::success($response, ['users' => $result['items'], 'counts' => $this->users->counts()], 200, [
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
        return JsonResponder::success($response, $this->users->details((int) $args['id']));
    }

    /** @param array<string, string> $args */
    public function status(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $status = isset($body['status']) && is_string($body['status']) ? $body['status'] : '';
        $reason = isset($body['reason']) && is_string($body['reason']) ? $body['reason'] : null;
        $suspendedUntil = isset($body['suspended_until']) && is_string($body['suspended_until']) ? $body['suspended_until'] : null;
        $userId = (int) $args['id'];
        $auth = (array) $request->getAttribute('auth');
        $this->users->setStatus($userId, $status, isset($auth['user_id']) ? (int) $auth['user_id'] : null, $reason, $suspendedUntil);
        if ($status !== 'active') {
            $this->sessions->revokeAllForUser($userId);
        }
        $this->record($request, 'user.status_changed', 'user', $userId, ['status' => $status, 'reason' => $reason]);
        return JsonResponder::success($response, ['status' => $status, 'suspended_until' => $suspendedUntil]);
    }

    /** @param array<string, string> $args */
    public function delete(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $userId = (int) $args['id'];
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $reason = isset($body['reason']) && is_string($body['reason']) ? $body['reason'] : null;
        $auth = (array) $request->getAttribute('auth');
        $avatarPath = $this->users->avatarPath($userId);
        $this->users->softDelete($userId, isset($auth['user_id']) ? (int) $auth['user_id'] : null, $reason);
        $this->removeAvatar($userId, $avatarPath);
        $this->sessions->revokeAllForUser($userId);
        $this->record($request, 'user.deleted', 'user', $userId, ['reason' => $reason]);
        return $response->withStatus(204);
    }

    /** @param array<string, string> $args */
    public function avatar(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $userId = (int) $args['id'];
        $relativePath = $this->users->avatarPath($userId);
        $pattern = '/^avatars\/' . preg_quote((string) $userId, '/') . '-[a-f0-9]{48}\.(?:jpg|png|gif|webp)$/';
        if (!is_string($relativePath) || !preg_match($pattern, $relativePath)) {
            throw new ApiException('AVATAR_NOT_FOUND', 'This student has not added a profile photo.', 404);
        }
        $root = realpath($this->storageDirectory);
        $path = realpath(rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));
        if ($root === false || $path === false || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path)) {
            throw new ApiException('AVATAR_NOT_FOUND', 'This student has not added a profile photo.', 404);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
            throw new ApiException('AVATAR_INVALID', 'The stored profile photo is not a supported image.', 415);
        }
        $stream = fopen($path, 'rb');
        if ($stream === false) throw new ApiException('AVATAR_UNAVAILABLE', 'The profile photo could not be read.', 500);
        try { $response->getBody()->write(stream_get_contents($stream) ?: ''); } finally { fclose($stream); }
        return $response->withHeader('Content-Type', $mime)
            ->withHeader('Content-Disposition', 'inline; filename="student-' . $userId . '.image"')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Cache-Control', 'private, no-store');
    }

    private function removeAvatar(int $userId, ?string $relativePath): void
    {
        $pattern = '/^avatars\/' . preg_quote((string) $userId, '/') . '-[a-f0-9]{48}\.(?:jpg|png|gif|webp)$/';
        if (!is_string($relativePath) || !preg_match($pattern, $relativePath)) return;
        $root = realpath($this->storageDirectory);
        $path = realpath(rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));
        if ($root !== false && $path !== false && str_starts_with($path, $root . DIRECTORY_SEPARATOR) && is_file($path)) {
            @unlink($path);
        }
    }

    /** @param array<string, mixed> $metadata */
    private function record(ServerRequestInterface $request, string $action, string $type, int $id, array $metadata = []): void
    {
        $auth = (array) $request->getAttribute('auth');
        $server = $request->getServerParams();
        $this->audit->record(
            (int) $auth['user_id'],
            $action,
            $type,
            $id,
            (string) ($server['REMOTE_ADDR'] ?? 'unknown'),
            (string) $request->getAttribute('request_id', ''),
            $metadata,
        );
    }

}
