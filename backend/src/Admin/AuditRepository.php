<?php

declare(strict_types=1);

namespace App\Admin;

use App\Infrastructure\Database\Database;
use PDO;

final class AuditRepository
{
    /** @param array<string, mixed> $config */
    public function __construct(private readonly Database $database, private readonly array $config)
    {
    }

    /** @param array<string, mixed> $metadata */
    public function record(
        int $adminId,
        string $action,
        ?string $entityType,
        int|string|null $entityId,
        string $ip,
        string $requestId,
        array $metadata = [],
    ): void {
        $statement = $this->database->connection()->prepare(
            'INSERT INTO admin_audit_logs
                (admin_user_id, action, entity_type, entity_id, ip_hash, request_id, metadata, created_at)
             VALUES (:admin_id, :action, :entity_type, :entity_id, :ip_hash, :request_id, :metadata, UTC_TIMESTAMP())'
        );
        $statement->bindValue('admin_id', $adminId, PDO::PARAM_INT);
        $statement->bindValue('action', $action);
        $statement->bindValue('entity_type', $entityType);
        $statement->bindValue('entity_id', $entityId === null ? null : (string) $entityId);
        $statement->bindValue('ip_hash', hash_hmac('sha256', $ip, (string) $this->config['app']['key'], true), PDO::PARAM_LOB);
        $statement->bindValue('request_id', $requestId);
        $statement->bindValue('metadata', $metadata === [] ? null : json_encode($metadata, JSON_THROW_ON_ERROR));
        $statement->execute();
    }
}
