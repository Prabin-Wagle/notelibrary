<?php

declare(strict_types=1);

namespace App\Auth;

use App\Domain\Exceptions\ApiException;
use App\Support\Id;
use App\Support\Validation;

final class AuthService
{
    /** @param array<string, mixed> $config */
    public function __construct(
        private readonly UserRepository $users,
        private readonly SessionRepository $sessions,
        private readonly ChallengeRepository $challenges,
        private readonly array $config,
    ) {
    }

    /** @param array<string, mixed> $body @return array{user:array<string,mixed>,token:string} */
    public function register(array $body, string $userAgent, string $ip): array
    {
        $email = Validation::email($body);
        $username = mb_strtolower(Validation::requiredString($body, 'username', 3, 40));
        if (!preg_match('/^[a-z0-9._-]+$/', $username)) {
            throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                'username' => ['Use letters, numbers, dots, underscores, or hyphens only.'],
            ]);
        }
        $displayName = Validation::requiredString($body, 'display_name', 2, 100);
        $password = Validation::password($body);

        if ($this->users->emailOrUsernameExists($email, $username)) {
            throw new ApiException('ACCOUNT_EXISTS', 'That email or username is already registered.', 409);
        }

        $userId = $this->users->create($email, $username, password_hash($password, PASSWORD_DEFAULT), $displayName, [
            'phone' => $this->optionalString($body, 'phone', 30),
            'province' => $this->optionalString($body, 'province', 100),
            'district' => $this->optionalString($body, 'district', 100),
            'city' => $this->optionalString($body, 'city', 120),
            'education_class' => $this->optionalString($body, 'class', 40),
            'faculty' => $this->optionalString($body, 'faculty', 100),
            'competition' => $this->optionalString($body, 'competition', 150),
        ]);
        $result = $this->newSession($userId, $email, $username, $displayName, $userAgent, $ip);
        $result['verification'] = $this->requestEmailVerification($email, $ip);
        return $result;
    }

    /** @param array<string, mixed> $body @return array{user:array<string,mixed>,token:string} */
    public function login(array $body, string $userAgent, string $ip): array
    {
        $login = mb_strtolower(Validation::requiredString($body, 'login', 3, 254));
        $password = Validation::requiredString($body, 'password', 1, 200);
        $user = $this->users->findByLogin($login);

        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            throw new ApiException('INVALID_CREDENTIALS', 'The supplied credentials are invalid.', 401);
        }
        if ($user['status'] === 'suspended' && $this->users->activateExpiredSuspension((int) $user['id'])) {
            $user['status'] = 'active';
        }
        if ($user['status'] !== 'active') {
            if ($user['status'] === 'banned') {
                throw new ApiException('ACCOUNT_BANNED', 'This account has been banned. Contact the Help center if you believe this is a mistake.', 403);
            }
            if ($user['status'] === 'suspended') {
                throw new ApiException('ACCOUNT_SUSPENDED', 'This account is temporarily suspended. Contact the Help center for assistance.', 403);
            }
            throw new ApiException('ACCOUNT_UNAVAILABLE', 'This account is not available.', 403);
        }

        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            $this->users->updatePassword((int) $user['id'], password_hash($password, PASSWORD_DEFAULT));
        }
        $this->users->markLogin((int) $user['id']);

        return $this->newSession(
            (int) $user['id'],
            (string) $user['email'],
            (string) $user['username'],
            isset($user['display_name']) ? (string) $user['display_name'] : null,
            $userAgent,
            $ip,
        );
    }

    /** @return array<string, mixed> */
    public function requestPasswordReset(string $email, string $ip): array
    {
        $user = $this->users->findByEmail($email);
        $response = ['message' => 'If that account exists, a reset instruction has been created.'];
        if ($user === null) {
            return $response;
        }

        $token = Id::token(32);
        $this->challenges->create(
            (int) $user['id'],
            'password_reset',
            $email,
            $token,
            20,
            $this->ipHash($ip),
        );

        // Until a mail adapter is configured, local development exposes the token explicitly.
        if (($this->config['app']['env'] ?? 'production') === 'local') {
            $response['debug_token'] = $token;
        }
        return $response;
    }

    /** @return array<string, mixed> */
    public function requestEmailVerification(string $email, string $ip): array
    {
        $user = $this->users->findByEmail($email);
        $response = ['message' => 'If verification is available, a code has been created.'];
        if ($user === null || $user['email_verified_at'] !== null) {
            return $response;
        }

        $code = (string) random_int(100000, 999999);
        $this->challenges->create(
            (int) $user['id'],
            'verify_email',
            $email,
            $code,
            10,
            $this->ipHash($ip),
        );
        if (($this->config['app']['env'] ?? 'production') === 'local') {
            $response['debug_code'] = $code;
        }
        return $response;
    }

    /** @param array<string, mixed> $body */
    public function confirmEmailVerification(array $body): void
    {
        $email = Validation::email($body);
        $code = Validation::requiredString($body, 'code', 6, 6);
        $challenge = $this->challenges->consume('verify_email', $email, $code);
        if ($challenge === null || $challenge['user_id'] === null) {
            throw new ApiException('VERIFICATION_CODE_INVALID', 'The verification code is invalid or expired.', 422);
        }
        $this->users->markEmailVerified((int) $challenge['user_id']);
    }

    /** @param array<string, mixed> $body */
    public function resetPassword(array $body): void
    {
        $email = Validation::email($body);
        $token = Validation::requiredString($body, 'token', 20, 200);
        $password = Validation::password($body, 'new_password');
        $challenge = $this->challenges->consume('password_reset', $email, $token);
        if ($challenge === null || $challenge['user_id'] === null) {
            throw new ApiException('RESET_TOKEN_INVALID', 'The reset token is invalid or expired.', 422);
        }

        $userId = (int) $challenge['user_id'];
        $this->users->updatePassword($userId, password_hash($password, PASSWORD_DEFAULT));
        $this->sessions->revokeAllForUser($userId);
    }

    /** @return array{user:array<string,mixed>,token:string} */
    private function newSession(int $userId, string $email, string $username, ?string $displayName, string $userAgent, string $ip): array
    {
        $token = Id::token(32);
        $this->sessions->create(
            $userId,
            $token,
            (int) $this->config['session']['absolute_hours'],
            $userAgent,
            $this->ipHash($ip),
        );

        return [
            'token' => $token,
            'user' => [
                'id' => $userId,
                'email' => $email,
                'username' => $username,
                'display_name' => $displayName,
                'role' => 'student',
            ],
        ];
    }

    private function ipHash(string $ip): string
    {
        return hash_hmac('sha256', $ip, (string) $this->config['app']['key'], true);
    }

    /** @param array<string, mixed> $body */
    private function optionalString(array $body, string $field, int $maxLength): ?string
    {
        if (!isset($body[$field]) || !is_string($body[$field]) || trim($body[$field]) === '') {
            return null;
        }
        return mb_substr(trim($body[$field]), 0, $maxLength);
    }
}
