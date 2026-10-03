<?php

declare(strict_types=1);

namespace App\Http;

use Psr\Http\Message\ResponseInterface;

final class JsonResponder
{
    /** @param array<string, mixed>|list<mixed>|null $data */
    public static function success(ResponseInterface $response, array|null $data = null, int $status = 200, array $meta = []): ResponseInterface
    {
        return self::write($response, [
            'ok' => true,
            'data' => $data,
            'meta' => (object) $meta,
        ], $status);
    }

    /** @param array<string, list<string>> $fields */
    public static function error(ResponseInterface $response, string $code, string $message, int $status, array $fields = [], array $meta = []): ResponseInterface
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }

        return self::write($response, ['ok' => false, 'error' => $error, 'meta' => (object) $meta], $status);
    }

    /** @param array<string, mixed> $payload */
    private static function write(ResponseInterface $response, array $payload, int $status): ResponseInterface
    {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $response->getBody()->write($json);

        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withHeader('Cache-Control', 'no-store');
    }
}
