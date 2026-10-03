<?php

declare(strict_types=1);

namespace App\Profile;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;

final class ProfileRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array<string, mixed> */
    public function get(int $userId): array
    {
        $statement = $this->database->connection()->prepare(
            'SELECT u.id, u.email, u.username, u.email_verified_at,
                    p.display_name, p.phone, p.avatar_path, p.date_of_birth, p.bio,
                    p.province, p.district, p.city, p.education_class, p.faculty, p.competition,
                    pref.theme, pref.locale, pref.timezone, pref.cursor_mode, pref.cursor_size
             FROM users u
             INNER JOIN student_profiles p ON p.user_id = u.id
             INNER JOIN user_preferences pref ON pref.user_id = u.id
             WHERE u.id = :id'
        );
        $statement->execute(['id' => $userId]);
        return (array) $statement->fetch();
    }

    public function avatarPath(int $userId): ?string
    {
        $statement = $this->database->connection()->prepare('SELECT avatar_path FROM student_profiles WHERE user_id = :id LIMIT 1');
        $statement->execute(['id' => $userId]);
        $path = $statement->fetchColumn();
        return is_string($path) && $path !== '' ? $path : null;
    }

    public function updateAvatarPath(int $userId, ?string $path): ?string
    {
        return $this->database->transaction(function (\PDO $pdo) use ($userId, $path): ?string {
            $statement = $pdo->prepare('SELECT avatar_path FROM student_profiles WHERE user_id = :id FOR UPDATE');
            $statement->execute(['id' => $userId]);
            $oldPath = $statement->fetchColumn();
            if ($oldPath === false) {
                throw new ApiException('PROFILE_NOT_FOUND', 'The student profile could not be found.', 404);
            }
            $pdo->prepare('UPDATE student_profiles SET avatar_path = :path, updated_at = UTC_TIMESTAMP() WHERE user_id = :id')
                ->execute(['path' => $path, 'id' => $userId]);
            return is_string($oldPath) && $oldPath !== '' ? $oldPath : null;
        });
    }

    /** @param array<string, mixed> $values */
    public function update(int $userId, array $values): void
    {
        if (isset($values['username']) && is_string($values['username'])) {
            $username = mb_strtolower(trim($values['username']));
            if (mb_strlen($username) < 3 || mb_strlen($username) > 40 || !preg_match('/^[a-z0-9._-]+$/', $username)) {
                throw new ApiException('VALIDATION_FAILED', 'Some fields are invalid.', 422, [
                    'username' => ['Use 3–40 letters, numbers, dots, underscores, or hyphens.'],
                ]);
            }
            $exists = $this->database->connection()->prepare('SELECT 1 FROM users WHERE username = :username AND id <> :user_id LIMIT 1');
            $exists->execute(['username' => $username, 'user_id' => $userId]);
            if ($exists->fetchColumn() !== false) {
                throw new ApiException('USERNAME_TAKEN', 'That username is already in use.', 409, [
                    'username' => ['Choose another username.'],
                ]);
            }
            $this->database->connection()->prepare('UPDATE users SET username = :username, updated_at = UTC_TIMESTAMP() WHERE id = :user_id')
                ->execute(['username' => $username, 'user_id' => $userId]);
        }

        $allowed = ['display_name', 'phone', 'date_of_birth', 'bio', 'province', 'district', 'city', 'education_class', 'faculty', 'competition'];
        $sets = [];
        $params = ['user_id' => $userId];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $values)) {
                $sets[] = "{$field} = :{$field}";
                $params[$field] = is_string($values[$field]) ? trim($values[$field]) : $values[$field];
            }
        }
        if ($sets === []) {
            return;
        }
        $sets[] = 'updated_at = UTC_TIMESTAMP()';
        $statement = $this->database->connection()->prepare(
            'UPDATE student_profiles SET ' . implode(', ', $sets) . ' WHERE user_id = :user_id'
        );
        $statement->execute($params);
    }

    public function deleteAccount(int $userId, string $password): void
    {
        $this->database->transaction(function (\PDO $pdo) use ($userId, $password): void {
            $statement = $pdo->prepare("SELECT password_hash, status FROM users WHERE id = :id AND role = 'student' AND status <> 'deleted' FOR UPDATE");
            $statement->execute(['id' => $userId]);
            $user = $statement->fetch();
            if ($user === false || !password_verify($password, (string) $user['password_hash'])) {
                throw new ApiException('PASSWORD_INVALID', 'Enter your current password to confirm account deletion.', 422, ['password' => ['The password does not match.']]);
            }

            $pdo->prepare("UPDATE users SET email = :email, username = :username, status = 'deleted', suspended_until = NULL, status_reason = 'Account deleted by the student.', updated_at = UTC_TIMESTAMP() WHERE id = :id")
                ->execute([
                    'email' => 'deleted+' . $userId . '-' . bin2hex(random_bytes(5)) . '@account.invalid',
                    'username' => 'deleted-' . $userId . '-' . bin2hex(random_bytes(5)),
                    'id' => $userId,
                ]);
            $pdo->prepare(
                "INSERT INTO user_status_history
                    (user_id, changed_by_user_id, previous_status, new_status, reason, source, created_at)
                 VALUES (:user_id, :actor_id, :previous, 'deleted', 'Account deleted by the student.', 'student', UTC_TIMESTAMP())"
            )->execute(['user_id' => $userId, 'actor_id' => $userId, 'previous' => (string) $user['status']]);
            $pdo->prepare("UPDATE student_profiles SET display_name = 'Deleted account', phone = NULL, avatar_path = NULL, date_of_birth = NULL, bio = NULL, province = NULL, district = NULL, city = NULL, education_class = NULL, faculty = NULL, competition = NULL, updated_at = UTC_TIMESTAMP() WHERE user_id = :id")
                ->execute(['id' => $userId]);
            $pdo->prepare('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()) WHERE user_id = :id')->execute(['id' => $userId]);
        });
    }

    /** @param array<string, mixed> $values */
    public function updatePreferences(int $userId, array $values): void
    {
        $allowedValues = [
            'theme' => ['system', 'light', 'dark'],
            'cursor_mode' => ['default', 'custom'],
            'cursor_size' => ['small', 'medium', 'large'],
        ];
        $sets = [];
        $params = ['user_id' => $userId];
        foreach (['theme', 'locale', 'timezone', 'cursor_mode', 'cursor_size'] as $field) {
            if (!array_key_exists($field, $values) || !is_string($values[$field])) {
                continue;
            }
            $value = trim($values[$field]);
            if (isset($allowedValues[$field]) && !in_array($value, $allowedValues[$field], true)) {
                continue;
            }
            $sets[] = "{$field} = :{$field}";
            $params[$field] = $value;
        }
        if ($sets === []) {
            return;
        }
        $sets[] = 'updated_at = UTC_TIMESTAMP()';
        $this->database->connection()->prepare(
            'UPDATE user_preferences SET ' . implode(', ', $sets) . ' WHERE user_id = :user_id'
        )->execute($params);
    }
}
