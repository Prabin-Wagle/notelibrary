<?php

declare(strict_types=1);

use App\Bootstrap\AdminApplicationFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

$app = AdminApplicationFactory::create(dirname(__DIR__));
$app->run();
