<?php
$paymentBackUrl = '/booking';
?>
<section class="container py-5">
    <div class="public-booking-back mb-4">
        <a class="public-booking-back__link" href="<?= e(url($paymentBackUrl)) ?>">
            <i class="bi bi-arrow-left"></i>
            <span>Kembali ke booking</span>
        </a>
    </div>

    <div class="public-payment-hero mb-4">
        <div>
            <span class="eyebrow">Payment</span>
            <h1 class="section-title mb-2">Selesaikan pembayaran untuk mengaktifkan booking</h1>
            <p class="section-copy mb-0">Setelah pembayaran selesai, booking akan langsung aktif dan masuk ke daftar kalender staff <?= e($staffMember['name'] ?? '-') ?>.</p>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-7">
            <div class="page-card public-payment-card">
                <div class="public-payment-card__head">
                    <div>
                        <span class="eyebrow">Ringkasan Booking</span>
                        <h2>Booking <?= e($booking['reference'] ?? '-') ?></h2>
                    </div>
                    <span class="public-payment-status">Menunggu Pembayaran</span>
                </div>

                <div class="public-payment-info-grid">
                    <div>
                        <small>Customer</small>
                        <strong><?= e($customer['name'] ?? '-') ?></strong>
                    </div>
                    <div>
                        <small>Staff</small>
                        <strong><?= e($staffMember['name'] ?? '-') ?></strong>
                    </div>
                    <div>
                        <small>Jadwal</small>
                        <strong><?= e($booking['start_at'] ?? '-') ?></strong>
                    </div>
                    <div>
                        <small>Status Saat Ini</small>
                        <strong><?= e($booking['status'] ?? '-') ?></strong>
                    </div>
                </div>

                <div class="public-payment-services">
                    <?php foreach ($services as $service): ?>
                        <div class="public-payment-service-row">
                            <div>
                                <strong><?= e($service['name']) ?></strong>
                                <span><?= e((string) ($service['duration'] ?? 0)) ?> menit</span>
                            </div>
                            <strong><?= money((float) ($service['price'] ?? 0)) ?></strong>
                        </div>
                    <?php endforeach; ?>
                </div>

                <form method="post" action="<?= e(url('/booking/payment')) ?>" class="public-payment-form">
                    <?= csrf_field() ?>
                    <input type="hidden" name="booking_id" value="<?= e((string) ($booking['id'] ?? 0)) ?>">

                    <div class="public-form-section">
                        <div class="public-form-section__head">
                            <span>Pilih Metode Pembayaran</span>
                            <small>Pembayaran sukses akan langsung mengaktifkan booking di kalender staff</small>
                        </div>
                        <div class="public-payment-methods">
                            <?php foreach (['QRIS', 'Transfer Bank', 'E-Wallet', 'Kartu'] as $method): ?>
                                <label class="public-payment-method">
                                    <input type="radio" name="payment_method" value="<?= e($method) ?>" <?= $method === 'QRIS' ? 'checked' : '' ?>>
                                    <span><?= e($method) ?></span>
                                </label>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <div class="public-payment-footer">
                        <div class="public-payment-total">
                            <small>Total Pembayaran</small>
                            <strong><?= money((float) ($total ?? 0)) ?></strong>
                        </div>
                        <button class="btn btn-dark rounded-pill px-4" type="submit">Bayar Sekarang</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="col-lg-5">
            <div class="soft-card public-aside-card h-100">
                <div class="public-aside-card__hero">
                    <span class="eyebrow">Flow Aktivasi</span>
                    <h2>Booking baru aktif setelah pembayaran selesai</h2>
                    <p>Jadwal akan tetap ditahan untuk customer ini, tapi baru ditampilkan ke kalender staff setelah langkah pembayaran diselesaikan.</p>
                </div>

                <div class="vstack gap-3">
                    <div class="timeline-item public-timeline-item"><strong>1</strong><span>Booking dibuat dan status awal menjadi menunggu pembayaran.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>2</strong><span>Customer menyelesaikan pembayaran di halaman ini.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>3</strong><span>Sistem mengubah status booking menjadi aktif.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>4</strong><span>Booking langsung masuk ke kalender staff yang dipilih.</span></div>
                </div>
            </div>
        </div>
    </div>
</section>
