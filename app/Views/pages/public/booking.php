<?php
$bookingBackUrl = auth()->check('customer') ? '/customer/account' : '/';
$bookingBackLabel = auth()->check('customer') ? 'Kembali ke beranda customer' : 'Kembali ke beranda';
$isCustomerLoggedIn = !empty($currentCustomer);
?>
<section class="container py-5">
    <div class="public-booking-back mb-4">
        <a class="public-booking-back__link" href="<?= e(url($bookingBackUrl)) ?>">
            <i class="bi bi-arrow-left"></i>
            <span><?= e($bookingBackLabel) ?></span>
        </a>
    </div>

    <div class="public-booking-hero mb-4">
        <div>
            <span class="eyebrow">Online Reservation</span>
            <h1 class="section-title mb-2">Reservasi salon yang lebih elegan, cepat, dan terasa personal</h1>
            <p class="section-copy mb-0">Kalau customer sudah login, data akun langsung dipakai otomatis. Tinggal pilih layanan, stylist, lalu cek slot yang tersedia tanpa isi biodata ulang.</p>
        </div>
        <div class="public-booking-hero__chips">
            <span><i class="bi bi-person-check"></i> Data customer otomatis</span>
            <span><i class="bi bi-grid-3x3-gap"></i> Layanan lebih visual</span>
            <span><i class="bi bi-phone"></i> Nyaman di mobile</span>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-lg-7">
            <div class="page-card public-booking-card">
                <div class="public-booking-card__top">
                    <div class="public-booking-card__intro">
                        <span class="eyebrow">Booking Form</span>
                        <h2>Atur kunjunganmu dalam beberapa langkah cepat</h2>
                        <p>Pilih treatment yang diinginkan, tentukan stylist, lalu cek slot real-time sebelum booking dikirim ke tim salon.</p>
                    </div>
                    <div class="public-inline-badge">
                        <i class="bi bi-shield-check"></i>
                        <span>Booking diproses aman</span>
                    </div>
                </div>

                <div class="public-booking-summary">
                    <div class="public-booking-summary__item">
                        <small>Step 1</small>
                        <strong>Pilih layanan</strong>
                        <span>Treatment ditampilkan sebagai cards agar lebih enak dipilih.</span>
                    </div>
                    <div class="public-booking-summary__item">
                        <small>Step 2</small>
                        <strong>Tentukan stylist</strong>
                        <span>Slot akan dicek sesuai staff yang dipilih.</span>
                    </div>
                    <div class="public-booking-summary__item">
                        <small>Step 3</small>
                        <strong>Konfirmasi jadwal</strong>
                        <span>Validasi anti double-booking tetap berjalan.</span>
                    </div>
                </div>

                <form method="post" action="<?= e(url('/booking')) ?>" class="row g-3 js-booking-form public-booking-form">
                    <?= csrf_field() ?>

                    <div class="col-12">
                        <div class="public-form-section">
                            <div class="public-form-section__head">
                                <span>Informasi Customer</span>
                                <small><?= $isCustomerLoggedIn ? 'Data diambil langsung dari akun customer yang sedang login' : 'Isi data dasar untuk proses reservasi' ?></small>
                            </div>

                            <?php if ($isCustomerLoggedIn): ?>
                                <input type="hidden" name="customer_name" value="<?= e($currentCustomer['name'] ?? '') ?>">
                                <input type="hidden" name="customer_phone" value="<?= e($currentCustomer['phone'] ?? '') ?>">
                                <div class="public-customer-identity">
                                    <div class="public-customer-identity__main">
                                        <div class="public-customer-identity__avatar"><i class="bi bi-person-circle"></i></div>
                                        <div>
                                            <strong><?= e($currentCustomer['name'] ?? '-') ?></strong>
                                            <span><?= e($currentCustomer['member_id'] ?? '-') ?></span>
                                        </div>
                                    </div>
                                    <div class="public-customer-identity__meta">
                                        <div>
                                            <small>Telepon</small>
                                            <strong><?= e($currentCustomer['phone'] ?? '-') ?></strong>
                                        </div>
                                        <div>
                                            <small>Email</small>
                                            <strong><?= e($currentCustomer['email'] ?? '-') ?></strong>
                                        </div>
                                    </div>
                                </div>
                            <?php else: ?>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label public-form-label">Nama Pelanggan</label>
                                        <input class="form-control public-form-control" type="text" name="customer_name" placeholder="Nama lengkap">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label public-form-label">Telepon</label>
                                        <input class="form-control public-form-control" type="text" name="customer_phone" placeholder="08xx">
                                    </div>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="col-12">
                        <div class="public-form-section">
                            <div class="public-form-section__head">
                                <span>Pilih Layanan</span>
                                <small>Bisa pilih lebih dari satu treatment dalam sekali booking</small>
                            </div>
                            <div class="public-service-picker">
                                <?php foreach (($serviceGroups ?? []) as $bundle): ?>
                                    <div class="public-service-picker__group">
                                        <div class="public-service-picker__group-head">
                                            <strong><?= e($bundle['group']['name']) ?></strong>
                                            <span><?= e((string) count($bundle['services'])) ?> layanan</span>
                                        </div>
                                        <div class="public-service-picker__grid">
                                            <?php foreach ($bundle['services'] as $service): ?>
                                                <label class="public-service-option">
                                                    <input class="js-booking-service" type="checkbox" name="service_ids[]" value="<?= e((string) $service['id']) ?>">
                                                    <span class="public-service-option__card">
                                                        <span class="public-service-option__top">
                                                            <span class="public-service-option__status"><?= e($service['status']) ?></span>
                                                            <span class="public-service-option__duration"><i class="bi bi-clock-history"></i> <?= e((string) $service['duration']) ?> menit</span>
                                                        </span>
                                                        <span class="public-service-option__body">
                                                            <strong><?= e($service['name']) ?></strong>
                                                            <small><?= e($service['description']) ?></small>
                                                        </span>
                                                        <span class="public-service-option__variants">
                                                            <?php foreach (array_slice($service['variants'], 0, 3) as $variant): ?>
                                                                <em><?= e($variant) ?></em>
                                                            <?php endforeach; ?>
                                                        </span>
                                                        <span class="public-service-option__bottom">
                                                            <span class="public-service-option__price"><?= money($service['price']) ?></span>
                                                            <span class="public-service-option__check"><i class="bi bi-check2"></i></span>
                                                        </span>
                                                    </span>
                                                </label>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <div class="form-text public-form-help">Tap layanan untuk memilih. Kamu bisa memilih beberapa treatment sekaligus.</div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div class="public-form-section">
                            <div class="public-form-section__head">
                                <span>Stylist & Jadwal</span>
                                <small>Pilih staff lalu cek slot yang masih tersedia</small>
                            </div>
                            <div class="row g-3">
                                <div class="col-lg-6">
                                    <label class="form-label public-form-label">Staff</label>
                                    <select class="form-select public-form-control js-staff-services" name="staff_id">
                                        <option value="">Pilih staff</option>
                                        <?php foreach ($staff as $member): ?>
                                            <option value="<?= e((string) $member['id']) ?>"><?= e($member['name']) ?> - <?= e($member['role']) ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div class="col-sm-6 col-lg-3">
                                    <label class="form-label public-form-label">Tanggal</label>
                                    <input class="form-control public-form-control js-datepicker" type="text" name="date" value="<?= e(date('Y-m-d')) ?>">
                                </div>
                                <div class="col-sm-6 col-lg-3">
                                    <label class="form-label public-form-label">Jam</label>
                                    <select class="form-select public-form-control js-availability-target" name="time">
                                        <option value="">Pilih slot</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label public-form-label">Catatan</label>
                                    <textarea class="form-control public-form-control public-form-control--textarea" name="notes" rows="4" placeholder="Contoh: ingin hair stylist tertentu, ada preferensi treatment, atau request khusus lainnya"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div class="public-booking-actions">
                            <button class="btn btn-light rounded-pill px-4 js-load-slots" type="button">Cek Ketersediaan</button>
                            <button class="btn btn-dark rounded-pill px-4" type="submit">Konfirmasi Booking</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div class="col-lg-5">
            <div class="soft-card public-aside-card h-100">
                <div class="public-aside-card__hero">
                    <span class="eyebrow">Booking Journey</span>
                    <h2>Flow reservasi yang enak dipakai di desktop maupun mobile</h2>
                    <p>Halaman ini dioptimalkan supaya customer tinggal pilih layanan secara visual, lalu lanjut ke stylist dan jadwal tanpa terasa penuh atau kolot.</p>
                </div>

                <div class="vstack gap-3">
                    <div class="timeline-item public-timeline-item"><strong>1</strong><span>Customer login tidak perlu isi ulang data pribadi saat booking.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>2</strong><span>Pilihan layanan dibuat dalam bentuk cards agar cepat dipindai dan nyaman di-tap pada mobile.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>3</strong><span>Pilih stylist dan cek slot secara real-time berdasarkan layanan yang dipilih.</span></div>
                    <div class="timeline-item public-timeline-item"><strong>4</strong><span>Booking masuk sebagai <em>pending</em> dan tampil di dashboard internal untuk diproses tim salon.</span></div>
                </div>

                <div class="public-info-stack mt-4">
                    <div>
                        <small>Tips</small>
                        <strong>Cek slot setelah pilih layanan dan staff</strong>
                        <span>Semakin lengkap pilihanmu, semakin akurat slot yang ditampilkan sistem.</span>
                    </div>
                    <div>
                        <small>Mobile Friendly</small>
                        <strong>Semua card bisa di-tap langsung</strong>
                        <span>Layout form, selector layanan, dan tombol aksi dirapikan agar nyaman di layar kecil.</span>
                    </div>
                </div>

                <div class="public-booking-note">
                    <strong><i class="bi bi-info-circle"></i> Setelah submit</strong>
                    <span>Tim salon akan melihat booking ini di dashboard dan melanjutkan proses konfirmasi sesuai slot yang kamu pilih.</span>
                </div>
            </div>
        </div>
    </div>
</section>
