<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Exceptions\ApiException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RateLimitMiddleware
{
    public function __construct(
        private readonly string $cachePath,
        private readonly int $limit,
        private readonly int $windowSeconds,
    ) {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $server = $request->getServerParams();
        $ip = (string) ($server['REMOTE_ADDR'] ?? 'unknown');
        $key = hash('sha256', $ip . '|' . $request->getMethod() . '|' . $request->getUri()->getPath());
        $file = rtrim($this->cachePath, '/\\') . DIRECTORY_SEPARATOR . 'rate-' . $key . '.json';
        $now = time();
        $handle = fopen($file, 'c+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open the rate-limit store.');
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new \RuntimeException('Unable to lock the rate-limit store.');
            }
            $stored = stream_get_contents($handle);
            $bucket = is_string($stored) && $stored !== '' ? json_decode($stored, true) : null;
            if (!is_array($bucket) || (int) ($bucket['reset_at'] ?? 0) <= $now) {
                $bucket = ['count' => 0, 'reset_at' => $now + $this->windowSeconds];
            }
            $bucket['count'] = (int) $bucket['count'] + 1;
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($bucket, JSON_THROW_ON_ERROR));
            fflush($handle);
            flock($handle, LOCK_UN);
        } finally {
            fclose($handle);
        }

        if ($bucket['count'] > $this->limit) {
            throw new ApiException('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
        }

        return $handler->handle($request)
            ->withHeader('X-RateLimit-Limit', (string) $this->limit)
            ->withHeader('X-RateLimit-Remaining', (string) max(0, $this->limit - $bucket['count']))
            ->withHeader('X-RateLimit-Reset', (string) $bucket['reset_at']);
    }
}
