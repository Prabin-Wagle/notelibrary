<?php

declare(strict_types=1);

namespace App\Bootstrap;

use App\Admin\AdminAuthService;
use App\Admin\AdminCatalogRepository;
use App\Admin\AdminDashboardRepository;
use App\Admin\AdminOperationsRepository;
use App\Admin\AdminPortalRepository;
use App\Admin\AdminResourceRepository;
use App\Admin\AdminUserRepository;
use App\Admin\AuditRepository;
use App\Auth\CsrfService;
use App\Auth\SessionRepository;
use App\Auth\UserRepository;
use App\Config\Config;
use App\Domain\Exceptions\ApiException;
use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AdminCatalogController;
use App\Http\Controllers\AdminCsrfController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminMediaController;
use App\Http\Controllers\AdminOperationsController;
use App\Http\Controllers\AdminPortalController;
use App\Http\Controllers\AdminResourceController;
use App\Http\Controllers\AdminUserController;
use App\Http\JsonResponder;
use App\Http\Middleware\AuthenticationMiddleware;
use App\Http\Middleware\CorsMiddleware;
use App\Http\Middleware\CsrfMiddleware;
use App\Http\Middleware\RateLimitMiddleware;
use App\Http\Middleware\RequestIdMiddleware;
use App\Http\Middleware\RoleMiddleware;
use App\Http\Middleware\SecurityHeadersMiddleware;
use App\Infrastructure\Database\Database;
use Dotenv\Dotenv;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpException;
use Slim\Factory\AppFactory;
use Slim\Interfaces\RouteCollectorProxyInterface;
use Slim\Psr7\Response;

