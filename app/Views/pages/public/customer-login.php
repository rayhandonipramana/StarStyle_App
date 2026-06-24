<section class="container py-5">
    <div class="public-login-shell">
        <div class="public-login-panel public-login-panel--visual">
            <span class="eyebrow">Portal Pelanggan</span>
            <h1 class="section-title">Semua riwayat treatment, booking, dan voucher ada di satu tempat.</h1>
            <p class="section-copy">Masuk untuk cek histori kunjungan, loyalty point, dan akses booking berikutnya dengan lebih cepat.</p>
            <div class="public-login-highlights">
                <div>
                    <strong><i class="bi bi-calendar2-heart"></i> Histori booking</strong>
                    <span>Lihat jadwal yang sudah lalu dan booking berikutnya.</span>
                </div>
                <div>
                    <strong><i class="bi bi-ticket-perforated"></i> Voucher aktif</strong>
                    <span>Pantau promo yang masih bisa dipakai sebelum expired.</span>
                </div>
                <div>
                    <strong><i class="bi bi-gem"></i> Loyalty point</strong>
                    <span>Semua progress kunjungan tersimpan lebih rapi.</span>
                </div>
            </div>
        </div>
        <div class="public-login-panel public-login-panel--form">
            <div class="page-card public-login-card">
                <span class="eyebrow">Sign In</span>
                <h2 class="section-title">Masuk ke akun customer</h2>
                <p class="text-muted">Gunakan email customer untuk melihat histori booking, transaksi, voucher, dan loyalty point.</p>
                <div class="soft-card public-demo-card mb-4">
                    <strong>Demo Account</strong>
                    <div class="small text-muted">customer@starstyle.test / password123</div>
                </div>
                <form method="post" action="<?= e(url('/customer/login')) ?>" class="vstack gap-3">
                    <?= csrf_field() ?>
                    <div>
                        <label class="form-label">Email</label>
                        <input class="form-control" type="email" name="email" placeholder="customer@starstyle.test">
                    </div>
                    <div>
                        <label class="form-label">Password</label>
                        <input class="form-control" type="password" name="password" placeholder="password123">
                    </div>
                    <button class="btn btn-dark rounded-pill" type="submit">Masuk</button>
                </form>
            </div>
        </div>
    </div>
</section>
