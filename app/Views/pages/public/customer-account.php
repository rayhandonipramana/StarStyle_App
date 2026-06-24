<?php
$bookingCount = count($bookings ?? []);
$transactionCount = count($transactions ?? []);
$voucherCount = count($vouchers ?? []);
?>
<section class="container py-5">
    <div class="public-account-hero">
        <div>
            <span class="eyebrow">Customer Profile</span>
            <h1 class="section-title mb-2"><?= e($customer['name'] ?? '-') ?></h1>
            <p class="section-copy mb-0">Ringkasan akun customer untuk melihat histori reservasi, transaksi, voucher aktif, dan progress loyalty point.</p>
        </div>
        <a class="btn btn-dark rounded-pill px-4" href="<?= e(url('/booking')) ?>">Booking baru</a>
    </div>

    <div class="public-account-metrics">
        <div class="public-account-metric">
            <span>Total Booking</span>
            <strong><?= e((string) $bookingCount) ?></strong>
        </div>
        <div class="public-account-metric">
            <span>Total Transaksi</span>
            <strong><?= e((string) $transactionCount) ?></strong>
        </div>
        <div class="public-account-metric">
            <span>Voucher Aktif</span>
            <strong><?= e((string) $voucherCount) ?></strong>
        </div>
        <div class="public-account-metric">
            <span>Loyalty Point</span>
            <strong><?= e((string) ($customer['loyalty_points'] ?? 0)) ?></strong>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-4">
            <div class="page-card public-profile-card">
                <div class="public-profile-card__avatar"><i class="bi bi-person-circle"></i></div>
                <span class="eyebrow">Member Detail</span>
                <h2 class="section-title fs-3"><?= e($customer['name'] ?? '-') ?></h2>
                <div class="public-profile-list">
                    <div><span>Member ID</span><strong><?= e($customer['member_id'] ?? '-') ?></strong></div>
                    <div><span>Telepon</span><strong><?= e($customer['phone'] ?? '-') ?></strong></div>
                    <div><span>Email</span><strong><?= e($customer['email'] ?? '-') ?></strong></div>
                    <div><span>Status</span><strong><?= e($customer['status'] ?? 'Aktif') ?></strong></div>
                </div>
                <form method="post" action="<?= e(url('/customer/logout')) ?>" class="mt-4">
                    <?= csrf_field() ?>
                    <button class="btn btn-dark rounded-pill w-100" type="submit">Logout</button>
                </form>
            </div>
        </div>
        <div class="col-lg-8">
            <div class="page-card public-table-card mb-4">
                <div class="section-head mb-3">
                    <div>
                        <h2 class="section-title mb-1">Histori Booking</h2>
                        <p class="section-copy mb-0">Semua jadwal customer yang sudah masuk ke sistem StarStyle.</p>
                    </div>
                    <a class="btn btn-light rounded-pill" href="<?= e(url('/booking')) ?>">Booking baru</a>
                </div>
                <div class="table-responsive">
                    <table class="table align-middle public-table">
                        <thead><tr><th>Ref</th><th>Jadwal</th><th>Status</th></tr></thead>
                        <tbody>
                        <?php foreach ($bookings as $booking): ?>
                            <tr>
                                <td><?= e($booking['reference']) ?></td>
                                <td><?= e($booking['start_at']) ?></td>
                                <td><span class="badge text-bg-light"><?= e($booking['status']) ?></span></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="page-card">
                <div class="section-head mb-3">
                    <div>
                        <h2 class="section-title mb-1">Voucher Tersedia</h2>
                        <p class="section-copy mb-0">Promo aktif yang masih bisa dipakai untuk kunjungan berikutnya.</p>
                    </div>
                </div>
                <div class="row g-3">
                    <?php foreach ($vouchers as $voucher): ?>
                        <div class="col-md-6">
                            <div class="soft-card public-voucher-card h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong><?= e($voucher['code']) ?></strong>
                                    <span class="badge text-bg-light"><?= e($voucher['status']) ?></span>
                                </div>
                                <div class="text-muted small mt-2">Berlaku hingga <?= e($voucher['expired_at']) ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</section>
