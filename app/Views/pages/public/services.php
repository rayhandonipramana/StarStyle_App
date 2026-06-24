<?php
$groupCount = count($groups ?? []);
$serviceCount = 0;
foreach ($groups as $bundle) {
    $serviceCount += count($bundle['services'] ?? []);
}
?>
<section class="container py-5">
    <div class="public-services-hero mb-5">
        <div>
            <span class="eyebrow">Catalog Layanan</span>
            <h1 class="section-title">Daftar layanan StarStyle</h1>
            <p class="section-copy">Pilih treatment sesuai kebutuhan, lihat durasi dan variasinya, lalu lanjut booking tanpa perlu pindah alur. Halaman ini saya rapikan supaya service list terasa lebih premium dan lebih gampang dipilih.</p>
        </div>
        <div class="public-services-hero__actions">
            <a class="btn btn-dark rounded-pill px-4" href="<?= e(url('/booking')) ?>">Buat booking</a>
        </div>
    </div>

    <div class="public-services-summary mb-5">
        <div class="public-services-summary__item">
            <small>Total Kategori</small>
            <strong><?= e((string) $groupCount) ?></strong>
            <span>grup treatment tersedia</span>
        </div>
        <div class="public-services-summary__item">
            <small>Total Layanan</small>
            <strong><?= e((string) $serviceCount) ?></strong>
            <span>opsi yang bisa langsung dibooking</span>
        </div>
        <div class="public-services-summary__item">
            <small>Flow Cepat</small>
            <strong>Book Fast</strong>
            <span>pilih layanan, cek slot, lalu konfirmasi</span>
        </div>
    </div>

    <?php foreach ($groups as $bundle): ?>
        <div class="public-service-group mt-5">
            <div class="public-service-group__head">
                <div>
                    <span class="eyebrow"><?= e($bundle['group']['name']) ?></span>
                    <h2 class="mb-2"><?= e($bundle['group']['name']) ?></h2>
                    <p class="text-muted mb-0"><?= e($bundle['group']['description'] ?? 'Pilihan treatment terkurasi untuk hasil yang lebih konsisten.') ?></p>
                </div>
                <div class="public-service-group__meta">
                    <strong><?= e((string) count($bundle['services'])) ?></strong>
                    <span>opsi layanan</span>
                </div>
            </div>
            <div class="row g-4">
                <?php foreach ($bundle['services'] as $service): ?>
                    <div class="col-md-6 col-xl-4">
                        <div class="showcase-card public-service-card h-100">
                            <div class="public-service-card__head">
                                <div class="badge text-bg-light"><?= e($service['status']) ?></div>
                                <span class="public-service-card__time"><i class="bi bi-clock-history"></i> <?= e((string) $service['duration']) ?> menit</span>
                            </div>
                            <div class="public-service-card__body">
                                <h3><?= e($service['name']) ?></h3>
                                <p><?= e($service['description']) ?></p>
                                <div class="public-chip-row mb-3">
                                    <?php foreach (array_slice($service['variants'], 0, 3) as $variant): ?>
                                        <span><?= e($variant) ?></span>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                            <div class="public-service-card__footer">
                                <div class="public-service-card__price">
                                    <small>Mulai dari</small>
                                    <strong><?= money($service['price']) ?></strong>
                                </div>
                                <a class="btn btn-sm btn-dark rounded-pill px-3" href="<?= e(url('/booking')) ?>">Book</a>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endforeach; ?>
</section>
