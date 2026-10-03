<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Academic\AcademicRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class AcademicController
{
    public function __construct(private readonly AcademicRepository $academics)
    {
    }

    public function registrationOptions(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, $this->academics->registrationOptions());
    }

    public function programs(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['programs' => $this->academics->programs()]);
    }

    /** @param array<string, string> $args */
    public function levels(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $parent = $request->getQueryParams()['parent_id'] ?? null;
        return JsonResponder::success($response, ['levels' => $this->academics->levels(
            $args['programCode'],
            is_numeric($parent) ? (int) $parent : null,
        )]);
    }

    /** @param array<string, string> $args */
    public function subjects(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, ['subjects' => $this->academics->subjects((int) $args['levelId'])]);
    }

    /** @param array<string, string> $args */
    public function units(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        return JsonResponder::success($response, ['units' => $this->academics->units((int) $args['academicSubjectId'])]);
    }
}
