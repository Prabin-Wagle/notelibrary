<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Admin\AdminDashboardRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AdminDashboardController
{
    public function __construct(private readonly AdminDashboardRepository $dashboard)
    {
    }

    public function show(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, [
            'stats' => $this->dashboard->stats(),
            'recent_activity' => $this->dashboard->recentAudit(),
        ]);
    }
}
