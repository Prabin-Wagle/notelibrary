<?php

declare(strict_types=1);

namespace App\Payments;

use App\Domain\Exceptions\ApiException;
use App\Infrastructure\Database\Database;

final class PaymentRequestRepository
{
    public function __construct(private readonly Database $database)
    {
    }

    /** @return array{collection_id:int,title:string,price:float,discount_price:?float,amount:float,discount_percent:float} */
    public function quote(int $collectionId, ?string $promoCode): array
    {
        $statement = $this->database->connection()->prepare('SELECT id, title, price, discount_price FROM quiz_collections WHERE id = :id AND is_active = 1');
        $statement->execute(['id' => $collectionId]);
        $collection = $statement->fetch();
        if ($collection === false) {
            throw new ApiException('COLLECTION_NOT_FOUND', 'Test collection not found.', 404);
        }
        $base = (float) ($collection['discount_price'] ?? $collection['price']);
        $percent = 0.0;
        if ($promoCode !== null && trim($promoCode) !== '') {
            $promo = $this->database->connection()->prepare(
                "SELECT discount_type, discount_value FROM promo_codes
                 WHERE code = :code AND is_active = 1
                   AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
                   AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
                   AND (usage_limit IS NULL OR usage_count < usage_limit)
                 LIMIT 1"
            );
            $promo->execute(['code' => strtoupper(trim($promoCode))]);
            $data = $promo->fetch();
            if ($data === false) {
                throw new ApiException('PROMO_INVALID', 'This promotion code is invalid or expired.', 422, ['promo_code' => ['Check the code and try again.']]);
            }
            if ($data['discount_type'] === 'percent') {
                $percent = min(100, max(0, (float) $data['discount_value']));
            } elseif ($base > 0) {
                $percent = min(100, (float) $data['discount_value'] / $base * 100);
            }
        }
        return [
            'collection_id' => (int) $collection['id'],
            'title' => (string) $collection['title'],
            'price' => (float) $collection['price'],
            'discount_price' => $collection['discount_price'] === null ? null : (float) $collection['discount_price'],
            'amount' => round($base * (1 - $percent / 100), 2),
            'discount_percent' => $percent,
        ];
    }

    public function request(int $collectionId, int $userId, string $provider, string $reference, ?string $promoCode): int
    {
        if (!in_array($provider, ['esewa', 'khalti', 'bank'], true)) {
            throw new ApiException('VALIDATION_FAILED', 'Choose a supported payment method.', 422, ['provider' => ['Choose eSewa, Khalti, or bank transfer.']]);
        }
        $reference = trim($reference);
        if ($reference === '' || mb_strlen($reference) > 150) {
            throw new ApiException('VALIDATION_FAILED', 'Enter the payment transaction reference.', 422, ['reference' => ['Reference is required.']]);
        }
        $quote = $this->quote($collectionId, $promoCode);
        if ($quote['amount'] <= 0) {
            throw new ApiException('FREE_COLLECTION', 'This collection is free; start it from the collection page.', 409);
        }

        $pdo = $this->database->connection();
        $access = $pdo->prepare("SELECT 1 FROM payment_requests WHERE user_id = :user AND collection_id = :collection AND status = 'approved' LIMIT 1");
        $access->execute(['user' => $userId, 'collection' => $collectionId]);
        if ($access->fetchColumn() !== false) {
            throw new ApiException('ALREADY_ENROLLED', 'You already have access to this collection.', 409);
        }
        $pending = $pdo->prepare("SELECT 1 FROM payment_requests WHERE user_id = :user AND collection_id = :collection AND status = 'pending' LIMIT 1");
        $pending->execute(['user' => $userId, 'collection' => $collectionId]);
        if ($pending->fetchColumn() !== false) {
            throw new ApiException('PAYMENT_PENDING', 'Your payment is already waiting for review.', 409);
        }
        $insert = $pdo->prepare(
            "INSERT INTO payment_requests (user_id, collection_id, amount, currency, provider, reference, promo_code, status, created_at, updated_at)
             VALUES (:user, :collection, :amount, 'NPR', :provider, :reference, :promo, 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        );
        $insert->execute([
            'user' => $userId,
            'collection' => $collectionId,
            'amount' => $quote['amount'],
            'provider' => $provider,
            'reference' => $reference,
            'promo' => $promoCode === null ? null : strtoupper(trim($promoCode)),
        ]);
        return (int) $pdo->lastInsertId();
    }
}
