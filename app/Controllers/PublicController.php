<?php

declare(strict_types=1);

namespace App\Controllers;

final class PublicController extends BaseController
{
    public function home(): void
    {
        $this->view('pages/public/home', array_merge($this->repo()->getLandingData(), [
            'title' => 'StarStyle Salon',
            'page' => '/',
            'publicNav' => config('public_nav'),
            'success' => flash('success'),
            'error' => flash('error'),
        ]), 'public');
    }

    public function services(): void
    {
        $groups = [];

        foreach ($this->repo()->getServiceGroups() as $group) {
            $groups[] = [
                'group' => $group,
                'services' => array_values(array_filter($this->repo()->getServices(), fn (array $service): bool => $service['group_id'] === $group['id'])),
            ];
        }

        $this->view('pages/public/services', [
            'title' => 'Daftar Layanan',
            'page' => '/services-catalog',
            'publicNav' => config('public_nav'),
            'groups' => $groups,
        ], 'public');
    }

    public function booking(): void
    {
        $customerUser = $this->auth()->user('customer');
        $currentCustomer = $customerUser !== null
            ? $this->repo()->findCustomer((int) ($customerUser['customer_id'] ?? 0))
            : null;
        $serviceGroups = [];

        foreach ($this->repo()->getServiceGroups() as $group) {
            $serviceGroups[] = [
                'group' => $group,
                'services' => array_values(array_filter($this->repo()->getServices(), fn (array $service): bool => $service['group_id'] === $group['id'])),
            ];
        }

        $this->view('pages/public/booking', [
            'title' => 'Reservasi Salon',
            'page' => '/booking',
            'publicNav' => config('public_nav'),
            'services' => $this->repo()->getServices(),
            'serviceGroups' => $serviceGroups,
            'staff' => $this->repo()->getStaff(),
            'currentCustomer' => $currentCustomer,
            'success' => flash('success'),
            'error' => flash('error'),
        ], 'public');
    }

    public function createBooking(): void
    {
        verify_csrf();
        $result = $this->repo()->createBooking($_POST, 'customer');
        flash($result['success'] ? 'success' : 'error', $result['message']);
        $this->redirect('/booking');
    }

    public function customerLogin(): void
    {
        $this->view('pages/public/customer-login', [
            'title' => 'Login Pelanggan',
            'page' => '/customer/login',
            'publicNav' => config('public_nav'),
            'success' => flash('success'),
            'error' => flash('error'),
        ], 'public');
    }

    public function authenticateCustomer(): void
    {
        verify_csrf();
        $ok = $this->auth()->attempt((string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''), 'customer');

        if (!$ok) {
            flash('error', 'Akun pelanggan tidak ditemukan.');
            $this->redirect('/customer/login');
        }

        flash('success', 'Login pelanggan berhasil.');
        $this->redirect('/customer/account');
    }

    public function customerAccount(): void
    {
        $user = $this->customerUser();
        $account = $this->repo()->customerAccount((int) $user['customer_id']);

        $this->view('pages/public/customer-account', [
            'title' => 'Akun Pelanggan',
            'page' => '/customer/account',
            'publicNav' => config('public_nav'),
            'success' => flash('success'),
            'error' => flash('error'),
        ] + $account, 'public');
    }

    public function customerLogout(): void
    {
        $this->auth()->logout('customer');
        flash('success', 'Sampai jumpa lagi.');
        $this->redirect('/');
    }
}
