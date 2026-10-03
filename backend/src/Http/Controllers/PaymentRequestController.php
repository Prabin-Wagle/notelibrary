<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Exceptions\ApiException;
use App\Http\JsonResponder;
use App\Payments\PaymentRequestRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final class PaymentRequestController
{
    public function __construct(private readonly PaymentRequestRepository $payments)
    {
    }

    public function quote(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $promo = is_string($body['promo_code'] ?? null) ? $body['promo_code'] : null;
        return JsonResponder::success($response, ['quote' => $this->payments->quote((int) $args['collectionId'], $promo)]);
    }

    public function create(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $body = is_array($request->getParsedBody()) ? $request->getParsedBody() : [];
        $provider = $body['provider'] ?? null;
        $reference = $body['reference'] ?? null;
        if (!is_string($provider) || !is_string($reference)) {
            throw new ApiException('VALIDATION_FAILED', 'Payment method and transaction reference are required.', 422);
        }
        $promo = is_string($body['promo_code'] ?? null) ? $body['promo_code'] : null;
        $id = $this->payments->request((int) $args['collectionId'], (int) ((array) $request->getAttribute('auth'))['user_id'], $provider, $reference, $promo);
        return JsonResponder::success($response, ['id' => $id, 'status' => 'pending'], 201);
    }
}
