<!doctype html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title ?? config('name')) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" rel="stylesheet">
    <link href="<?= e(asset('css/app.css')) ?>" rel="stylesheet">
</head>
<?php
$currentPage = (string) ($page ?? '');
$hidePublicHeader = str_starts_with($currentPage, '/customer/') || $currentPage === '/booking';
?>
<body class="public-shell">
<div class="public-shell__bg"></div>
<?php if (!$hidePublicHeader): ?>
    <header class="public-header">
        <div class="container">
            <nav class="navbar navbar-expand-lg public-navbar">
                <a class="navbar-brand public-brand" href="<?= e(url('/')) ?>">
                    <span class="brand-mark">S</span>
                    <span>
                        <strong>StarStyle</strong>
                        <small>Salon experience crafted beautifully</small>
                    </span>
                </a>
                <div class="public-nav ms-auto">
                    <?php foreach (($publicNav ?? []) as $item): ?>
                        <a class="public-nav__link <?= active_path($item['path'], $page ?? '') ? 'is-active' : '' ?>" href="<?= e(url($item['path'])) ?>"><?= e($item['label']) ?></a>
                    <?php endforeach; ?>
                </div>
                <div class="public-actions">
                    <a class="btn btn-light rounded-pill px-4" href="<?= e(url('/customer/login')) ?>">Customer Login</a>
                    <a class="btn btn-dark rounded-pill px-4" href="<?= e(url('/login')) ?>">Admin</a>
                </div>
            </nav>
        </div>
    </header>
<?php endif; ?>
<main class="public-main">
    <?php if (!empty($success) || !empty($error)): ?>
        <div class="container pt-4">
            <?php if (!empty($success)): ?><div class="alert alert-success border-0 rounded-4"><?= e($success) ?></div><?php endif; ?>
            <?php if (!empty($error)): ?><div class="alert alert-danger border-0 rounded-4"><?= e($error) ?></div><?php endif; ?>
        </div>
    <?php endif; ?>
    <?= $content ?>
</main>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="<?= e(asset('js/app.js')) ?>"></script>
</body>
</html>
