<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\JsonResponder;
use App\Profile\ProfileRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

final class ProfileController
{
    public function __construct(private readonly ProfileRepository $profiles, private readonly string $storageDirectory)
    {
    }

    public function show(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['profile' => $this->profiles->get($this->userId($request))]);
    }

    public function update(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $this->profiles->update($this->userId($request), $body);
        return $this->show($request, $response);
    }

    public function avatar(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $userId = $this->userId($request);
        $relativePath = $this->profiles->avatarPath($userId);
        $path = $relativePath === null ? null : $this->avatarFilePath($relativePath, $userId);
        if ($path === null || !is_file($path)) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_NOT_FOUND', 'No profile photo is set.', 404);
        }
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_UNAVAILABLE', 'The profile photo could not be read.', 500);
        }
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'][$extension] ?? 'application/octet-stream';
        $response->getBody()->write($bytes);
        return $response
            ->withHeader('Content-Type', $mime)
            ->withHeader('Content-Length', (string) strlen($bytes))
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Cache-Control', 'private, max-age=300, must-revalidate');
    }

    public function uploadAvatar(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $files = $request->getUploadedFiles();
        $file = $files['avatar'] ?? null;
        if (!$file instanceof UploadedFileInterface || $file->getError() !== UPLOAD_ERR_OK) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_UPLOAD_FAILED', 'Choose a profile photo and try again.', 422, ['avatar' => ['The photo upload did not complete.']]);
        }
        if (($file->getSize() ?? 0) > 5 * 1024 * 1024) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_TOO_LARGE', 'The profile photo must be smaller than 5 MB.', 422, ['avatar' => ['Choose an image smaller than 5 MB.']]);
        }

        $stream = $file->getStream();
        if ($stream->isSeekable()) {
            $stream->rewind();
        }
        $bytes = '';
        while (!$stream->eof()) {
            $bytes .= $stream->read(8192);
            if (strlen($bytes) > 5 * 1024 * 1024) {
                throw new \App\Domain\Exceptions\ApiException('AVATAR_TOO_LARGE', 'The profile photo must be smaller than 5 MB.', 422, ['avatar' => ['Choose an image smaller than 5 MB.']]);
            }
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($bytes);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
        $image = @getimagesizefromstring($bytes);
        if (!is_string($mime) || !isset($extensions[$mime]) || !is_array($image)
            || ($image['mime'] ?? null) !== $mime
            || ($image[0] ?? 0) < 1 || ($image[1] ?? 0) < 1
            || $image[0] > 4096 || $image[1] > 4096 || $image[0] * $image[1] > 16_000_000) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_INVALID', 'Upload a valid JPG, PNG, GIF, or WebP image.', 422, ['avatar' => ['The uploaded file is not a supported image.']]);
        }

        $directory = rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . 'avatars';
        if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_STORAGE_UNAVAILABLE', 'Profile photo storage is temporarily unavailable.', 500);
        }
        $userId = $this->userId($request);
        $filename = $userId . '-' . bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
        $relativePath = 'avatars/' . $filename;
        $path = $this->avatarFilePath($relativePath, $userId);
        if ($path === null || file_put_contents($path, $bytes, LOCK_EX) !== strlen($bytes)) {
            throw new \App\Domain\Exceptions\ApiException('AVATAR_STORAGE_UNAVAILABLE', 'The profile photo could not be saved.', 500);
        }
        @chmod($path, 0640);

        try {
            $oldPath = $this->profiles->updateAvatarPath($userId, $relativePath);
        } catch (\Throwable $error) {
            @unlink($path);
            throw $error;
        }
        if ($oldPath !== null) {
            $oldFile = $this->avatarFilePath($oldPath, $userId);
            if ($oldFile !== null && is_file($oldFile)) {
                @unlink($oldFile);
            }
        }
        return $this->show($request, $response);
    }

    public function removeAvatar(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $userId = $this->userId($request);
        $oldPath = $this->profiles->updateAvatarPath($userId, null);
        if ($oldPath !== null) {
            $oldFile = $this->avatarFilePath($oldPath, $userId);
            if ($oldFile !== null && is_file($oldFile)) {
                @unlink($oldFile);
            }
        }
        return $this->show($request, $response);
    }

    public function preferences(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $this->profiles->updatePreferences($this->userId($request), $body);
        return $this->show($request, $response);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if ($password === '') {
            throw new \App\Domain\Exceptions\ApiException('VALIDATION_FAILED', 'Your current password is required.', 422, ['password' => ['Enter your password.']]);
        }
        $userId = $this->userId($request);
        $avatarPath = $this->profiles->avatarPath($userId);
        $this->profiles->deleteAccount($userId, $password);
        if ($avatarPath !== null) {
            $avatarFile = $this->avatarFilePath($avatarPath, $userId);
            if ($avatarFile !== null && is_file($avatarFile)) {
                @unlink($avatarFile);
            }
        }
        return JsonResponder::success($response, ['deleted' => true]);
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }

    private function avatarFilePath(string $relativePath, int $userId): ?string
    {
        $pattern = '/^avatars\/' . preg_quote((string) $userId, '/') . '-[a-f0-9]{48}\.(?:jpg|png|gif|webp)$/';
        if (!preg_match($pattern, $relativePath)) {
            return null;
        }
        return rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR
            . 'avatars' . DIRECTORY_SEPARATOR . basename($relativePath);
    }
}
