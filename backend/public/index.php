<?php

declare(strict_types=1);

use App\Bootstrap\ApplicationFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

$app = ApplicationFactory::create(dirname(__DIR__));
$app->run();
