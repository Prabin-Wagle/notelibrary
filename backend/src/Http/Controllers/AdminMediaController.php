<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Response;

final class AdminMediaController
{
    private const MIME_EXTENSIONS = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
    ];

    private readonly string $storagePath;

    public function __construct(
        private readonly Database $database,
        private readonly string $basePath,
        ?string $storagePath = null,
    ) {
        $this->storagePath = $storagePath ?? $basePath . '/storage/uploads';
    }

    public function upload(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $settings = $this->database->connection()->query("SELECT setting_value FROM admin_settings WHERE setting_key='uploads'")->fetchColumn();
        $uploadSettings = is_string($settings) ? json_decode($settings, true) : null;
        $maxMb = is_array($uploadSettings) ? max(1, min(100, (int) ($uploadSettings['max_file_size_mb'] ?? 25))) : 25;
        $allowed = is_array($uploadSettings) && is_array($uploadSettings['allowed_types'] ?? null)
            ? $uploadSettings['allowed_types']
            : ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'];
        $files = $request->getUploadedFiles();
        $file = $files['resource'] ?? $files['image'] ?? $files['file'] ?? null;
        if ($file === null || $file->getError() !== UPLOAD_ERR_OK) {
            throw new ApiException('UPLOAD_FAILED', 'Choose a file to upload.', 422);
        }
        if ($file->getSize() === null || $file->getSize() < 1 || $file->getSize() > $maxMb * 1024 * 1024) {
            throw new ApiException('UPLOAD_TOO_LARGE', "Files must be between 1 byte and {$maxMb} MB.", 413);
        }
        $temporary = $file->getStream()->getMetadata('uri');
        $mime = is_string($temporary) ? (new \finfo(FILEINFO_MIME_TYPE))->file($temporary) : false;
        $extension = is_string($mime) ? (self::MIME_EXTENSIONS[$mime] ?? null) : null;
        if (!is_string($mime) || $extension === null || !in_array($extension, $allowed, true)) {
            throw new ApiException('UPLOAD_TYPE_UNSUPPORTED', 'This file type is not enabled in workspace upload settings.', 415);
        }
        $name = bin2hex(random_bytes(20)) . '.' . $extension;
        $directory = $this->storageDirectory();
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new ApiException('UPLOAD_STORAGE_UNAVAILABLE', 'Upload storage is unavailable.', 500);
        }
        $file->moveTo($directory . '/' . $name);
        $auth = (array) $request->getAttribute('auth');
        $this->database->connection()->prepare(
            'INSERT INTO admin_media_assets (file_name,original_name,mime_type,file_size,created_by,created_at)
             VALUES (:name,:original,:mime,:size,:admin,UTC_TIMESTAMP())'
        )->execute([
            'name' => $name,
            'original' => mb_substr(basename($file->getClientFilename() ?: 'upload'), 0, 255),
            'mime' => $mime,
            'size' => $file->getSize(),
            'admin' => (int) ($auth['user_id'] ?? 0),
        ]);
        return $this->json($response, ['success' => true, 'name' => $name, 'original_name' => $file->getClientFilename(), 'url' => '/api/v1/media/' . $name]);
    }

    public function delete(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $name = basename((string) ($body['filename'] ?? ''));
        if ($name === '') throw new ApiException('MEDIA_NOT_FOUND', 'Select a stored media file.', 422);
        $pdo = $this->database->connection();
        $stmt = $pdo->prepare('SELECT file_name FROM admin_media_assets WHERE file_name=:name');
        $stmt->execute(['name' => $name]);
        $stored = $stmt->fetchColumn();
        if (!is_string($stored)) throw new ApiException('MEDIA_NOT_FOUND', 'Media file not found.', 404);
        $pdo->prepare('DELETE FROM admin_media_assets WHERE file_name=:name')->execute(['name' => $name]);
        $path = $this->storageDirectory() . DIRECTORY_SEPARATOR . $stored;
        if (is_file($path)) unlink($path);
        return $this->json($response, ['success' => true, 'message' => 'Asset deleted.']);
    }

    public function serve(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $name = basename((string) ($args['filename'] ?? ''));
        $stmt = $this->database->connection()->prepare('SELECT file_name,mime_type FROM admin_media_assets WHERE file_name=:name');
        $stmt->execute(['name' => $name]);
        $asset = $stmt->fetch();
        $path = $this->storageDirectory() . DIRECTORY_SEPARATOR . $name;
        if (!is_array($asset) || !is_file($path)) throw new ApiException('MEDIA_NOT_FOUND', 'Media file not found.', 404);
        $stream = fopen($path, 'rb');
        if ($stream === false) throw new ApiException('MEDIA_UNAVAILABLE', 'Media file could not be read.', 500);
        try { $response->getBody()->write(stream_get_contents($stream) ?: ''); } finally { fclose($stream); }
        return $response->withHeader('Content-Type', (string) $asset['mime_type'])
            ->withHeader('Content-Disposition', 'inline; filename="' . $name . '"')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    /** @param array<string, mixed> $data */
    private function json(ResponseInterface $response, array $data): ResponseInterface
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        return $response->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    private function storageDirectory(): string
    {
        return $this->storagePath;
    }
}
