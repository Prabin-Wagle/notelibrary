<?php

declare(strict_types=1);

namespace App\Admin;

use App\Auth\SessionRepository;
use App\Auth\UserRepository;
use App\Domain\Exceptions\ApiException;
use App\Support\Id;
use App\Support\Validation;

final class AdminAuthService
{
    /** @param array<string, mixed> $config */
    public function __construct(
        private readonly UserRepository $users,
        private readonly SessionRepository $sessions,
        private readonly array $config,
    ) {
    }

    /** @param array<string, mixed> $body @return array{token:string,user:array<string,mixed>} */
    public function login(array $body, string $userAgent, string $ip): array
    {
        $email = mb_strtolower(Validation::requiredString($body, 'email', 3, 254));
        $password = Validation::requiredString($body, 'password', 1, 200);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new ApiException('INVALID_CREDENTIALS', 'The supplied credentials are invalid.', 401);
        }
        $user = $this->users->findAdminByEmail($email);
        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            throw new ApiException('INVALID_CREDENTIALS', 'The supplied credentials are invalid.', 401);
        }
        if ($user['status'] !== 'active' || $user['role'] !== 'admin') {
            throw new ApiException('ADMIN_ACCESS_REQUIRED', 'Administrator access is required.', 403);
        }

        $token = Id::token(32);
        $this->sessions->create(
            (int) $user['id'],
            $token,
            (int) $this->config['admin_session']['absolute_hours'],
            $userAgent,
            hash_hmac('sha256', $ip, (string) $this->config['app']['key'], true),
        );
        $this->users->markLogin((int) $user['id']);

        return [
            'token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'email' => $user['email'],
                'username' => $user['username'],
                'display_name' => $user['display_name'],
                'role' => 'admin',
            ],
        ];
    }
}
