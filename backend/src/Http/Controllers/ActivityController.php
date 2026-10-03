<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Activity\ActivityRepository;
use App\Http\JsonResponder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class ActivityController
{
    public function __construct(private readonly ActivityRepository $activity)
    {
    }

    public function bookmarks(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['bookmarks' => $this->activity->bookmarks($this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function addBookmark(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->activity->addBookmark($this->userId($request), (int) $args['resourceId']);
        return JsonResponder::success($response, ['bookmarked' => true], 201);
    }

    /** @param array<string, string> $args */
    public function removeBookmark(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $this->activity->removeBookmark($this->userId($request), (int) $args['resourceId']);
        return $response->withStatus(204);
    }

    public function history(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        return JsonResponder::success($response, ['history' => $this->activity->history($this->userId($request))]);
    }

    /** @param array<string, string> $args */
    public function progress(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $lastPage = isset($body['last_page']) && is_numeric($body['last_page']) ? max(1, (int) $body['last_page']) : null;
        $progress = isset($body['progress_percent']) && is_numeric($body['progress_percent']) ? (float) $body['progress_percent'] : 0;
        $this->activity->recordProgress($this->userId($request), (int) $args['resourceId'], $lastPage, $progress);
        return JsonResponder::success($response, ['saved' => true]);
    }

    private function userId(ServerRequestInterface $request): int
    {
        return (int) ((array) $request->getAttribute('auth'))['user_id'];
    }
}
