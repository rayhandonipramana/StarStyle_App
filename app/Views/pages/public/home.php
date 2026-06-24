<section class="hero-section">
    <div class="container py-5">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <div class="hero-badge">
                    <i class="bi bi-stars"></i>
                    <span>Customer experience yang lebih elegan dari booking sampai repeat visit</span>
                </div>
                <span class="eyebrow">Reservasi + POS + CRM + Analytics</span>
                <h1 class="hero-title">Salon management system modern untuk operasional yang lebih tenang dan pengalaman customer yang lebih mewah.</h1>
                <p class="hero-copy">StarStyle menghubungkan booking pelanggan, pengaturan staf, penjualan, inventory, voucher, review, dan insight bisnis dalam satu pengalaman yang clean, hangat, dan terasa premium.</p>
                <div class="d-flex flex-wrap gap-3 mt-4">
                    <a class="btn btn-dark btn-lg rounded-pill px-4" href="<?= e(url('/booking')) ?>">Reservasi Sekarang</a>
                    <a class="btn btn-light btn-lg rounded-pill px-4" href="<?= e(url('/services-catalog')) ?>">Lihat Layanan</a>
                </div>
                <div class="hero-trust mt-4">
                    <div>
                        <strong><?= e($business['city'] ?? 'Jakarta') ?></strong>
                        <span>Salon service dengan suasana studio yang tenang</span>
                    </div>
                    <div>
                        <strong><?= e($business['hours'] ?? '-') ?></strong>
                        <span>Jam operasional fleksibel untuk weekday dan weekend</span>
                    </div>
                </div>
                <div class="hero-stats mt-5">
                    <?php foreach ($heroMetrics as $metric): ?>
                        <div class="hero-stat">
                            <div class="hero-stat__value"><?= e((string) $metric['value']) ?></div>
                            <div class="hero-stat__label"><?= e($metric['label']) ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="glass-preview">
                    <div class="glass-preview__top">
                        <span>Signature customer flow</span>
                        <span><?= e($business['name'] ?? 'StarStyle') ?></span>
                    </div>
                    <div class="preview-grid">
                        <div class="soft-card"><div class="small text-muted">Total Penjualan</div><div class="display-6 fw-bold"><?= money(3185000) ?></div></div>
                        <div class="soft-card"><div class="small text-muted">Agenda Hari Ini</div><div class="display-6 fw-bold">12</div></div>
                        <div class="soft-card"><div class="small text-muted">Konfirmasi Booking</div><div class="display-6 fw-bold">8</div></div>
                        <div class="soft-card"><div class="small text-muted">Retention</div><div class="display-6 fw-bold">72%</div></div>
                    </div>
                    <div class="mt-4 soft-card">
                        <div class="fw-semibold mb-3">Layanan unggulan minggu ini</div>
                        <div class="vstack gap-3">
                            <?php foreach ($featuredServices as $service): ?>
                                <div class="public-feature-row d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="fw-semibold"><?= e($service['name']) ?></div>
                                        <div class="small text-muted"><?= e($service['description']) ?></div>
                                    </div>
                                    <strong><?= money($service['price']) ?></strong>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="container py-5">
    <div class="section-head">
        <div>
            <span class="eyebrow">Paket Populer</span>
            <h2 class="section-title">Pilihan treatment yang paling sering dibooking</h2>
            <p class="section-copy">Paket dibuat untuk customer yang ingin hasil lebih maksimal tanpa harus ribet pilih treatment satu per satu.</p>
        </div>
        <a class="btn btn-outline-dark rounded-pill" href="<?= e(url('/booking')) ?>">Atur jadwal</a>
    </div>
    <div class="row g-4 mt-1">
        <?php foreach ($packages as $package): ?>
            <div class="col-md-6">
                <div class="showcase-card">
                    <div class="showcase-card__price"><?= money($package['price']) ?></div>
                    <h3><?= e($package['name']) ?></h3>
                    <p><?= e(implode(' + ', $package['items'])) ?></p>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</section>

<section class="container pb-5">
    <div class="section-head">
        <div>
            <span class="eyebrow">Customer Love</span>
            <h2 class="section-title">Review pelanggan terbaru</h2>
            <p class="section-copy">Feedback terbaru dari customer yang sudah reservasi, treatment, dan checkout langsung lewat ekosistem StarStyle.</p>
        </div>
    </div>
    <div class="row g-4 mt-1">
        <?php foreach ($reviews as $review): ?>
            <div class="col-md-6">
                <div class="soft-card public-review-card h-100">
                    <div class="d-flex justify-content-between">
                        <strong><?= e($review['customer']) ?></strong>
                        <span class="badge text-bg-light"><?= e(str_repeat('*', (int) $review['rating'])) ?></span>
                    </div>
                    <p class="text-muted mt-3 mb-0"><?= e($review['feedback']) ?></p>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</section>
