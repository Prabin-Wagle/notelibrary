<?php

declare(strict_types=1);

namespace App\Bootstrap;

use App\Academic\AcademicRepository;
use App\Activity\ActivityRepository;
use App\Auth\AuthService;
use App\Auth\ChallengeRepository;
use App\Auth\CsrfService;
use App\Auth\SessionRepository;
use App\Auth\UserRepository;
use App\Config\Config;
use App\Domain\Exceptions\ApiException;
use App\Http\Controllers\AcademicController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EnrollmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\SupportTicketController;
use App\Http\Controllers\StudyTargetController;
use App\Activity\StudyTargetRepository;
use App\Payments\PaymentRequestRepository;
use App\Http\Controllers\PaymentRequestController;
use App\Http\Controllers\DashboardController;
use App\Activity\DashboardRepository;
use App\Http\JsonResponder;
use App\Http\Middleware\AuthenticationMiddleware;
use App\Http\Middleware\CorsMiddleware;
use App\Http\Middleware\CsrfMiddleware;
use App\Http\Middleware\RequestIdMiddleware;
use App\Http\Middleware\RateLimitMiddleware;
use App\Http\Middleware\SecurityHeadersMiddleware;
use App\Http\Middleware\MaintenanceModeMiddleware;
use App\Infrastructure\Database\Database;
use App\Profile\ProfileRepository;
use App\Profile\EnrollmentRepository;
use App\Quiz\QuizRepository;
use App\Resources\ResourceRepository;
use App\Support\SupportTicketRepository;
use Dotenv\Dotenv;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Factory\AppFactory;
use Slim\Exception\HttpException;
use Slim\Interfaces\RouteCollectorProxyInterface;
use Slim\Psr7\Response;

