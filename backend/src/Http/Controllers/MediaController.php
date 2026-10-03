<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class MediaController
{
    public function __construct(private readonly Database $database, private readonly string $storageDirectory)
    {
    }

    /** Serve a public resource asset created by the admin API. */
    public function serve(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $name = basename((string) ($args['filename'] ?? ''));
        $statement = $this->database->connection()->prepare(
            'SELECT file_name, mime_type FROM admin_media_assets WHERE file_name = :name'
        );
        $statement->execute(['name' => $name]);
        $asset = $statement->fetch();
        $path = rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . $name;
        if (!is_array($asset) || !is_file($path)) {
            throw new ApiException('MEDIA_NOT_FOUND', 'Media file not found.', 404);
        }
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new ApiException('MEDIA_UNAVAILABLE', 'Media file could not be read.', 500);
        }
        try {
            $response->getBody()->write(stream_get_contents($stream) ?: '');
        } finally {
            fclose($stream);
        }
        return $response->withHeader('Content-Type', (string) $asset['mime_type'])
            ->withHeader('Content-Disposition', 'inline; filename="' . $name . '"')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}