final class AdminApplicationFactory
{
    public static function create(string $basePath): \Slim\App
    {
        if (is_file($basePath . '/.env')) {
            Dotenv::createImmutable($basePath)->safeLoad();
        }

        self::loadLocalConfig($basePath);

        $config = Config::load($basePath);
        date_default_timezone_set((string) $config['app']['timezone']);

        $logDirectory = $basePath . '/storage/logs';
        if (!is_dir($logDirectory)) {
            mkdir($logDirectory, 0770, true);
        }
        $logger = new Logger('note-library-admin-api');
        $logger->pushHandler(new StreamHandler(
            $logDirectory . '/app.log',
            Level::fromName((string) $config['log_level']),
        ));

        $database = new Database($config['database']);
        $users = new UserRepository($database);
        $sessions = new SessionRepository($database);
        $csrf = new CsrfService((string) $config['app']['key']);
        $audit = new AuditRepository($database, $config);

        $adminAuth = new AdminAuthController(new AdminAuthService($users, $sessions, $config), $sessions, $config);
        $csrfController = new AdminCsrfController($csrf, $config);
        $dashboard = new AdminDashboardController(new AdminDashboardRepository($database));
        $adminUsers = new AdminUserController(new AdminUserRepository($database), $sessions, $audit, (string) $config['media']['directory']);
        $catalog = new AdminCatalogController(new AdminCatalogRepository($database), $audit);
        $resources = new AdminResourceController(new AdminResourceRepository($database), $audit);
        $operations = new AdminOperationsController(new AdminOperationsRepository($database));
        $portal = new AdminPortalController(new AdminPortalRepository($database));
        $media = new AdminMediaController($database, $basePath, (string) $config['media']['directory']);

        $app = AppFactory::create();
        $app->setBasePath((string) $config['app']['base_path']);

        $app->get('/api/v1/health', static fn (ServerRequestInterface $request, ResponseInterface $response): ResponseInterface =>
            JsonResponder::success($response, [
                'service' => 'note-library-admin-api',
                'status' => 'ok',
                'environment' => $config['app']['env'],
                'time' => gmdate(DATE_ATOM),
            ])
        );
        $app->get('/api/v1/auth/csrf', [$csrfController, 'issue']);
        $authRateLimit = new RateLimitMiddleware($basePath . '/storage/cache', 10, 60);
        $app->post('/api/v1/admin/auth/login', [$adminAuth, 'login'])->add($authRateLimit);
        $app->get('/api/v1/media/{filename:[a-z0-9.-]+}', [$media, 'serve']);

        $requireAdminAuth = new AuthenticationMiddleware($sessions, $config['admin_session'], true);
        $requireAdminRole = new RoleMiddleware(['admin']);
        $app->group('/api/v1/admin', function (RouteCollectorProxyInterface $group) use (
            $adminAuth,
            $dashboard,
            $adminUsers,
            $catalog,
            $resources,
            $operations,
            $portal,
            $media,
        ): void {
            $group->get('/auth/me', [$adminAuth, 'me']);
            $group->post('/auth/logout', [$adminAuth, 'logout']);
            $group->get('/dashboard', [$dashboard, 'show']);

            $group->get('/users', [$adminUsers, 'index']);
            $group->get('/users/{id:[0-9]+}', [$adminUsers, 'show']);
            $group->get('/users/{id:[0-9]+}/avatar', [$adminUsers, 'avatar']);
            $group->patch('/users/{id:[0-9]+}/status', [$adminUsers, 'status']);
            $group->delete('/users/{id:[0-9]+}', [$adminUsers, 'delete']);

            $group->get('/catalog/programs', [$catalog, 'programs']);
            $group->post('/catalog/programs', [$catalog, 'createProgram']);
            $group->put('/catalog/programs/{id:[0-9]+}', [$catalog, 'updateProgram']);
            $group->delete('/catalog/programs/{id:[0-9]+}', [$catalog, 'deleteProgram']);
            $group->get('/catalog/levels', [$catalog, 'levels']);
            $group->post('/catalog/levels', [$catalog, 'createLevel']);
            $group->get('/catalog/subjects', [$catalog, 'subjects']);
            $group->post('/catalog/subjects', [$catalog, 'createSubject']);
            $group->put('/catalog/subjects/{id:[0-9]+}', [$catalog, 'updateSubject']);
            $group->delete('/catalog/subjects/{id:[0-9]+}', [$catalog, 'deleteSubject']);
            $group->get('/catalog/offerings', [$catalog, 'offerings']);
            $group->post('/catalog/offerings', [$catalog, 'createOffering']);
            $group->get('/catalog/units', [$catalog, 'units']);
            $group->post('/catalog/units', [$catalog, 'createUnit']);
            $group->patch('/catalog/{entity:program|level|subject|offering|unit}/{id:[0-9]+}/active', [$catalog, 'active']);

            $group->get('/resource-types', [$resources, 'types']);
            $group->get('/resources', [$resources, 'index']);
            $group->post('/resources', [$resources, 'create']);
            $group->put('/resources/{id:[0-9]+}', [$resources, 'update']);
            $group->delete('/resources/{id:[0-9]+}', [$resources, 'archive']);

            $group->map(['GET', 'POST'], '/promo-codes', [$operations, 'promoCodes']);
            $group->get('/payment-requests', [$operations, 'payments']);
            $group->post('/payment-requests/action', [$operations, 'paymentAction']);
            $group->get('/support/tickets', [$operations, 'tickets']);
            $group->get('/support/ticket-details', [$operations, 'ticketDetails']);
            $group->post('/support/replies', [$operations, 'reply']);

            $group->map(['GET', 'POST', 'PUT', 'DELETE'], '/legacy/{entity}', [$portal, 'dispatch']);
            $group->post('/media', [$media, 'upload']);
            $group->post('/media/delete', [$media, 'delete']);
        })->add($requireAdminRole)->add($requireAdminAuth);

        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->add(new CsrfMiddleware($csrf, $config['cors']['origins'], 'nl_admin_csrf'));
        $app->add(new CorsMiddleware($config['cors']['origins']));

        $errorMiddleware = $app->addErrorMiddleware(false, true, true, $logger);
        $errorMiddleware->setDefaultErrorHandler(
            static function (ServerRequestInterface $request, \Throwable $exception) use ($logger, $config): ResponseInterface {
                $requestId = (string) $request->getAttribute('request_id', 'unavailable');
                if ($exception instanceof ApiException) {
                    return JsonResponder::error(new Response(), $exception->errorCode, $exception->getMessage(), $exception->status, $exception->fields, ['request_id' => $requestId]);
                }
                if ($exception instanceof HttpException) {
                    return JsonResponder::error(new Response(), $exception->getCode() === 404 ? 'ROUTE_NOT_FOUND' : 'HTTP_ERROR', $exception->getMessage(), $exception->getCode(), [], ['request_id' => $requestId]);
                }
                $logger->error('Unhandled API exception', ['request_id' => $requestId, 'exception' => $exception]);
                $message = $config['app']['debug'] ? $exception->getMessage() : 'An unexpected error occurred.';
                return JsonResponder::error(new Response(), 'INTERNAL_ERROR', $message, 500, [], ['request_id' => $requestId]);
            }
        );

        $app->add(new RequestIdMiddleware());
        $app->add(new SecurityHeadersMiddleware());

        return $app;
    }

    /** Load the private cPanel config without overriding process or .env settings. */
    private static function loadLocalConfig(string $basePath): void
    {
        $path = $basePath . '/config.local.php';
        if (!is_file($path)) {
            return;
        }

        $local = require $path;
        if (!is_array($local)) {
            throw new \RuntimeException('config.local.php must return an array.');
        }

        $aliases = [
            'DB_NAME' => 'DB_DATABASE',
            'DB_USER' => 'DB_USERNAME',
        ];
        foreach ($local as $key => $value) {
            if (!is_string($key) || (!is_string($value) && !is_numeric($value) && !is_bool($value))) {
                continue;
            }
            $environmentKey = $aliases[$key] ?? $key;
            $existing = $_ENV[$environmentKey] ?? $_SERVER[$environmentKey] ?? getenv($environmentKey);
            if ($existing !== false && $existing !== null && $existing !== '') {
                continue;
            }

            $stringValue = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
            $_ENV[$environmentKey] = $stringValue;
            $_SERVER[$environmentKey] = $stringValue;
            putenv($environmentKey . '=' . $stringValue);
        }
    }
}
