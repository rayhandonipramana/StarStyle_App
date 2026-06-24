<?php

declare(strict_types=1);

namespace App\Controllers;

final class AdminController extends BaseController
{
    public function dashboard(): void
    {
        $this->authorize('dashboard.view');
        $range = (string) ($_GET['range'] ?? '7d');
        $this->internalPage('pages/admin/dashboard', 'Beranda', [
            'range' => $range,
            'data' => $this->repo()->dashboard($range),
            'presets' => config('date_presets'),
        ]);
    }

    public function account(): void
    {
        $user = $this->internalUser();
        $staff = isset($user['staff_id']) ? $this->repo()->findStaff((int) $user['staff_id']) : null;

        $this->internalPage('pages/admin/account', 'My Account', [
            'accountUser' => $user,
            'accountStaff' => $staff,
        ]);
    }

    public function calendar(): void
    {
        $this->authorize('calendar.view');
        $date = (string) ($_GET['date'] ?? date('Y-m-d'));
        $this->internalPage('pages/admin/calendar', 'Kalender', [
            'calendar' => $this->repo()->calendar($date),
            'services' => $this->repo()->getServices(),
        ]);
    }

    public function createInternalBooking(): void
    {
        $this->authorize('calendar.create');
        verify_csrf();
        $result = $this->repo()->createBooking($_POST, 'internal');
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/calendar');
    }

    public function updateInternalBooking(): void
    {
        $this->authorize('calendar.create');
        verify_csrf();
        $result = $this->repo()->updateBooking($_POST, $this->internalUser());
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/calendar');
    }

    public function updateBookingStatus(): void
    {
        $this->authorize('calendar.create');
        verify_csrf();
        $bookingId = (int) ($_POST['booking_id'] ?? 0);
        $status = (string) ($_POST['status'] ?? '');
        $result = $this->repo()->updateBookingStatus($bookingId, $status, $this->internalUser());
        $this->json($result, $result['success'] ? 200 : 422);
    }

    public function createBlock(): void
    {
        $this->authorize('calendar.block');
        verify_csrf();
        $result = $this->repo()->createBlock($_POST, $this->internalUser());
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/calendar');
    }

    public function updateBlock(): void
    {
        $this->authorize('calendar.block');
        verify_csrf();
        $result = $this->repo()->updateBlock($_POST, $this->internalUser());
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/calendar');
    }

    public function deleteBlock(): void
    {
        $this->authorize('calendar.block');
        verify_csrf();
        $result = $this->repo()->deleteBlock($_POST, $this->internalUser());
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/calendar');
    }

    public function sales(): void
    {
        $this->authorize('sales.view');
        $this->internalPage('pages/admin/sales', 'Penjualan', $this->repo()->sales());
    }

    public function checkout(): void
    {
        $this->authorize('sales.checkout');
        verify_csrf();
        $result = $this->repo()->checkout($_POST, $this->internalUser());
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/sales');
    }

    public function customers(): void
    {
        $this->authorize('customers.view');
        $this->internalPage('pages/admin/customers', 'Pelanggan', [
            'customers' => $this->repo()->getCustomers(),
        ]);
    }

    public function staff(): void
    {
        $this->authorize('staff.view');
        $this->internalPage('pages/admin/staff', 'Staf', $this->repo()->staffDirectory());
    }

    public function services(): void
    {
        $this->authorize('services.view');
        $this->internalPage('pages/admin/services', 'Layanan', [
            'groups' => $this->repo()->getServiceGroups(),
            'services' => $this->repo()->getServices(),
            'packages' => $this->repo()->getPackages(),
        ]);
    }

    public function inventory(): void
    {
        $this->authorize('inventory.view');
        $this->internalPage('pages/admin/inventory', 'Inventori', $this->repo()->inventoryPayload());
    }

    public function vouchers(): void
    {
        $this->authorize('vouchers.view');
        $this->internalPage('pages/admin/vouchers', 'Voucher', [
            'vouchers' => $this->repo()->getVouchers(),
            'classes' => $this->repo()->getClasses(),
            'services' => $this->repo()->getServices(),
        ]);
    }

    public function analytics(): void
    {
        $this->authorize('analytics.view');
        $this->internalPage('pages/admin/analytics', 'Analitik', $this->repo()->analytics());
    }

    public function reviews(): void
    {
        $this->authorize('reviews.view');
        $this->internalPage('pages/admin/reviews', 'Review & Logs', [
            'reviews' => $this->repo()->getReviews(),
            'logs' => $this->repo()->getLogs(),
            'notifications' => $this->repo()->getNotifications(),
        ]);
    }

    public function settings(): void
    {
        $this->authorize('settings.view');
        $this->internalPage('pages/admin/settings', 'Settings', $this->repo()->settingsPayload());
    }

    public function updateStaffPermissions(): void
    {
        $this->authorize('settings.permissions');
        verify_csrf();

        $staffId = (int) ($_POST['staff_id'] ?? 0);
        $granted = array_map('strval', $_POST['permissions'] ?? []);

        $this->repo()->updateStaffPermissions($staffId, $granted, $this->internalUser()['name']);
        flash('success', 'Hak akses staff berhasil diperbarui.');
        $this->redirect('/settings');
    }
}