final class ApplicationFactory
{
    public static function create(string $basePath): \Slim\App
    {
        if (is_file($basePath . '/.env')) {
            Dotenv::createImmutable($basePath)->safeLoad();
        }

        $config = Config::load($basePath);
        date_default_timezone_set((string) $config['app']['timezone']);

        $logger = new Logger('student-api');
        $logger->pushHandler(new StreamHandler(
            $basePath . '/storage/logs/app.log',
            Level::fromName((string) $config['log_level']),
        ));

        $database = new Database($config['database']);
        $users = new UserRepository($database);
        $sessions = new SessionRepository($database);
        $challenges = new ChallengeRepository($database);
        $csrf = new CsrfService((string) $config['app']['key']);
        $authService = new AuthService($users, $sessions, $challenges, $config);

        $authController = new AuthController($authService, $sessions, $csrf, $config);
        $profileController = new ProfileController(new ProfileRepository($database), (string) $config['media']['directory']);
        $enrollmentController = new EnrollmentController(new EnrollmentRepository($database));
        $academicController = new AcademicController(new AcademicRepository($database));
        $resourceController = new ResourceController(new ResourceRepository($database));
        $activityController = new ActivityController(new ActivityRepository($database));
        $quizController = new QuizController(new QuizRepository($database));
        $mediaController = new MediaController($database, (string) $config['media']['directory']);
        $supportController = new SupportTicketController(new SupportTicketRepository($database));
        $targetController = new StudyTargetController(new StudyTargetRepository($database));
        $paymentController = new PaymentRequestController(new PaymentRequestRepository($database));
        $dashboardController = new DashboardController(new DashboardRepository($database));

        $app = AppFactory::create();
        $app->setBasePath((string) $config['app']['base_path']);

        $app->get('/api/v1/health', static function (ServerRequestInterface $request, ResponseInterface $response) use ($config): ResponseInterface {
            return JsonResponder::success($response, [
                'service' => 'note-library-student-api',
                'status' => 'ok',
                'environment' => $config['app']['env'],
                'time' => gmdate(DATE_ATOM),
            ]);
        });
        $app->get('/api/v1/auth/csrf', [$authController, 'csrf']);
        $app->get('/api/v1/registration-options', [$academicController, 'registrationOptions']);
        $authRateLimit = new RateLimitMiddleware($basePath . '/storage/cache', 10, 60);
        $app->post('/api/v1/auth/register', [$authController, 'register'])->add($authRateLimit);
        $app->post('/api/v1/auth/login', [$authController, 'login'])->add($authRateLimit);
        $app->post('/api/v1/auth/forgot-password', [$authController, 'forgotPassword'])->add($authRateLimit);
        $app->post('/api/v1/auth/reset-password', [$authController, 'resetPassword'])->add($authRateLimit);
        $app->post('/api/v1/auth/email-verification/request', [$authController, 'requestEmailVerification'])->add($authRateLimit);
        $app->post('/api/v1/auth/email-verification/confirm', [$authController, 'confirmEmailVerification'])->add($authRateLimit);

        $app->get('/api/v1/media/{filename:[a-z0-9.-]+}', [$mediaController, 'serve']);

        $requireAuth = new AuthenticationMiddleware($sessions, $config['session'], true);
        $maintenanceMode = new MaintenanceModeMiddleware($database);
        $app->group('/api/v1', function (RouteCollectorProxyInterface $group) use (
            $authController,
            $profileController,
            $enrollmentController,
            $academicController,
            $resourceController,
            $activityController,
            $quizController,
            $supportController,
            $targetController,
            $paymentController,
            $dashboardController,
        ): void {
            $group->get('/auth/me', [$authController, 'me']);
            $group->get('/dashboard/summary', [$dashboardController, 'summary']);
            $group->post('/auth/logout', [$authController, 'logout']);

            $group->get('/support/tickets', [$supportController, 'index']);
            $group->post('/support/tickets', [$supportController, 'create']);
            $group->get('/support/tickets/{ticketId:[0-9]+}', [$supportController, 'show']);
            $group->post('/support/tickets/{ticketId:[0-9]+}/replies', [$supportController, 'reply']);
            $group->patch('/support/tickets/{ticketId:[0-9]+}/close', [$supportController, 'close']);

            $group->get('/profile', [$profileController, 'show']);
            $group->patch('/profile', [$profileController, 'update']);
            $group->delete('/profile', [$profileController, 'delete']);
            $group->get('/profile/avatar', [$profileController, 'avatar']);
            $group->post('/profile/avatar', [$profileController, 'uploadAvatar']);
            $group->delete('/profile/avatar', [$profileController, 'removeAvatar']);
            $group->patch('/profile/preferences', [$profileController, 'preferences']);
            $group->get('/profile/enrollments', [$enrollmentController, 'index']);
            $group->post('/profile/enrollments', [$enrollmentController, 'create']);
            $group->patch('/profile/enrollments/{id:[0-9]+}/primary', [$enrollmentController, 'makePrimary']);
            $group->delete('/profile/enrollments/{id:[0-9]+}', [$enrollmentController, 'delete']);

            $group->get('/study-targets', [$targetController, 'index']);
            $group->post('/study-targets', [$targetController, 'create']);
            $group->patch('/study-targets/{id:[0-9]+}', [$targetController, 'update']);
            $group->delete('/study-targets/{id:[0-9]+}', [$targetController, 'delete']);

            $group->get('/academic/programs', [$academicController, 'programs']);
            $group->get('/academic/programs/{programCode}/levels', [$academicController, 'levels']);
            $group->get('/academic/levels/{levelId:[0-9]+}/subjects', [$academicController, 'subjects']);
            $group->get('/academic/subjects/{academicSubjectId:[0-9]+}/units', [$academicController, 'units']);

            $group->get('/resources', [$resourceController, 'index']);
            $group->get('/resources/{slug:[a-z0-9-]+}', [$resourceController, 'show']);

            $group->get('/bookmarks', [$activityController, 'bookmarks']);
            $group->post('/bookmarks/{resourceId:[0-9]+}', [$activityController, 'addBookmark']);
            $group->delete('/bookmarks/{resourceId:[0-9]+}', [$activityController, 'removeBookmark']);
            $group->get('/history', [$activityController, 'history']);
            $group->post('/resources/{resourceId:[0-9]+}/progress', [$activityController, 'progress']);

            $group->get('/quizzes', [$quizController, 'index']);
            $group->get('/quiz-collections', [$quizController, 'collections']);
            $group->get('/quiz-collections/{collectionId:[0-9]+}', [$quizController, 'collection']);
            $group->post('/quiz-collections/{collectionId:[0-9]+}/payment-quote', [$paymentController, 'quote']);
            $group->post('/quiz-collections/{collectionId:[0-9]+}/payment-requests', [$paymentController, 'create']);
            $group->get('/quizzes/{quizId:[0-9]+}', [$quizController, 'show']);
            $group->get('/quizzes/{quizId:[0-9]+}/history', [$quizController, 'history']);
            $group->post('/quizzes/{quizId:[0-9]+}/attempts', [$quizController, 'start']);
            $group->patch('/quiz-attempts/{attemptId:[0-9]+}/answers/{questionId:[0-9]+}', [$quizController, 'answer']);
            $group->post('/quiz-attempts/{attemptId:[0-9]+}/submit', [$quizController, 'submit']);
            $group->get('/quiz-attempts/{attemptId:[0-9]+}/result', [$quizController, 'result']);
        })->add($maintenanceMode)->add($requireAuth);

        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->add(new CsrfMiddleware($csrf, $config['cors']['origins']));

        $errorMiddleware = $app->addErrorMiddleware(false, true, true, $logger);
        $errorMiddleware->setDefaultErrorHandler(
            static function (ServerRequestInterface $request, \Throwable $exception) use ($logger, $config): ResponseInterface {
                $requestId = (string) $request->getAttribute('request_id', 'unavailable');
                if ($exception instanceof ApiException) {
                    return JsonResponder::error(new Response(), $exception->errorCode, $exception->getMessage(), $exception->status, $exception->fields, [
                        'request_id' => $requestId,
                    ]);
                }

                if ($exception instanceof HttpException) {
                    return JsonResponder::error(
                        new Response(),
                        $exception->getCode() === 404 ? 'ROUTE_NOT_FOUND' : 'HTTP_ERROR',
                        $exception->getMessage(),
                        $exception->getCode(),
                        [],
                        ['request_id' => $requestId],
                    );
                }

                $logger->error('Unhandled API exception', [
                    'request_id' => $requestId,
                    'exception' => $exception,
                ]);
                $message = $config['app']['debug'] ? $exception->getMessage() : 'An unexpected error occurred.';
                return JsonResponder::error(new Response(), 'INTERNAL_ERROR', $message, 500, [], [
                    'request_id' => $requestId,
                ]);
            }
        );

        // Keep CORS outside the error middleware so error responses (401/403/500)
        // receive the same allow-origin headers as successful API responses.
        $app->add(new CorsMiddleware($config['cors']['origins']));
        $app->add(new RequestIdMiddleware());
        $app->add(new SecurityHeadersMiddleware());

        return $app;
    }

}
