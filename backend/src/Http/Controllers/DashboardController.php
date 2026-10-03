<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Activity\DashboardRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class DashboardController
{
    public function __construct(private readonly DashboardRepository $dashboard)
    {
    }

    public function summary(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $userId = (int) ((array) $request->getAttribute('auth'))['user_id'];
        return JsonResponder::success($response, $this->dashboard->summary($userId));
    }
}
