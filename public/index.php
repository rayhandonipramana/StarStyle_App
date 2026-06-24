<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Controllers\AdminController;
use App\Controllers\ApiController;
use App\Controllers\AuthController;
use App\Controllers\PublicController;
use App\Core\Router;

$router = new Router();

$router->get('/', [PublicController::class, 'home']);
$router->get('/services-catalog', [PublicController::class, 'services']);
$router->get('/booking', [PublicController::class, 'booking']);
$router->post('/booking', [PublicController::class, 'createBooking']);
$router->get('/booking/payment', [PublicController::class, 'payment']);
$router->post('/booking/payment', [PublicController::class, 'completePayment']);
$router->get('/customer/login', [PublicController::class, 'customerLogin']);
$router->post('/customer/login', [PublicController::class, 'authenticateCustomer']);
$router->get('/customer/account', [PublicController::class, 'customerAccount']);
$router->post('/customer/logout', [PublicController::class, 'customerLogout']);

$router->get('/login', [AuthController::class, 'login']);
$router->post('/login', [AuthController::class, 'authenticate']);
$router->post('/logout', [AuthController::class, 'logout']);

$router->get('/dashboard', [AdminController::class, 'dashboard']);
$router->get('/account', [AdminController::class, 'account']);
$router->get('/calendar', [AdminController::class, 'calendar']);
$router->post('/calendar/bookings', [AdminController::class, 'createInternalBooking']);
$router->post('/calendar/bookings/update', [AdminController::class, 'updateInternalBooking']);
$router->post('/calendar/bookings/status', [AdminController::class, 'updateBookingStatus']);
$router->post('/calendar/blocks', [AdminController::class, 'createBlock']);
$router->post('/calendar/blocks/update', [AdminController::class, 'updateBlock']);
$router->post('/calendar/blocks/delete', [AdminController::class, 'deleteBlock']);
$router->get('/sales', [AdminController::class, 'sales']);
$router->post('/sales/checkout', [AdminController::class, 'checkout']);
$router->get('/customers', [AdminController::class, 'customers']);
$router->get('/staff', [AdminController::class, 'staff']);
$router->get('/services', [AdminController::class, 'services']);
$router->get('/inventory', [AdminController::class, 'inventory']);
$router->get('/vouchers', [AdminController::class, 'vouchers']);
$router->get('/analytics', [AdminController::class, 'analytics']);
$router->get('/reviews', [AdminController::class, 'reviews']);
$router->get('/settings', [AdminController::class, 'settings']);
$router->post('/settings/staff-permissions', [AdminController::class, 'updateStaffPermissions']);

$router->get('/api/calendar/events', [ApiController::class, 'calendarEvents']);
$router->get('/api/bookings/availability', [ApiController::class, 'availability']);
$router->get('/api/customers/search', [ApiController::class, 'customerSearch']);
$router->get('/api/services/by-staff', [ApiController::class, 'staffServices']);
$router->get('/api/vouchers/validate', [ApiController::class, 'validateVoucher']);
$router->get('/api/dashboard/kpis', [ApiController::class, 'dashboardKpis']);
$router->post('/api/pos/calculate', [ApiController::class, 'posCalculate']);
$router->get('/api/settings/staff-permissions', [ApiController::class, 'staffPermissions']);
$router->post('/api/inventory/master/save', [ApiController::class, 'inventoryMasterSave']);
$router->post('/api/inventory/master/delete', [ApiController::class, 'inventoryMasterDelete']);
$router->post('/api/inventory/suppliers/save', [ApiController::class, 'inventorySupplierSave']);
$router->post('/api/inventory/suppliers/delete', [ApiController::class, 'inventorySupplierDelete']);
$router->post('/api/inventory/products/save', [ApiController::class, 'inventoryProductSave']);
$router->get('/api/inventory/products/history', [ApiController::class, 'inventoryProductHistory']);
$router->post('/api/inventory/products/adjust-stock', [ApiController::class, 'inventoryProductAdjustStock']);
$router->post('/api/inventory/purchases/create', [ApiController::class, 'inventoryPurchaseCreate']);
$router->post('/api/inventory/purchases/receive', [ApiController::class, 'inventoryPurchaseReceive']);
$router->post('/api/inventory/purchases/cancel', [ApiController::class, 'inventoryPurchaseCancel']);
$router->post('/api/inventory/opnames/save', [ApiController::class, 'inventoryOpnameSave']);
$router->post('/api/inventory/opnames/recount', [ApiController::class, 'inventoryOpnameRecount']);
$router->post('/api/inventory/opnames/cancel', [ApiController::class, 'inventoryOpnameCancel']);
$router->post('/api/inventory/opnames/complete', [ApiController::class, 'inventoryOpnameComplete']);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
