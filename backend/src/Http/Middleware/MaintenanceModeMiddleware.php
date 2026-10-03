<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class MaintenanceModeMiddleware
{
    public function __construct(private readonly Database $database)
    {
    }

    public function __invoke(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $stored = $this->database->connection()->query("SELECT setting_value FROM admin_settings WHERE setting_key='content'")->fetchColumn();
        $settings = is_string($stored) ? json_decode($stored, true) : null;
        if (is_array($settings) && ($settings['maintenance_mode'] ?? false) === true) {
            throw new ApiException('SERVICE_MAINTENANCE', 'Student services are temporarily unavailable for scheduled maintenance.', 503);
        }
        return $handler->handle($request);
    }
}
