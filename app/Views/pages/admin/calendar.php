<?php
$startHour = 0;
$endHour = 23;
$intervalMinutes = 5;
$pixelsPerMinute = 2; // 120px per jam (60 menit * 2)
$slots = [];

for ($hour = $startHour; $hour <= $endHour; $hour++) {
    for ($minute = 0; $minute < 60; $minute += $intervalMinutes) {
        $slots[] = sprintf('%02d:%02d', $hour, $minute);
    }
}

$minutesFromStart = static function (string $dateTime) use ($startHour): int {
    $hour = (int) substr($dateTime, 11, 2);
    $minute = (int) substr($dateTime, 14, 2);

    return (($hour - $startHour) * 60) + $minute;
};

$serviceMap = [];
foreach ($services as $service) {
    $serviceMap[$service['id']] = $service;
}
$normalizeCalendarServiceName = static function (string $name): string {
    $name = trim((string) preg_replace('/\s*\(\)\s*$/', '', $name));

    return strtolower(preg_replace('/\s+/', ' ', $name) ?? $name);
};
$serviceNameMap = [];
foreach ($services as $service) {
    $serviceNameMap[$normalizeCalendarServiceName((string) $service['name'])] = $service;
}

$customerMap = [];
foreach (app('repository')->getCustomers() as $customer) {
    $customerMap[$customer['id']] = $customer;
}
$customers = array_values($customerMap);
$agendaServiceCategory = static function (array $service): string {
    $name = strtolower((string) $service['name']);
    $groupId = (int) ($service['group_id'] ?? 0);

    if ($groupId === 2 || str_contains($name, 'color') || str_contains($name, 'balayage')) {
        return 'hair-coloring';
    }

    if ($groupId === 3 || str_contains($name, 'spa') || str_contains($name, 'repair') || str_contains($name, 'treatment')) {
        return 'hair-treatment';
    }

    return 'hair-cut';
};

$selectedTime = $calendar['now'] ?: '09:00';
$selectedEndTime = $selectedTime;
try {
    $selectedEndTime = (new DateTimeImmutable('2000-01-01 ' . $selectedTime))
        ->modify('+30 minutes')
        ->format('H:i');
} catch (Throwable $exception) {
    $selectedEndTime = '09:30';
}
$indicatorOffset = null;
$calendarView = (string) ($_GET['view'] ?? 'week');
$calendarView = in_array($calendarView, ['schedule', 'week', 'day'], true) ? $calendarView : 'week';
$calendarFilter = (string) ($_GET['filter'] ?? 'all');
$calendarFilter = in_array($calendarFilter, ['all', 'services', 'blocked'], true) ? $calendarFilter : 'all';
$isDayView = $calendarView === 'day';
$isWeekView = $calendarView === 'week';
$isScheduleView = $calendarView === 'schedule';
$showServices = in_array($calendarFilter, ['all', 'services'], true);
$showBlocks = in_array($calendarFilter, ['all', 'blocked'], true);

if (!empty($calendar['now'])) {
    [$nowHour, $nowMinute] = array_map('intval', explode(':', $calendar['now']));
    if ($nowHour >= $startHour && $nowHour <= $endHour) {
        $indicatorOffset = ((($nowHour - $startHour) * 60) + $nowMinute) * $pixelsPerMinute;
    }
}

$requestedStaffId = isset($_GET['staff_id']) ? (int) $_GET['staff_id'] : null;
$activeStaff = $calendar['staff'][0] ?? ['id' => 1, 'name' => 'Rayhan Doni Pramana', 'role' => 'Staf'];

foreach ($calendar['staff'] as $staffMember) {
    if ((int) $staffMember['id'] === $requestedStaffId) {
        $activeStaff = $staffMember;
        break;
    }
}

$staffMap = [];
foreach ($calendar['staff'] as $staffMember) {
    $staffMap[(int) $staffMember['id']] = $staffMember;
}

$selectedDate = new DateTimeImmutable($calendar['date'] ?? date('Y-m-d'));
$weekStart = $selectedDate->modify('-' . $selectedDate->format('w') . ' days');
$weekEnd = $weekStart->modify('+6 days');
$dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
$weekDays = [];

for ($day = 0; $day < 7; $day++) {
    $date = $weekStart->modify("+{$day} days");
    $weekDays[] = [
        'date' => $date->format('Y-m-d'),
        'name' => $dayNames[$day],
        'label' => $date->format('d M'),
    ];
}

$weekRangeLabel = $weekStart->format('d M') . ' - ' . $weekEnd->format('d M, Y');
$dayLabel = $selectedDate->format('d M Y');
$previousDate = $isDayView ? $selectedDate->modify('-1 day') : $weekStart->modify('-7 days');
$nextDate = $isDayView ? $selectedDate->modify('+1 day') : $weekStart->modify('+7 days');
$staffQuery = $requestedStaffId ? '&staff_id=' . $requestedStaffId : '';
$filterQuery = $calendarFilter !== 'all' ? '&filter=' . $calendarFilter : '';
$calendarFilterOptions = [
    'all' => ['label' => 'All', 'icon' => null],
    'services' => ['label' => 'Services', 'icon' => 'bi-scissors'],
    'blocked' => ['label' => 'Blocked Times', 'icon' => 'bi-slash-circle'],
];
$agendaResources = [
    ['id' => 'resource-1', 'name' => 'Sumberdaya 1'],
    ['id' => 'resource-2', 'name' => 'Sumberdaya 2'],
    ['id' => 'resource-3', 'name' => 'Sumberdaya 3'],
];
$agendaDiscountRows = [
    [
        'id' => 1,
        'name' => 'Diskon 20%',
        'mode' => 'percent',
        'amount' => 20,
        'amount_label' => '20.00 %',
        'max_discount' => 0,
    ],
    [
        'id' => 2,
        'name' => 'Diskon Mei Happy',
        'mode' => 'amount',
        'amount' => 20000,
        'amount_label' => 'Rp 20.000,00',
        'max_discount' => 0,
    ],
];
$agendaOwnedVouchers = [
    [
        'id' => 'svc-bday',
        'owner' => 'nalendra',
        'type' => 'service',
        'type_label' => 'Service Voucher',
        'name' => 'Diskon Ulang Tahun',
        'service_label' => 'Potong rambut pria -',
        'service_names' => ['Potong rambut pria ()'],
        'remaining' => 1,
        'total' => 1,
        'expiry_date' => '2026-06-09',
        'location' => 'Star Salon',
        'code' => 'SV-001',
        'status' => 'active',
    ],
    [
        'id' => 'gift-30k',
        'owner' => 'nalendra',
        'type' => 'gift',
        'type_label' => 'voucher gift',
        'name' => 'voucher gift',
        'remaining_value' => 30000,
        'expiry_date' => '2026-06-07',
        'location' => 'Star Salon',
        'code' => 'GV-001',
        'status' => 'active',
    ],
    [
        'id' => 'svc-promo',
        'owner' => 'nalendra',
        'type' => 'service',
        'type_label' => 'Service Voucher',
        'name' => 'Potong Rambut Promo',
        'service_label' => 'Potong rambut pria -',
        'service_names' => ['Potong rambut pria ()'],
        'remaining' => 3,
        'total' => 3,
        'expiry_date' => '2026-06-07',
        'location' => 'Star Salon',
        'code' => 'SV-002',
        'status' => 'active',
    ],
    [
        'id' => 'gift-juni',
        'owner' => 'nalendra',
        'type' => 'gift',
        'type_label' => 'Diskon Juni',
        'name' => 'Diskon Juni',
        'remaining_value' => 20000,
        'expiry_date' => '2026-06-07',
        'location' => 'Star Salon',
        'code' => 'GV-002',
        'status' => 'active',
    ],
    [
        'id' => 'svc-mei',
        'owner' => 'nalendra',
        'type' => 'service',
        'type_label' => 'Service Voucher',
        'name' => 'Diskon Mei',
        'service_label' => 'Cat rambut full -',
        'service_names' => ['Cat rambut full ()'],
        'remaining' => 0,
        'total' => 1,
        'expiry_date' => '2026-05-14',
        'location' => 'Star Salon',
        'code' => 'SV-003',
        'status' => 'used',
    ],
    [
        'id' => 'gift-other',
        'owner' => 'Daniel',
        'type' => 'gift',
        'type_label' => 'voucher gift',
        'name' => 'voucher gift',
        'remaining_value' => 15000,
        'expiry_date' => '2026-06-05',
        'location' => 'Star Salon',
        'code' => 'GV-009',
        'status' => 'active',
    ],
];
$agendaFindService = static function (string $name, array $fallback = []) use ($serviceNameMap, $normalizeCalendarServiceName): array {
    $service = $serviceNameMap[$normalizeCalendarServiceName($name)] ?? null;
    if (is_array($service)) {
        return $service;
    }

    return $fallback;
};
$agendaSalesServices = [
    array_merge([
        'id' => 'sales-service-1',
        'name' => 'Cat rambut full ()',
        'price' => 300000,
        'duration' => 180,
        'category' => 'hair-coloring',
        'category_label' => 'Hair Coloring',
        'initials' => 'CC',
        'gender' => null,
        'kind' => 'service',
    ], $agendaFindService('Cat rambut full ()')),
    array_merge([
        'id' => 'sales-service-2',
        'name' => 'Creambath ()',
        'price' => 100000,
        'duration' => 120,
        'category' => 'hair-treatment',
        'category_label' => 'Hair Treatment',
        'initials' => 'CC',
        'gender' => null,
        'kind' => 'service',
    ], $agendaFindService('Creambath ()')),
    array_merge([
        'id' => 'sales-service-3',
        'name' => 'Hair spa ()',
        'price' => 120000,
        'duration' => 120,
        'category' => 'hair-treatment',
        'category_label' => 'Hair Treatment',
        'initials' => 'HH',
        'gender' => null,
        'kind' => 'service',
    ], $agendaFindService('Hair spa ()')),
    array_merge([
        'id' => 'sales-service-4',
        'name' => 'Potong rambut pria ()',
        'price' => 50000,
        'duration' => 60,
        'category' => 'hair-cut',
        'category_label' => 'Hair Cut',
        'initials' => 'PP',
        'gender' => 'male',
        'kind' => 'service',
    ], $agendaFindService('Potong rambut pria ()')),
    array_merge([
        'id' => 'sales-service-5',
        'name' => 'Potong rambut Wanita ()',
        'price' => 50000,
        'duration' => 60,
        'category' => 'hair-cut',
        'category_label' => 'Hair Cut',
        'initials' => 'PP',
        'gender' => 'female',
        'kind' => 'service',
    ], $agendaFindService('Potong rambut Wanita ()')),
];
$agendaSalesPackages = [
    [
        'id' => 'package-1',
        'kind' => 'package',
        'name' => 'test paket',
        'description' => 'Potong rambut pria -, Cat rambut full -',
        'price' => 350000,
        'duration' => 240,
        'category' => 'hair-cut',
        'category_label' => 'Hair Cut',
        'initials' => ['CC', 'CC'],
    ],
];
$agendaSalesProducts = [
    [
        'id' => 'product-1',
        'kind' => 'product',
        'name' => 'Hair Serum Wardah',
        'variant' => 'Per Pump',
        'brand' => 'Wardah',
        'stock' => 8,
        'price' => 2000,
        'category' => 'all',
        'category_label' => 'Semua',
    ],
    [
        'id' => 'product-2',
        'kind' => 'product',
        'name' => 'Hair Serum Wardah',
        'variant' => '500ml',
        'brand' => 'Wardah',
        'stock' => 10,
        'price' => 30000,
        'category' => 'all',
        'category_label' => 'Semua',
    ],
];
$agendaSalesVoucherCatalog = [
    [
        'id' => 'voucher-sales-1',
        'kind' => 'voucher',
        'voucher_kind' => 'service',
        'name' => 'Potong Rambut Promo',
        'subtitle' => 'Setelah 1 Bulan',
        'price' => 50000,
        'badge' => 'S',
        'badge_color' => 'yellow',
        'category' => 'service',
    ],
    [
        'id' => 'voucher-sales-2',
        'kind' => 'voucher',
        'voucher_kind' => 'service',
        'name' => 'Diskon Ulang Tahun',
        'subtitle' => 'Setelah 1 Bulan',
        'price' => 50000,
        'badge' => 'S',
        'badge_color' => 'yellow',
        'category' => 'service',
    ],
    [
        'id' => 'voucher-sales-3',
        'kind' => 'voucher',
        'voucher_kind' => 'gift',
        'name' => 'Diskon Juni',
        'subtitle' => 'Setelah 1 Bulan',
        'price' => 20000,
        'badge' => 'G',
        'badge_color' => 'green',
        'category' => 'gift',
    ],
    [
        'id' => 'voucher-sales-4',
        'kind' => 'voucher',
        'voucher_kind' => 'service',
        'name' => 'Diskon Mei',
        'subtitle' => 'Setelah 1 Minggu',
        'price' => 300000,
        'badge' => 'S',
        'badge_color' => 'yellow',
        'category' => 'class',
    ],
];
$agendaSalesPayables = [
    [
        'id' => 'payable-1',
        'kind' => 'payable',
        'customer' => 'Walk-In',
        'date' => '09 Mei 2026',
        'amount' => 50000,
        'qty' => 1,
        'badge' => 'NEW',
    ],
    [
        'id' => 'payable-2',
        'kind' => 'payable',
        'customer' => 'nalendra',
        'date' => '08 Mei 2026',
        'amount' => 300000,
        'qty' => 1,
        'badge' => 'NEW',
    ],
    [
        'id' => 'payable-3',
        'kind' => 'payable',
        'customer' => 'Walk-In',
        'date' => '08 Mei 2026',
        'amount' => 300000,
        'qty' => 1,
        'badge' => 'NEW',
    ],
    [
        'id' => 'payable-4',
        'kind' => 'payable',
        'customer' => 'Walk-In',
        'date' => '07 Mei 2026',
        'amount' => 300000,
        'qty' => 1,
        'badge' => 'NEW',
    ],
];
$agendaSalesPlans = [];
$agendaSalesCatalogs = [
    'services' => $agendaSalesServices,
    'packages' => $agendaSalesPackages,
    'products' => $agendaSalesProducts,
    'vouchers' => $agendaSalesVoucherCatalog,
    'plans' => $agendaSalesPlans,
    'payable' => $agendaSalesPayables,
];
$calendarFilterUrl = static function (string $filter) use ($calendarView, $calendar, $requestedStaffId): string {
    $query = '/calendar?view=' . $calendarView . '&date=' . $calendar['date'];

    if ($requestedStaffId) {
        $query .= '&staff_id=' . $requestedStaffId;
    }

    if ($filter !== 'all') {
        $query .= '&filter=' . $filter;
    }

    return url($query);
};
$renderCalendarFilter = static function () use ($calendarFilter, $calendarFilterOptions, $calendarFilterUrl): void {
    $activeOption = $calendarFilterOptions[$calendarFilter];
    ?>
    <div class="dropdown cal-header-filter">
        <button class="cal-filter-button" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <?php if ($activeOption['icon']): ?>
                <i class="bi <?= e($activeOption['icon']) ?>"></i>
            <?php else: ?>
                <span><?= e($activeOption['label']) ?></span>
            <?php endif; ?>
        </button>
        <div class="dropdown-menu cal-filter-menu">
            <?php foreach ($calendarFilterOptions as $filterKey => $filterOption): ?>
                <a class="dropdown-item <?= $calendarFilter === $filterKey ? 'active' : '' ?>" href="<?= e($calendarFilterUrl($filterKey)) ?>">
                    <?php if ($filterOption['icon']): ?>
                        <i class="bi <?= e($filterOption['icon']) ?>"></i>
                    <?php endif; ?>
                    <span><?= e($filterOption['label']) ?></span>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
};
$calendarEvents = array_values(array_filter(
    app('repository')->getBookings(),
    fn (array $booking): bool => substr($booking['start_at'], 0, 10) >= $weekStart->format('Y-m-d')
        && substr($booking['start_at'], 0, 10) <= $weekEnd->format('Y-m-d')
));
$calendarBlocks = array_values(array_filter(
    app('repository')->getBlocks(),
    fn (array $block): bool => substr($block['start_at'], 0, 10) >= $weekStart->format('Y-m-d')
        && substr($block['start_at'], 0, 10) <= $weekEnd->format('Y-m-d')
));
$calendarSales = array_values(array_filter(
    app('repository')->getTransactions(),
    fn (array $transaction): bool => substr($transaction['date'], 0, 10) >= $weekStart->format('Y-m-d')
        && substr($transaction['date'], 0, 10) <= $weekEnd->format('Y-m-d')
        && ($transaction['status'] ?? '') === 'paid'
));
$calendarStatusKey = static function (string $status): string {
    $status = strtolower(trim($status));
    $status = $status === '' || $status === 'pending' ? 'new' : $status;
    $allowedStatuses = ['new', 'confirmed', 'arrived', 'started', 'completed'];

    return in_array($status, $allowedStatuses, true) ? $status : 'new';
};
$calendarStatusLabel = static fn (string $status): string => ucfirst($calendarStatusKey($status));

$layoutCalendarTimedItems = static function (array $items) use ($minutesFromStart, $pixelsPerMinute): array {
    usort($items, static function (array $a, array $b): int {
        $startCompare = strcmp($a['start_at'], $b['start_at']);

        return $startCompare !== 0 ? $startCompare : strcmp($a['end_at'], $b['end_at']);
    });

    $laidOut = [];
    $activeColumns = [];
    $currentGroup = [];
    $groupEnd = -1;
    $groupColumns = 0;

    foreach ($items as $item) {
        $start = max(0, $minutesFromStart($item['start_at']));
        $end = max($start + 5, $minutesFromStart($item['end_at']));

        if ($currentGroup !== [] && $start >= $groupEnd) {
            foreach ($currentGroup as $itemIndex) {
                $laidOut[$itemIndex]['columns'] = max(1, $groupColumns);
            }

            $activeColumns = [];
            $currentGroup = [];
            $groupEnd = -1;
            $groupColumns = 0;
        }

        foreach ($activeColumns as $column => $columnEnd) {
            if ($columnEnd <= $start) {
                unset($activeColumns[$column]);
            }
        }

        $column = 0;
        while (array_key_exists($column, $activeColumns)) {
            $column++;
        }

        $item['start_minutes'] = $start;
        $item['end_minutes'] = $end;
        $item['top'] = $start * $pixelsPerMinute;
        $item['height'] = max(24, ($end - $start) * $pixelsPerMinute);
        $item['column'] = $column;
        $item['columns'] = 1;

        $laidOut[] = $item;
        $itemIndex = array_key_last($laidOut);
        $activeColumns[$column] = $end;
        $currentGroup[] = $itemIndex;
        $groupEnd = max($groupEnd, $end);
        $groupColumns = max($groupColumns, $column + 1, count($activeColumns));
    }

    foreach ($currentGroup as $itemIndex) {
        $laidOut[$itemIndex]['columns'] = max(1, $groupColumns);
    }

    return $laidOut;
};

$calendarTimedItemsFor = static function (string $date, int $staffId) use (
    $calendarEvents,
    $calendarBlocks,
    $calendarSales,
    $showServices,
    $showBlocks,
    $serviceMap,
    $serviceNameMap,
    $normalizeCalendarServiceName,
    $customerMap,
    $staffMap,
    $calendarStatusKey,
    $calendarStatusLabel,
    $layoutCalendarTimedItems
): array {
    $items = [];

    foreach ($calendarEvents as $event) {
        if (!$showServices || !str_starts_with($event['start_at'], $date)) {
            continue;
        }

        $eventServiceItems = array_values(array_filter($event['service_items'] ?? [], static fn ($item): bool => is_array($item)));
        $eventBelongsToStaff = (int) $event['staff_id'] === $staffId;
        $hasMatchingStaff = $eventBelongsToStaff || array_filter(
            $eventServiceItems,
            static fn (array $item): bool => (int) ($item['staff_id'] ?? $event['staff_id']) === $staffId
        ) !== [];

        if (!$hasMatchingStaff) {
            continue;
        }

        $eventServices = array_values(array_filter(array_map(
            static fn (int $serviceId): ?array => $serviceMap[$serviceId] ?? null,
            $event['service_ids'] ?? []
        )));
        $customer = $customerMap[(int) ($event['customer_id'] ?? 0)] ?? null;
        $staff = $staffMap[(int) $event['staff_id']] ?? ['name' => 'Staff'];
        $rawStatus = strtolower((string) ($event['status'] ?? 'new'));

        if (in_array($rawStatus, ['cancelled', 'no_show'], true)) {
            continue;
        }

        $status = $calendarStatusKey($rawStatus);

        $eventTitle = $customer['name'] ?? ($event['channel'] ?: 'Walk-In');
        $eventNotes = trim((string) ($event['notes'] ?? ''));

        if ($eventServiceItems !== []) {
            foreach ($eventServiceItems as $eventServiceItem) {
                $itemStaffId = (int) ($eventServiceItem['staff_id'] ?? $event['staff_id']);

                if (!$eventBelongsToStaff && $itemStaffId !== $staffId) {
                    continue;
                }

                $eventService = $serviceMap[(int) ($eventServiceItem['service_id'] ?? 0)] ?? null;
                $duration = max(5, (int) ($eventServiceItem['duration'] ?? $eventService['duration'] ?? 60));
                $price = (float) ($eventServiceItem['price'] ?? $eventService['price'] ?? 0);
                $startAt = (string) ($eventServiceItem['start_at'] ?? $event['start_at']);
                $endAt = (string) ($eventServiceItem['end_at'] ?? (new DateTimeImmutable($startAt))->modify("+{$duration} minutes")->format('Y-m-d H:i:s'));
                $serviceStaff = $staffMap[$itemStaffId] ?? $staff;

                $items[] = [
                    'id' => (int) ($event['id'] ?? 0),
                    'customer_id' => (int) ($event['customer_id'] ?? 0),
                    'customer_name' => (string) ($customer['name'] ?? $eventTitle),
                    'customer_phone' => (string) ($customer['phone'] ?? ''),
                    'staff_id' => $itemStaffId,
                    'service_id' => (int) ($eventServiceItem['service_id'] ?? 0),
                    'type' => 'booking',
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'title' => $eventTitle,
                    'subtitle' => (string) ($eventService['name'] ?? 'Layanan salon'),
                    'staff' => $serviceStaff['name'],
                    'reference' => $event['reference'] ?? 'Booking',
                    'status' => $calendarStatusLabel($status),
                    'duration' => $duration,
                    'price' => $price,
                    'notes' => $eventNotes,
                ];
            }

            continue;
        }

        $cursor = new DateTimeImmutable((string) $event['start_at']);

        if ($eventServices === []) {
            $items[] = [
                'id' => (int) ($event['id'] ?? 0),
                'customer_id' => (int) ($event['customer_id'] ?? 0),
                'customer_name' => (string) ($customer['name'] ?? $eventTitle),
                'customer_phone' => (string) ($customer['phone'] ?? ''),
                'staff_id' => (int) ($event['staff_id'] ?? 0),
                'service_id' => 0,
                'type' => 'booking',
                'start_at' => $event['start_at'],
                'end_at' => $event['end_at'],
                'title' => $eventTitle,
                'subtitle' => 'Layanan salon',
                'staff' => $staff['name'],
                'reference' => $event['reference'] ?? 'Booking',
                'status' => $calendarStatusLabel($status),
                'duration' => max(5, (int) (((new DateTimeImmutable((string) $event['end_at']))->getTimestamp() - (new DateTimeImmutable((string) $event['start_at']))->getTimestamp()) / 60)),
                'price' => 0,
                'notes' => $eventNotes,
            ];

            continue;
        }

        foreach ($eventServices as $eventService) {
            $duration = max(5, (int) ($eventService['duration'] ?? 60));
            $startAt = $cursor->format('Y-m-d H:i:s');
            $cursor = $cursor->modify("+{$duration} minutes");

            $items[] = [
                'id' => (int) ($event['id'] ?? 0),
                'customer_id' => (int) ($event['customer_id'] ?? 0),
                'customer_name' => (string) ($customer['name'] ?? $eventTitle),
                'customer_phone' => (string) ($customer['phone'] ?? ''),
                'staff_id' => (int) ($event['staff_id'] ?? 0),
                'service_id' => (int) ($eventService['id'] ?? 0),
                'type' => 'booking',
                'start_at' => $startAt,
                'end_at' => $cursor->format('Y-m-d H:i:s'),
                'title' => $eventTitle,
                'subtitle' => (string) ($eventService['name'] ?? 'Layanan salon'),
                'staff' => $staff['name'],
                'reference' => $event['reference'] ?? 'Booking',
                'status' => $calendarStatusLabel($status),
                'duration' => $duration,
                'price' => (float) ($eventService['price'] ?? 0),
                'notes' => $eventNotes,
            ];
        }
    }

    foreach ($calendarBlocks as $block) {
        if (!$showBlocks || (int) $block['staff_id'] !== $staffId || !str_starts_with($block['start_at'], $date)) {
            continue;
        }

        $staff = $staffMap[(int) $block['staff_id']] ?? ['name' => 'Staff'];

        $items[] = [
            'id' => (int) ($block['id'] ?? 0),
            'staff_id' => (int) ($block['staff_id'] ?? 0),
            'type' => 'blocked',
            'start_at' => $block['start_at'],
            'end_at' => $block['end_at'],
            'title' => trim((string) ($block['description'] ?? '')) !== '' ? trim((string) $block['description']) : (string) ($block['title'] ?? 'Blokir Waktu'),
            'subtitle' => '',
            'staff' => $staff['name'],
            'reference' => 'Blocked time',
            'status' => 'Blocked',
            'duration' => max(5, (int) (((new DateTimeImmutable((string) $block['end_at']))->getTimestamp() - (new DateTimeImmutable((string) $block['start_at']))->getTimestamp()) / 60)),
            'price' => 0,
            'notes' => trim((string) ($block['description'] ?? '')),
        ];
    }

    foreach ($calendarSales as $sale) {
        if (!$showServices || (int) $sale['staff_id'] !== $staffId || !str_starts_with($sale['date'], $date)) {
            continue;
        }

        $customer = $customerMap[(int) ($sale['customer_id'] ?? 0)] ?? null;
        $staff = $staffMap[(int) $sale['staff_id']] ?? ['name' => 'Staff'];
        $saleTitle = $customer['name'] ?? 'Walk-In';
        $saleNotes = 'Pembayaran ' . ($sale['payment_method'] ?? 'Cash');
        $cursor = new DateTimeImmutable((string) $sale['date']);
        $saleItems = array_values(array_filter($sale['items'] ?? [], static fn ($item): bool => is_array($item)));

        if ($saleItems === []) {
            $items[] = [
                'type' => 'sale',
                'start_at' => $cursor->format('Y-m-d H:i:s'),
                'end_at' => $cursor->modify('+60 minutes')->format('Y-m-d H:i:s'),
                'title' => $saleTitle,
                'subtitle' => 'Penjualan: Item salon',
                'staff' => $staff['name'],
                'reference' => $sale['reference'] ?? 'Penjualan',
                'status' => 'Paid',
                'duration' => 60,
                'price' => 0,
                'notes' => $saleNotes,
            ];

            continue;
        }

        foreach ($saleItems as $saleItem) {
            $itemName = (string) ($saleItem['name'] ?? 'Item salon');
            $matchedService = $serviceNameMap[$normalizeCalendarServiceName($itemName)] ?? null;
            $duration = max(5, (int) ($matchedService['duration'] ?? 60));
            $quantity = max(1, (int) ($saleItem['quantity'] ?? $saleItem['qty'] ?? 1));

            for ($index = 0; $index < $quantity; $index++) {
                $startAt = $cursor->format('Y-m-d H:i:s');
                $cursor = $cursor->modify("+{$duration} minutes");

                $items[] = [
                    'type' => 'sale',
                    'start_at' => $startAt,
                    'end_at' => $cursor->format('Y-m-d H:i:s'),
                    'title' => $saleTitle,
                    'subtitle' => 'Penjualan: ' . $itemName,
                    'staff' => $staff['name'],
                    'reference' => $sale['reference'] ?? 'Penjualan',
                    'status' => 'Paid',
                    'duration' => $duration,
                    'price' => (float) ($saleItem['price'] ?? 0),
                    'notes' => $saleNotes,
                ];
            }
        }
    }

    return $layoutCalendarTimedItems($items);
};
$scheduleItems = [];

foreach ($calendarEvents as $event) {
    if (!$showServices || ($requestedStaffId && (int) $event['staff_id'] !== $requestedStaffId)) {
        continue;
    }

    $eventStaff = array_values(array_filter($calendar['staff'], fn (array $staff): bool => (int) $staff['id'] === (int) $event['staff_id']))[0] ?? $activeStaff;
    $eventServices = array_map(
        fn (int $serviceId): string => $serviceMap[$serviceId]['name'] ?? 'Layanan',
        $event['service_ids'] ?? []
    );

    $scheduleItems[] = [
        'type' => 'services',
        'start_at' => $event['start_at'],
        'end_at' => $event['end_at'],
        'staff' => $eventStaff['name'],
        'title' => $event['channel'] ?: 'Walk-In',
        'description' => implode(' - ', $eventServices) ?: 'Layanan salon',
    ];
}

foreach ($calendarBlocks as $block) {
    if (!$showBlocks || ($requestedStaffId && (int) $block['staff_id'] !== $requestedStaffId)) {
        continue;
    }

    $blockStaff = array_values(array_filter($calendar['staff'], fn (array $staff): bool => (int) $staff['id'] === (int) $block['staff_id']))[0] ?? $activeStaff;

    $scheduleItems[] = [
        'type' => 'blocked',
        'start_at' => $block['start_at'],
        'end_at' => $block['end_at'],
        'staff' => $blockStaff['name'],
        'title' => $block['title'] ?? 'Blocked Time',
        'description' => 'Blocked time',
    ];
}

usort($scheduleItems, fn (array $a, array $b): int => strcmp($a['start_at'], $b['start_at']));

if (date('Y-m-d') >= $weekStart->format('Y-m-d') && date('Y-m-d') <= $weekEnd->format('Y-m-d')) {
    [$nowHour, $nowMinute] = array_map('intval', explode(':', date('H:i')));
    $indicatorOffset = ((($nowHour - $startHour) * 60) + $nowMinute) * $pixelsPerMinute;
}

if ($isDayView && date('Y-m-d') !== $selectedDate->format('Y-m-d')) {
    $indicatorOffset = null;
}
?>

<style>
    /* Toolbar Styling */
    .custom-toolbar-btn {
        background-color: #f4f5f7;
        color: #111827;
        border: none;
        border-radius: 6px;
        padding: 0.5rem 1rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        transition: background 0.2s;
        text-decoration: none;
        min-height: 48px;
    }
    .custom-toolbar-btn:hover { background-color: #e5e7eb; }
    
    .custom-toolbar-btn .text-muted-icon {
        color: #4b5563;
        font-size: 1.1rem;
    }

    .custom-toolbar-btn.dropdown-toggle::after {
        margin-left: auto;
    }

    .soft-dropdown {
        border: 1px solid #e5edf8;
        border-radius: 14px;
        box-shadow: 0 18px 34px rgba(32, 57, 96, 0.14);
        padding: 8px;
        min-width: 230px;
    }

    .soft-dropdown .dropdown-item {
        border-radius: 10px;
        padding: 10px 12px;
        color: #1f2937;
        font-weight: 600;
    }

    .soft-dropdown .dropdown-item.active,
    .soft-dropdown .dropdown-item:active,
    .soft-dropdown .dropdown-item:hover {
        background: #eaf3ff;
        color: #4f84e9;
    }

    .custom-toolbar-group {
        background-color: #f4f5f7;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        padding: 0.25rem;
    }

    .custom-toolbar-group form { margin: 0; }

    .date-nav-btn {
        background: transparent;
        border: none;
        color: #4b5563;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .date-nav-btn:hover { background-color: #e5e7eb; color: #111827; }

    .view-switcher-container {
        background-color: #f4f5f7;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        overflow: hidden;
    }

    .view-switcher-btn {
        background: transparent;
        border: none;
        padding: 0.5rem 1rem;
        color: #111827;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-right: 1px solid #e5e7eb;
        font-size: 1.1rem;
        min-height: 48px;
        min-width: 54px;
        text-decoration: none;
    }
    .view-switcher-btn:last-child { border-right: none; }
    .view-switcher-btn:hover { background-color: #e5e7eb; }
    .view-switcher-btn.active {
        background-color: #e5e7eb;
        font-weight: 600;
        font-size: 0.9rem;
        gap: 0.5rem;
    }

    .refresh-btn {
        background-color: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.5rem 0.75rem;
        color: #4b5563;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        min-height: 48px;
        min-width: 58px;
    }
    .refresh-btn:hover { background-color: #f9fafb; color: #111827; }

    /* Calendar Styling */
    .content-panel:has(.calendar-shell) {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding-bottom: 0;
    }

    .calendar-shell {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding-bottom: 18px;
        box-sizing: border-box;
    }

    .calendar-shell > .calendar-toolbar {
        flex: 0 0 auto;
        margin-bottom: 0 !important;
    }

    .single-staff-calendar {
        flex: 1 1 auto;
        min-height: 0;
        border: 1px solid #e5e7eb;
        background: #fff;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
        overflow: hidden;
        border-bottom-color: #d2d8e2;
        box-shadow: 0 14px 22px rgba(31, 45, 61, 0.08);
    }

    .cal-header-row {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        background: #fff;
    }

    .cal-header-all {
        width: 84px;
        padding: 0;
        text-align: center;
        font-weight: 600;
        border-right: 1px solid #e5e7eb;
        font-size: 1rem;
        color: #111827;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
    }

    .cal-header-filter {
        width: 100%;
        min-height: 58px;
    }

    .cal-filter-button {
        width: 100%;
        height: 100%;
        min-height: 58px;
        border: 0;
        background: #fff;
        color: #111827;
        font: inherit;
        display: grid;
        place-items: center;
    }

    .cal-filter-button:hover,
    .cal-filter-button[aria-expanded="true"] {
        background: #f8fbff;
        color: #4f84e9;
    }

    .cal-filter-button i {
        font-size: 1.75rem;
        line-height: 1;
        color: #333;
    }

    .cal-filter-menu {
        border: 1px solid #e3e9f4;
        border-radius: 2px;
        box-shadow: 0 16px 32px rgba(31, 41, 55, 0.14);
        margin-top: 0 !important;
        min-width: 260px;
        padding: 0;
    }

    .cal-filter-menu::before {
        content: "";
        position: absolute;
        top: -9px;
        left: 22px;
        width: 18px;
        height: 18px;
        background: #fff;
        border-left: 1px solid #e3e9f4;
        border-top: 1px solid #e3e9f4;
        transform: rotate(45deg);
    }

    .cal-filter-menu .dropdown-item {
        position: relative;
        min-height: 64px;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 0 28px;
        color: #111827;
        font-size: 1rem;
        font-weight: 600;
        background: #fff;
    }

    .cal-filter-menu .dropdown-item + .dropdown-item {
        border-top: 1px solid #e8edf5;
    }

    .cal-filter-menu .dropdown-item i {
        width: 32px;
        font-size: 1.65rem;
        color: #111827;
    }

    .cal-filter-menu .dropdown-item.active,
    .cal-filter-menu .dropdown-item:hover {
        background: #f2f7ff;
        color: #4f84e9;
    }

    .cal-week-header-grid {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(7, minmax(118px, 1fr));
    }

    .cal-day-header-grid {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr;
    }

    .cal-week-day-head {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 58px;
        padding: 0.45rem 0.35rem;
        text-align: center;
        border-right: 1px solid #edf2f8;
    }

    .cal-week-day-head.active::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: #4f84ff;
    }

    .cal-week-day-head strong {
        display: block;
        font-size: 0.9rem;
        color: #111827;
        line-height: 1.1;
    }

    .cal-week-day-head span {
        display: block;
        margin-top: 2px;
        color: #6b7280;
        font-size: 0.82rem;
        font-weight: 600;
    }

    .cal-day-staff-head {
        min-height: 62px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0.65rem 1rem;
        border-right: 1px solid #edf2f8;
        color: #111827;
        font-size: 1rem;
        font-weight: 700;
    }

    .cal-day-staff-head .icon-bg {
        background: #f3f4f6;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        font-size: 1.35rem;
        flex: 0 0 auto;
    }

    .cal-header-staff .icon-bg {
        background: #f3f4f6;
        border-radius: 50%;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        color: #6b7280;
    }

    .cal-body-scroll {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none;
        overflow: auto;
        scrollbar-gutter: stable;
    }

    .cal-body-row {
        display: flex;
        position: relative;
    }

    .cal-time-col {
        width: 84px;
        border-right: 1px solid #e5e7eb;
        background: #fff;
        z-index: 10;
    }

    .cal-week-grid-col {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(7, minmax(118px, 1fr));
        position: relative;
        overflow: visible;
    }

    .cal-day-grid-wrap {
        flex: 1;
        position: relative;
        overflow: visible;
    }

    .cal-day-grid-col {
        position: relative;
        /* Diagonal striped background persis seperti gambar */
        background: repeating-linear-gradient(
            -45deg,
            #f9fafb,
            #f9fafb 2px,
            #f3f4f6 2px,
            #f3f4f6 6px
        );
        border-right: 1px solid #edf2f8;
    }

    .cal-day-grid-col--single {
        height: 100%;
    }

    .hour-block {
        height: 120px;
        border-bottom: 1px solid #e5e7eb;
        box-sizing: border-box;
    }

    .time-label {
        text-align: center;
        padding-top: 15px;
        font-size: 0.82rem;
        color: #111827;
    }

    .cal-interactive-slots {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        flex-direction: column;
    }

    .click-slot {
        height: 10px; /* 5 Menit */
        width: 100%;
        position: relative;
        cursor: pointer;
    }
    
    .click-slot:hover {
        background-color: transparent;
    }

    .slot-hover-time {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 10px;
        display: none;
        align-items: center;
        justify-content: center;
        background: #4f7fe8;
        color: #fff;
        border-radius: 2px;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 10px;
        z-index: 24;
        pointer-events: none;
    }

    .click-slot:hover .slot-hover-time {
        display: flex;
    }

    /* Indikator Jam Sekarang (Garis Merah) */
    .now-indicator {
        position: absolute;
        left: 0; right: 0;
        height: 1px;
        background-color: #d93d53;
        z-index: 30;
        pointer-events: none;
    }

    .now-indicator-pill {
        position: absolute;
        left: calc(-1 * var(--calendar-time-col-width, 84px) + 10px);
        top: -11px;
        background-color: #d93d53;
        color: white;
        padding: 2px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
        min-width: 64px;
        text-align: center;
        line-height: 20px;
        box-shadow: 0 1px 3px rgba(217, 61, 83, 0.2);
    }

    .calendar-toolbar-main,
    .calendar-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: nowrap;
    }

    .calendar-toolbar {
        gap: 14px;
    }

    .single-staff-calendar.is-day-view .cal-header-all,
    .single-staff-calendar.is-day-view .cal-time-col {
        width: 220px;
        flex: 0 0 220px;
    }

    .single-staff-calendar.is-day-view {
        --calendar-time-col-width: 220px;
    }

    .single-staff-calendar.is-day-view .cal-body-scroll {
        max-height: none;
    }

    .single-staff-calendar.is-day-view .time-label {
        font-size: 0.95rem;
        font-weight: 600;
        color: #111827;
    }

    .single-staff-calendar.is-day-view .now-indicator-pill {
        left: -82px;
        min-width: 64px;
    }

    .single-staff-calendar.is-day-view .calendar-event-blue {
        margin: 0;
        border-radius: 6px;
        font-weight: 700;
    }

    .single-staff-calendar.is-schedule-view .cal-header-all {
        width: 92px;
        flex: 0 0 92px;
    }

    .single-staff-calendar.is-schedule-view .cal-filter-button,
    .single-staff-calendar.is-schedule-view .cal-header-filter {
        min-height: 82px;
    }

    .schedule-staff-head {
        min-height: 82px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 16px;
        color: #333;
        font-size: 1rem;
        font-weight: 700;
    }

    .schedule-staff-head .icon-bg {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        background: #f3f4f6;
        color: #777;
        font-size: 1.6rem;
    }

    .schedule-list-panel {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 14px 16px 30px 92px;
        background: #fff;
    }

    .schedule-list-row {
        margin-bottom: 16px;
    }

    .schedule-list-time {
        color: #777;
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 8px;
    }

    .schedule-list-card {
        width: 265px;
        min-height: 130px;
        background: #f3f3f3;
        border-radius: 3px;
        padding: 24px 28px;
        color: #111827;
        display: flex;
        flex-direction: column;
        gap: 18px;
        box-shadow: none;
    }

    .schedule-list-card strong {
        font-size: 1rem;
        line-height: 1.2;
    }

    .schedule-list-card span {
        font-size: 0.9rem;
        color: #111827;
    }

    .schedule-list-card.is-blocked {
        background: #ededed;
        color: #4b5563;
    }

    .schedule-empty {
        min-height: 420px;
        display: grid;
        place-items: center;
        color: #8b939f;
        font-weight: 700;
        font-size: 1.1rem;
    }

    @media (max-width: 1180px) {
        .calendar-toolbar {
            overflow-x: auto;
            justify-content: flex-start !important;
            padding-bottom: 10px;
        }

        .calendar-toolbar-main,
        .calendar-toolbar-actions {
            flex: 0 0 auto;
        }
    }

    /* Overlay Event */
    .calendar-event-blue {
        position: absolute;
        left: 0;
        right: auto;
        border: 1px solid #d5d9df;
        background-color: #eef0f3;
        color: #111827;
        font-size: 0.8rem;
        display: block;
        border-radius: 4px;
        z-index: 15;
        cursor: pointer;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.58), 0 1px 2px rgba(0,0,0,0.08);
        margin: 0;
        overflow: visible;
    }

    .calendar-event-blue:hover,
    .calendar-event-blue:focus-within {
        z-index: 70;
    }

    .calendar-event-card {
        padding: 7px 8px;
        border-left: 3px solid rgba(17, 24, 39, 0.28);
    }

    .calendar-event-card.is-blocked {
        background-color: #9ca3af;
        border-left-color: rgba(255,255,255,0.58);
    }

    .calendar-event-card.is-sale {
        background-color: #4f84ff;
        border-left-color: rgba(255,255,255,0.72);
    }

    .calendar-event-card.is-sale .calendar-event-card__time,
    .calendar-event-card.is-sale .calendar-event-card__title,
    .calendar-event-card.is-sale .calendar-event-card__service {
        color: #fff;
    }

    .calendar-event-card.is-sale .calendar-event-card__service {
        opacity: 0.92;
    }

    .calendar-event-card.is-new {
        border-color: #d7dce3;
        border-left-color: #aab1bc;
        background-color: #eef0f3;
        color: #111827;
    }

    .calendar-event-card.is-confirmed,
    .calendar-event-card.is-arrived {
        border: 1px solid #79d4a7;
        border-left: 3px solid #58b981;
        background-color: #e6f7ef;
        color: #111827;
        box-shadow: inset 0 0 0 1px rgba(88, 185, 129, 0.18), 0 1px 2px rgba(0,0,0,0.08);
    }

    .calendar-event-card.is-started {
        border: 1px solid #e2bf68;
        border-left: 3px solid #d5a440;
        background-color: #fff5dd;
        color: #111827;
        box-shadow: inset 0 0 0 1px rgba(213, 164, 64, 0.16), 0 1px 2px rgba(0,0,0,0.08);
    }

    .calendar-event-card.is-completed {
        border: 1px solid #89d2e2;
        border-left: 3px solid #5db7cf;
        background-color: #e3f6fb;
        color: #111827;
        box-shadow: inset 0 0 0 1px rgba(93, 183, 207, 0.18), 0 1px 2px rgba(0,0,0,0.08);
    }

    .calendar-event-card.is-new .calendar-event-card__time,
    .calendar-event-card.is-new .calendar-event-card__title,
    .calendar-event-card.is-new .calendar-event-card__service,
    .calendar-event-card.is-confirmed .calendar-event-card__time,
    .calendar-event-card.is-confirmed .calendar-event-card__title,
    .calendar-event-card.is-confirmed .calendar-event-card__service,
    .calendar-event-card.is-arrived .calendar-event-card__time,
    .calendar-event-card.is-arrived .calendar-event-card__title,
    .calendar-event-card.is-arrived .calendar-event-card__service,
    .calendar-event-card.is-started .calendar-event-card__time,
    .calendar-event-card.is-started .calendar-event-card__title,
    .calendar-event-card.is-started .calendar-event-card__service,
    .calendar-event-card.is-completed .calendar-event-card__time,
    .calendar-event-card.is-completed .calendar-event-card__title,
    .calendar-event-card.is-completed .calendar-event-card__service {
        color: #111827;
    }

    .calendar-event-card.is-new .calendar-event-card__service,
    .calendar-event-card.is-confirmed .calendar-event-card__service,
    .calendar-event-card.is-arrived .calendar-event-card__service,
    .calendar-event-card.is-started .calendar-event-card__service,
    .calendar-event-card.is-completed .calendar-event-card__service {
        opacity: 0.85;
    }

    .calendar-event-card__inner {
        min-width: 0;
        max-height: 100%;
        overflow: hidden;
    }

    .calendar-event-card.is-confirmed .calendar-event-card__inner,
    .calendar-event-card.is-arrived .calendar-event-card__inner,
    .calendar-event-card.is-started .calendar-event-card__inner,
    .calendar-event-card.is-completed .calendar-event-card__inner {
        padding-right: 28px;
    }

    .calendar-event-card__status-icon {
        position: absolute;
        top: 8px;
        right: 10px;
        z-index: 2;
        display: none;
        color: #111827;
        font-size: 20px;
        line-height: 1;
    }

    .calendar-event-card.is-confirmed .calendar-event-card__status-icon,
    .calendar-event-card.is-arrived .calendar-event-card__status-icon,
    .calendar-event-card.is-started .calendar-event-card__status-icon,
    .calendar-event-card.is-completed .calendar-event-card__status-icon {
        display: block;
    }

    .calendar-event-card__time {
        margin-bottom: 2px;
        font-size: 0.68rem;
        font-weight: 800;
        line-height: 1.15;
        opacity: 0.95;
    }

    .calendar-event-card__title {
        overflow: hidden;
        color: #111827;
        font-size: 0.76rem;
        font-weight: 800;
        line-height: 1.18;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .calendar-event-card__service {
        overflow: hidden;
        margin-top: 2px;
        color: rgba(17, 24, 39, 0.82);
        font-size: 0.66rem;
        font-weight: 600;
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .calendar-event-popover {
        position: absolute;
        left: 10px;
        top: 10px;
        z-index: 90;
        display: none;
        width: min(236px, 76vw);
        transform: none;
        border: 1px solid #dfe7f2;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
        color: #1f2937;
        pointer-events: none;
    }

    .calendar-event-popover::before {
        display: none;
    }

    .calendar-event-blue:hover .calendar-event-popover,
    .calendar-event-blue:focus-within .calendar-event-popover {
        display: block;
    }

    .calendar-agenda-view-dialog {
        width: min(920px, calc(100vw - 120px));
        max-width: min(920px, calc(100vw - 120px));
    }

    .calendar-agenda-view {
        overflow: hidden;
        border: 0;
        border-radius: 8px;
        max-height: calc(100vh - 128px);
        background: #fff;
    }

    .calendar-agenda-view__panel {
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 128px);
        padding: 24px 28px 0;
        background: #fff;
    }

    .calendar-agenda-view__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 34px;
    }

    .calendar-agenda-view__header h2 {
        margin: 0;
        color: #30343a;
        font-size: 24px;
        font-weight: 800;
    }

    .calendar-agenda-view__close {
        border: 0;
        background: transparent;
        color: #20252d;
        font-size: 24px;
        line-height: 1;
    }

    .calendar-agenda-view__customer {
        margin-bottom: 16px;
        color: #111827;
        font-size: 16px;
    }

    .calendar-agenda-view__status-wrap {
        position: relative;
        margin-bottom: 24px;
    }

    .calendar-agenda-view__status {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 50px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: #f5f6f8;
        color: #111827;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }

    .calendar-agenda-view__status i.bi-chevron-down,
    .calendar-agenda-view__status i.bi-chevron-up {
        position: absolute;
        right: 18px;
        color: #a6adb7;
    }

    .calendar-agenda-view__status.is-new {
        border-color: #d5d9df;
        background: #f3f4f6;
        color: #111827;
    }

    .calendar-agenda-view__status.is-confirmed,
    .calendar-agenda-view__status.is-arrived {
        border-color: #71cb9c;
        background: #e7f8f0;
        color: #55a879;
    }

    .calendar-agenda-view__status.is-started {
        border-color: #e2bf68;
        background: #fff6e3;
        color: #c58a2e;
    }

    .calendar-agenda-view__status.is-completed {
        border-color: #89d2e2;
        background: #e7f7fb;
        color: #55abc1;
    }

    .calendar-agenda-view__status-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 20;
        display: grid;
        gap: 16px;
        padding: 20px;
        border: 1px solid #e3e8f0;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
    }

    .calendar-agenda-view__status-menu[hidden] {
        display: none;
    }

    .calendar-agenda-view__status-option {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        border: 0;
        background: transparent;
        color: #111827;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .calendar-agenda-view__status-option.is-confirmed,
    .calendar-agenda-view__status-option.is-arrived {
        color: #5bad80;
    }

    .calendar-agenda-view__status-option.is-started {
        color: #db9a37;
    }

    .calendar-agenda-view__status-option.is-completed {
        color: #61c6d9;
    }

    .calendar-agenda-view__meta {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
        color: #111827;
        font-size: 16px;
    }

    .calendar-agenda-view__services {
        display: grid;
        flex: 1 1 auto;
        gap: 12px;
        max-height: min(29vh, 280px);
        overflow: auto;
        padding-right: 3px;
    }

    .calendar-agenda-view-service {
        overflow: hidden;
        border: 1px solid transparent;
        border-radius: 8px;
        background: #f5f5f5;
    }

    .calendar-agenda-view-service.is-expanded {
        border-color: #d7d7d7;
        background: #fff;
    }

    .calendar-agenda-view-service__head {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        min-height: 68px;
        padding: 14px 18px;
        border: 0;
        background: transparent;
        text-align: left;
    }

    .calendar-agenda-view-service__avatar {
        display: grid;
        flex: 0 0 auto;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #c9cdd3;
        color: #fff;
        font-weight: 700;
    }

    .calendar-agenda-view-service__title {
        flex: 1;
        min-width: 0;
        color: #111827;
        font-size: 21px;
        font-weight: 800;
    }

    .calendar-agenda-view-service__body {
        display: none;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        padding: 0 64px 16px;
    }

    .calendar-agenda-view-service.is-expanded .calendar-agenda-view-service__body {
        display: grid;
    }

    .calendar-agenda-view-service__detail span {
        display: block;
        margin-bottom: 4px;
        color: #6b7280;
        font-size: 13px;
        font-weight: 700;
    }

    .calendar-agenda-view-service__detail strong {
        color: #30343a;
        font-size: 16px;
    }

    .calendar-agenda-view__updated {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 0 0 auto;
        margin: 18px 0 22px;
        color: #737a84;
    }

    .calendar-agenda-view__footer {
        position: sticky;
        bottom: 0;
        z-index: 6;
        display: grid;
        grid-template-columns: 1fr 230px 230px;
        gap: 12px;
        align-items: center;
        margin: 0 -28px;
        padding: 14px 28px 16px;
        border-top: 1px solid #edf0f4;
        background: #fff;
        box-shadow: 0 -10px 22px rgba(255, 255, 255, 0.92);
    }

    .calendar-agenda-view__total {
        color: #d44962;
        font-size: 18px;
        font-weight: 800;
    }

    .calendar-agenda-view__more,
    .calendar-agenda-view__checkout {
        height: 44px;
        border: 0;
        border-radius: 6px;
        font-weight: 800;
    }

    .calendar-agenda-view__more {
        background: #f3f4f6;
        color: #111827;
    }

    .calendar-agenda-view__more-wrap {
        position: relative;
    }

    .calendar-agenda-view__more-menu {
        position: absolute;
        right: 0;
        bottom: calc(100% + 10px);
        z-index: 12;
        display: grid;
        gap: 2px;
        min-width: 220px;
        padding: 10px;
        border: 1px solid #e8edf4;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
    }

    .calendar-agenda-view__more-menu[hidden] {
        display: none;
    }

    .calendar-agenda-view__more-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 11px 12px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: #4b5563;
        font-size: 15px;
        text-align: left;
        transition: background 0.2s ease, color 0.2s ease;
    }

    .calendar-agenda-view__more-item:hover {
        background: #f6f8fb;
        color: #111827;
    }

    .calendar-agenda-view__more-item.is-danger {
        color: #e24b5b;
    }

    .calendar-agenda-view__more-item.is-danger:hover {
        background: rgba(226, 75, 91, 0.08);
        color: #cc3647;
    }

    .calendar-agenda-view__checkout {
        background: #70cfa0;
        color: #fff;
    }

    @media (max-width: 900px) {
        .calendar-agenda-view-dialog {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
        }

        .calendar-agenda-view__panel {
            padding: 22px 18px 0;
        }

        .calendar-agenda-view-service__body {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 0 22px 20px;
        }

        .calendar-agenda-view__footer {
            grid-template-columns: 1fr;
            margin: 0 -18px;
            padding: 12px 18px 14px;
        }
    }

    .single-staff-calendar.is-week-view .cal-day-grid-col:nth-child(-n+2) .calendar-event-popover {
        left: 12px;
        right: auto;
        transform: none;
    }

    .single-staff-calendar.is-week-view .cal-day-grid-col:nth-child(-n+2) .calendar-event-popover::before {
        left: 24px;
        transform: rotate(45deg);
    }

    .single-staff-calendar.is-week-view .cal-day-grid-col:nth-last-child(-n+2) .calendar-event-popover {
        right: auto;
        left: 12px;
        transform: none;
    }

    .single-staff-calendar.is-week-view .cal-day-grid-col:nth-last-child(-n+2) .calendar-event-popover::before {
        right: 24px;
        left: auto;
        transform: rotate(45deg);
    }

    .calendar-event-popover__body {
        position: relative;
        z-index: 1;
        padding: 12px 14px;
        border-radius: 8px;
        background: #fff;
    }

    .calendar-event-popover__time {
        margin-bottom: 6px;
        color: #4f84ff;
        font-size: 0.76rem;
        font-weight: 800;
    }

    .calendar-event-popover strong {
        display: block;
        margin-bottom: 4px;
        color: #111827;
        font-size: 0.95rem;
        line-height: 1.2;
    }

    .calendar-event-popover span,
    .calendar-event-popover small {
        display: block;
        color: #637083;
        font-size: 0.78rem;
        line-height: 1.35;
    }

    /* FAB Custom Biru */
    .calendar-fab-wrapper {
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 1050;
    }
    .calendar-fab.custom-fab-green {
        width: 60px;
        height: 60px;
        background-color: #4f84ff;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        border: none;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        cursor: pointer;
        transition: transform 0.2s, background-color 0.2s;
    }
    .calendar-fab.custom-fab-green:hover {
        background-color: #3f73e6;
        transform: scale(1.05);
    }
    .calendar-fab-menu {
        position: absolute;
        bottom: 75px;
        right: 0;
        display: none;
        flex-direction: column;
        gap: 0;
        background: #fff;
        min-width: 260px;
        padding: 0;
        border-radius: 8px;
        box-shadow: 0 20px 40px rgba(32,57,96,0.18);
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        transform: translateY(12px);
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
    }
    .calendar-fab-menu.is-open {
        display: flex;
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }
    .calendar-fab-menu__item {
        min-width: 260px;
        min-height: 58px;
        padding: 12px 20px;
        border-bottom: 1px solid #e7eef8 !important;
        border-radius: 0;
        box-shadow: none;
        color: #24405f !important;
        font-size: 1.18rem;
        font-weight: 500;
    }
    .calendar-fab-menu__item i {
        width: 22px;
        font-size: 1.12rem;
    }
    .calendar-fab-menu__close {
        background: #4f84ff !important;
        color: #fff !important;
        margin-top: 4px;
        padding-top: 18px;
        padding-bottom: 18px;
        border-bottom: 0 !important;
    }
    .calendar-fab-menu__close:hover {
        background: #3e72e5 !important;
    }
    .calendar-fab.custom-fab-green.is-open {
        background: #4f84ff;
        color: #fff;
        border: 4px solid #111827;
        box-shadow: 0 14px 28px rgba(79,132,255,0.3);
    }

    #agendaModal {
        padding: 0 !important;
        overflow: hidden;
    }

    #agendaModal .modal-dialog {
        width: 100vw;
        min-width: 100vw;
        max-width: none;
        height: 100dvh;
        margin: 0;
    }

    #agendaModal .modal-content {
        width: 100vw;
        min-width: 100vw;
        max-width: none;
        height: 100dvh;
        max-height: 100dvh;
        border: 0;
        border-radius: 0;
    }

    .calendar-agenda-modal {
        position: relative;
        width: 100%;
        max-width: none;
        height: 100dvh;
        min-height: 0;
        border: 0;
        border-radius: 0;
        color: #1f2937;
        background: #fff;
        overflow: hidden;
    }

    .calendar-agenda-modal__header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        height: 78px;
        flex: 0 0 78px;
        padding: 14px 22px;
        border-bottom: 1px solid #e7eef8;
    }

    .calendar-agenda-modal__header h2 {
        margin: 0;
        font-family: "Manrope", sans-serif;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: 0;
    }

    .calendar-agenda-modal__header .btn-close {
        justify-self: end;
        font-size: 22px;
    }

    .calendar-agenda-modal__body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 420px;
        height: calc(100dvh - 78px);
        min-height: 0;
        overflow: hidden;
    }

    .calendar-agenda-left,
    .calendar-agenda-right {
        min-height: 0;
        height: calc(100dvh - 78px);
    }

    .calendar-agenda-left {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 22px 22px 0;
        overflow: hidden;
    }

    .calendar-agenda-right {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-width: 0;
        border-left: 1px solid #e7eef8;
        background: #fbfdff;
        overflow: hidden;
    }

    .calendar-agenda-right > div:first-child {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
    }

    .calendar-agenda-searchbar {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) 34px;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        background: #f5f8fc;
        color: #7f8da3;
        border: 1px solid #dbe8ff;
        border-radius: 8px;
    }

    .calendar-agenda-searchbar button,
    .calendar-agenda-searchbar i {
        border: 0;
        background: transparent;
        color: #4d5f79;
        font-size: 20px;
        text-align: center;
    }

    .calendar-agenda-searchbar input,
    .calendar-agenda-customer-search {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #24405f;
        font-size: 18px;
    }

    .calendar-agenda-searchbar input::placeholder,
    .calendar-agenda-customer-search::placeholder {
        color: #aab5c6;
    }

    .calendar-agenda-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    .calendar-agenda-chip {
        min-height: 52px;
        padding: 0 28px;
        border: 0;
        border-radius: 8px;
        background: #edf5ff;
        color: #24405f;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-chip.is-active {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-agenda-services {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px 20px;
        align-content: start;
        overflow: auto;
        min-height: 0;
        padding-bottom: 8px;
    }

    .calendar-agenda-service {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        min-height: 90px;
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        padding: 0;
        text-align: left;
        overflow: hidden;
        transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }

    .calendar-agenda-service:hover,
    .calendar-agenda-service.is-selected {
        border-color: #8dc5ff;
        background: #dff1ff;
        box-shadow: 0 10px 24px rgba(79, 132, 255, 0.14);
    }

    .calendar-agenda-service__initials {
        display: grid;
        place-items: center;
        background: #e6edf5;
        color: #142033;
        font-size: 20px;
        font-weight: 800;
    }

    .calendar-agenda-service.is-selected .calendar-agenda-service__initials {
        background: #c9e6ff;
    }

    .calendar-agenda-service__body {
        min-width: 0;
        padding: 16px 14px;
    }

    .calendar-agenda-service__body strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #111827;
        font-size: 16px;
        font-weight: 700;
    }

    .calendar-agenda-service__meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
        color: #68758a;
        font-size: 14px;
    }

    .calendar-agenda-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #b8c4d4;
    }

    .calendar-agenda-service__gender {
        margin-left: auto;
        color: #4d5f79;
        font-size: 18px;
    }

    .calendar-agenda-selected {
        margin-top: auto;
        border: 1px solid #e7eef8;
        border-radius: 8px 8px 0 0;
        background: #fff;
        box-shadow: 0 -8px 22px rgba(32, 57, 96, 0.08);
    }

    .calendar-agenda-selected.is-empty .calendar-agenda-selected__rows {
        display: none;
    }

    .calendar-agenda-selected__rows {
        max-height: 150px;
        overflow: auto;
        padding: 18px 22px 8px;
    }

    .calendar-agenda-selected__row {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        align-items: center;
        gap: 18px;
        padding: 8px 0;
        color: #1f2937;
        font-size: 16px;
    }

    .calendar-agenda-selected__row.is-checkout-picker {
        grid-template-columns: 44px 96px minmax(0, 1fr) auto;
    }

    .calendar-agenda-selected__qty {
        display: grid;
        place-items: center;
        min-height: 46px;
        border-radius: 6px;
        background: #f5f5f5;
        color: #111827;
        font-size: 17px;
        font-weight: 700;
    }

    .calendar-agenda-selected__remove {
        border: 0;
        background: transparent;
        color: #e04f5f;
        font-size: 22px;
    }

    .calendar-agenda-selected__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 22px;
        border-top: 1px solid #e7eef8;
    }

    .calendar-agenda-summary {
        color: #4f84ff;
        font-size: 17px;
        font-weight: 800;
    }

    .calendar-agenda-footer-action {
        min-width: 230px;
        min-height: 54px;
        border: 0;
        border-radius: 8px;
        background: #4f84ff;
        color: #fff;
        font-size: 17px;
        font-weight: 800;
    }

    .calendar-agenda-footer-action:disabled {
        background: #e8edf5;
        color: #a2adbd;
    }

    .calendar-agenda-review-toolbar,
    .calendar-agenda-review-addbar,
    .calendar-agenda-review-list {
        display: none;
    }

    .calendar-sales-topbar,
    .calendar-sales-subfilters,
    .calendar-sales-empty,
    .calendar-sales-grid {
        display: none;
    }

    .calendar-sales-topbar {
        flex-wrap: wrap;
        gap: 12px;
    }

    .calendar-sales-subfilters {
        align-items: center;
        justify-content: space-between;
        gap: 18px;
    }

    .calendar-sales-subfilters__list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px;
    }

    .calendar-sales-subfilter {
        border: 0;
        background: transparent;
        color: #5f6f86;
        font-size: 18px;
        font-weight: 600;
        padding: 0;
    }

    .calendar-sales-subfilter.is-active {
        color: #243041;
    }

    .calendar-sales-subfilters__toggle {
        width: 56px;
        height: 56px;
        border: 0;
        border-radius: 50%;
        background: #f4f7fb;
        color: #243041;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
    }

    .calendar-sales-tab {
        min-height: 52px;
        padding: 0 26px;
        border: 0;
        border-radius: 999px;
        background: #f5f7fa;
        color: #111827;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-sales-tab.is-active {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-sales-empty {
        min-height: 180px;
        padding: 24px;
        border: 1px dashed #d6e2f3;
        border-radius: 16px;
        background: #fbfdff;
        color: #7a8798;
        font-size: 18px;
        font-weight: 700;
        place-items: center;
        text-align: center;
    }

    .calendar-sales-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px 20px;
        align-content: start;
    }

    .calendar-sales-card {
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        padding: 0;
        text-align: left;
        overflow: hidden;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .calendar-sales-card:hover {
        border-color: #8dc5ff;
        box-shadow: 0 12px 24px rgba(79, 132, 255, 0.12);
    }

    .calendar-sales-card.is-clickable {
        cursor: pointer;
    }

    .calendar-sales-card__service,
    .calendar-sales-card__package,
    .calendar-sales-card__product,
    .calendar-sales-card__voucher,
    .calendar-sales-card__payable {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        min-height: 76px;
    }

    .calendar-sales-card__media {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e6edf5;
        color: #243041;
        font-size: 20px;
        font-weight: 800;
        position: relative;
    }

    .calendar-sales-card__media--voucher-yellow {
        background: #ffef5f;
    }

    .calendar-sales-card__media--voucher-green {
        background: #6fd0a0;
        color: #fff;
    }

    .calendar-sales-card__package-dots {
        display: flex;
        gap: 6px;
    }

    .calendar-sales-card__package-dots span {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #8a8f98;
    }

    .calendar-sales-card__product-icon {
        font-size: 46px;
        line-height: 1;
        color: #3b3b3b;
    }

    .calendar-sales-card__body {
        min-width: 0;
        padding: 12px 14px;
    }

    .calendar-sales-card__body strong,
    .calendar-sales-card__voucher-text strong,
    .calendar-sales-card__payable-name {
        display: block;
        color: #111827;
        font-size: 16px;
        font-weight: 700;
    }

    .calendar-sales-card__meta,
    .calendar-sales-card__body small,
    .calendar-sales-card__voucher-text span,
    .calendar-sales-card__payable-meta {
        color: #6f7d91;
        font-size: 14px;
    }

    .calendar-sales-card__meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
    }

    .calendar-sales-card__payable {
        grid-template-columns: 92px minmax(0, 1fr) auto;
        align-items: center;
        min-height: 76px;
        padding: 0 12px 0 0;
    }

    .calendar-sales-card__payable-avatar {
        width: 52px;
        height: 52px;
        margin-left: 12px;
        border-radius: 50%;
        background: #f2f2f2;
        border: 1px solid #e3e7ef;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        font-size: 28px;
        color: #444;
    }

    .calendar-sales-card__payable-avatar::after {
        content: attr(data-qty);
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 24px;
        height: 24px;
        border-radius: 999px;
        background: #333;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 14px;
        font-weight: 700;
    }

    .calendar-sales-card__payable-badge {
        min-width: 88px;
        padding: 8px 18px;
        border: 1px solid #9fc3ff;
        border-radius: 999px;
        color: #4f84ff;
        font-size: 18px;
        font-weight: 700;
        text-align: center;
    }

    .calendar-sales-card__voucher-text {
        padding: 16px 14px;
    }

    .calendar-sales-card__no-result {
        min-height: 340px;
        border-radius: 8px;
        background: #fafbfd;
        display: grid;
        place-items: center;
        text-align: center;
        color: #6e798c;
    }

    .calendar-sales-card__no-result i {
        display: block;
        font-size: 54px;
        margin-bottom: 10px;
        color: #8e98a8;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-sales-topbar {
        display: flex;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-sales-subfilters {
        display: flex;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-sales-grid {
        display: grid;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-review-toolbar,
    .calendar-agenda-modal.is-sales-mode .calendar-agenda-note-panel,
    .calendar-agenda-modal.is-sales-mode .calendar-agenda-review-addbar,
    .calendar-agenda-modal.is-sales-mode .calendar-agenda-review-list,
    .calendar-agenda-modal.is-sales-mode .calendar-agenda-total,
    .calendar-agenda-modal.is-sales-mode .calendar-agenda-actions {
        display: none;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-selected {
        display: block;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-summary {
        color: #4f84ff;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-footer-action {
        background: #4f84ff;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-footer-action:disabled {
        background: #e8edf5;
        color: #a2adbd;
    }

    .calendar-agenda-modal.is-sales-mode .calendar-agenda-services,
    .calendar-agenda-modal.is-sales-mode .js-calendar-service-filters {
        display: none;
    }

    .calendar-agenda-modal.is-sales-mode.is-sales-empty-tab .calendar-sales-empty {
        display: grid;
    }

    .calendar-agenda-modal.is-review-mode .calendar-agenda-picker-search,
    .calendar-agenda-modal.is-review-mode .calendar-agenda-chips,
    .calendar-agenda-modal.is-review-mode .calendar-agenda-services,
    .calendar-agenda-modal.is-review-mode .calendar-agenda-selected {
        display: none;
    }

    .calendar-agenda-modal.is-review-mode .calendar-agenda-review-toolbar,
    .calendar-agenda-modal.is-review-mode .calendar-agenda-review-addbar,
    .calendar-agenda-modal.is-review-mode .calendar-agenda-review-list {
        display: flex;
    }

    .calendar-agenda-review-toolbar {
        align-items: center;
        gap: 10px;
    }

    .calendar-agenda-review-spacer {
        flex: 1;
    }

    .calendar-agenda-review-pill {
        min-height: 58px;
        padding: 0 24px;
        border: 0;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-review-pill i {
        margin-right: 8px;
    }

    .calendar-agenda-date-picker-wrap {
        position: relative;
        display: inline-flex;
    }

    .calendar-agenda-date-picker-wrap input {
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    .calendar-agenda-branch-select {
        position: relative;
    }

    .calendar-agenda-branch-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        z-index: 20;
        min-width: 220px;
        padding: 8px;
        border: 1px solid #dde6f2;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 36px rgba(32, 57, 96, 0.16);
    }

    .calendar-agenda-branch-menu[hidden] {
        display: none;
    }

    .calendar-agenda-branch-menu button {
        width: 100%;
        min-height: 46px;
        border: 0;
        border-radius: 8px;
        background: #eef4ff;
        color: #111827;
        font-size: 15px;
        font-weight: 800;
        text-align: left;
        padding: 0 14px;
    }

    .calendar-agenda-review-addbar {
        align-items: center;
        justify-content: space-between;
        min-height: 58px;
        padding: 0 22px;
        border-radius: 8px;
        background: #f5f8fc;
        color: #6c7688;
        font-size: 18px;
    }

    .calendar-agenda-review-list {
        flex-direction: column;
        gap: 24px;
        overflow: auto;
        min-height: 0;
        padding-bottom: 22px;
    }

    .calendar-agenda-review-card {
        position: relative;
        border: 1px solid #dfe5ed;
        border-radius: 8px;
        padding: 24px 18px 28px;
        background: #fff;
    }

    .calendar-agenda-review-card__head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 34px;
        align-items: center;
        gap: 16px;
    }

    .calendar-agenda-review-card__toggle {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        align-items: center;
        gap: 16px;
        border: 0;
        background: transparent;
        padding: 0;
        text-align: left;
    }

    .calendar-agenda-review-number {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 8px;
        background: #b9e4ff;
        color: #111827;
        font-size: 18px;
        font-weight: 700;
    }

    .calendar-agenda-review-card strong {
        display: block;
        color: #111827;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.2;
    }

    .calendar-agenda-review-card__meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
        color: #111827;
        font-size: 15px;
    }

    .calendar-agenda-review-remove {
        border: 0;
        background: transparent;
        color: #e04f5f;
        font-size: 24px;
    }

    .calendar-agenda-review-card.is-collapsed {
        padding: 22px 18px;
        border-color: transparent;
        background: #f6f6f6;
    }

    .calendar-agenda-review-card.is-collapsed .calendar-agenda-review-fields {
        display: none;
    }

    .calendar-agenda-review-card.is-collapsed .calendar-agenda-review-warning {
        display: none;
    }

    .calendar-agenda-review-card.is-collapsed strong {
        font-size: 16px;
    }

    .calendar-agenda-review-confirm {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 1065;
        width: 230px;
        padding: 14px 16px;
        border: 1px solid #e3e9f2;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 12px 24px rgba(32, 57, 96, 0.14);
    }

    .calendar-agenda-review-confirm[hidden] {
        display: none;
    }

    .calendar-agenda-review-confirm::after {
        content: "";
        position: absolute;
        left: 50%;
        width: 18px;
        height: 18px;
        background: #fff;
        transform: translateX(-50%) rotate(45deg);
    }

    .calendar-agenda-review-confirm.is-below::after {
        top: -9px;
        border-left: 1px solid #e3e9f2;
        border-top: 1px solid #e3e9f2;
    }

    .calendar-agenda-review-confirm.is-above::after {
        bottom: -9px;
        border-right: 1px solid #e3e9f2;
        border-bottom: 1px solid #e3e9f2;
    }

    .calendar-agenda-review-confirm p {
        margin: 0 0 16px;
        color: #111827;
        font-size: 15px;
        line-height: 1.3;
    }

    .calendar-agenda-review-confirm__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .calendar-agenda-review-confirm__cancel,
    .calendar-agenda-review-confirm__yes {
        min-width: 58px;
        min-height: 38px;
        border: 0;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 800;
    }

    .calendar-agenda-review-confirm__cancel {
        background: transparent;
        color: #5b7ff3;
    }

    .calendar-agenda-review-confirm__yes {
        background: #5b7ff3;
        color: #fff;
    }

    .calendar-agenda-review-fields {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 28px;
    }

    .calendar-agenda-review-warning {
        margin-top: 22px;
        padding: 16px 22px;
        border-radius: 8px;
        background: #fff5df;
        color: #111827;
        font-size: 16px;
        line-height: 1.35;
    }

    .calendar-agenda-review-warning[hidden] {
        display: none;
    }

    .calendar-agenda-review-field label {
        display: block;
        margin-bottom: 8px;
        color: #4b5563;
        font-size: 14px;
        font-weight: 600;
    }

    .calendar-agenda-review-field {
        position: relative;
    }

    .calendar-agenda-review-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-height: 56px;
        padding: 0 16px;
        border: 0;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 18px;
        text-align: left;
    }

    .calendar-agenda-review-box.is-muted {
        color: #a6afbd;
    }

    .calendar-agenda-review-box.is-open {
        outline: 1px solid #5b7ff3;
        background: #fff;
    }

    .calendar-agenda-review-popover {
        position: absolute;
        left: 0;
        top: calc(100% + 8px);
        z-index: 30;
        width: 100%;
        border: 1px solid #dfe5ed;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 16px 32px rgba(32, 57, 96, 0.16);
    }

    .calendar-agenda-review-popover[hidden] {
        display: none;
    }

    .calendar-agenda-review-popover::before {
        content: "";
        position: absolute;
        left: 48px;
        top: -9px;
        width: 18px;
        height: 18px;
        border-left: 1px solid #dfe5ed;
        border-top: 1px solid #dfe5ed;
        background: #fff;
        transform: rotate(45deg);
    }

    .calendar-agenda-review-time-popover {
        width: min(430px, calc(100vw - 48px));
        overflow: hidden;
    }

    .calendar-agenda-review-time-popover .calendar-agenda-time-picker {
        display: grid;
        margin: 0;
        box-shadow: none;
    }

    .calendar-agenda-review-options {
        max-height: 330px;
        overflow: auto;
        padding: 8px 0;
    }

    .calendar-agenda-review-option {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 54px;
        padding: 0 24px;
        border: 0;
        background: #fff;
        color: #606875;
        font-size: 18px;
        text-align: left;
    }

    .calendar-agenda-review-option:hover,
    .calendar-agenda-review-option.is-active {
        background: #f2f6ff;
        color: #111827;
        font-weight: 700;
    }

    .calendar-agenda-tool-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1060;
        background: rgba(17, 24, 39, 0.55);
    }

    .calendar-agenda-tool-backdrop[hidden] {
        display: none;
    }

    .calendar-agenda-time-dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 1061;
        width: min(500px, calc(100vw - 32px));
        max-height: calc(100dvh - 40px);
        overflow: auto;
        transform: translate(-50%, -50%);
        padding: 28px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-time-dialog[hidden] {
        display: none;
    }

    .calendar-agenda-time-dialog h3 {
        margin: 0 0 28px;
        color: #1f2937;
        font-size: 26px;
        font-weight: 800;
        line-height: 1.15;
    }

    .calendar-agenda-time-display {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 56px;
        margin-bottom: 0;
        padding: 0 18px;
        border: 0;
        border-radius: 8px;
        background: #f5f5f5;
        color: #111827;
        font-size: 24px;
        text-align: left;
    }

    .calendar-agenda-time-display i {
        color: #a7adb8;
        font-size: 18px;
    }

    .calendar-agenda-time-picker {
        display: none;
        grid-template-columns: 1fr 1fr;
        margin-bottom: 18px;
        border-radius: 0 0 8px 8px;
        overflow: hidden;
        box-shadow: 0 10px 24px rgba(32, 57, 96, 0.12);
    }

    .calendar-agenda-time-dialog.is-time-picker-open .calendar-agenda-time-display {
        border-radius: 8px 8px 0 0;
    }

    .calendar-agenda-time-dialog.is-time-picker-open .calendar-agenda-time-picker {
        display: grid;
    }

    .calendar-agenda-time-column {
        max-height: 192px;
        overflow: auto;
        background: #fff;
    }

    .calendar-agenda-time-column + .calendar-agenda-time-column {
        border-left: 1px solid #eef2f7;
    }

    .calendar-agenda-time-column__label,
    .calendar-agenda-time-option {
        display: grid;
        place-items: center;
        min-height: 42px;
    }

    .calendar-agenda-time-column__label {
        color: #a7adb8;
        font-weight: 800;
    }

    .calendar-agenda-time-option {
        width: 100%;
        border: 0;
        background: #fff;
        color: #111827;
        font-size: 16px;
    }

    .calendar-agenda-time-option.is-active {
        background: #5b7ff3;
        color: #fff;
        font-weight: 800;
    }

    .calendar-block-modal .modal-dialog {
        max-width: 560px;
    }

    .calendar-block-modal .modal-content {
        border: 0;
        border-radius: 18px;
        box-shadow: 0 26px 64px rgba(24, 41, 76, 0.24);
        overflow: visible;
    }

    .calendar-block-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 22px 8px;
        border: 0;
    }

    .calendar-block-modal__header h3 {
        margin: 0;
        color: #243041;
        font-size: 24px;
        font-weight: 800;
    }

    .calendar-block-modal__close {
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #2f3b4c;
        font-size: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .calendar-block-modal__body {
        padding: 4px 22px 22px;
    }

    .calendar-block-form {
        position: relative;
        display: grid;
        gap: 14px;
    }

    .calendar-block-form__field label,
    .calendar-block-form__times label {
        display: block;
        margin-bottom: 8px;
        color: #3b4656;
        font-size: 13px;
        font-weight: 600;
    }

    .calendar-block-form__select,
    .calendar-block-form__date,
    .calendar-block-form__time-trigger,
    .calendar-block-form textarea {
        width: 100%;
        min-height: 52px;
        border: 0;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 16px;
        line-height: 1.2;
        box-shadow: inset 0 0 0 1px #edf2f8;
    }

    .calendar-block-form__select,
    .calendar-block-form__date {
        appearance: none;
        -webkit-appearance: none;
        padding: 0 42px 0 16px;
    }

    .calendar-block-form__select-wrap,
    .calendar-block-form__date-wrap,
    .calendar-block-form__time-wrap {
        position: relative;
    }

    .calendar-block-form__select-wrap i,
    .calendar-block-form__date-wrap i,
    .calendar-block-form__time-trigger i {
        color: #b3bdcb;
    }

    .calendar-block-form__select-wrap > i,
    .calendar-block-form__date-wrap > i {
        position: absolute;
        top: 50%;
        right: 16px;
        transform: translateY(-50%);
        font-size: 16px;
        pointer-events: none;
    }

    .calendar-block-form__date-wrap > i:first-child {
        left: 14px;
        right: auto;
    }

    .calendar-block-form__date {
        padding-left: 42px;
        cursor: pointer;
    }

    .calendar-block-form__times {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }

    .calendar-block-form__time-trigger {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 16px;
        text-align: left;
    }

    .calendar-block-form__time-trigger span {
        color: #111827;
    }

    .calendar-block-form__time-trigger.is-placeholder span {
        color: #c2cad6;
    }

    .calendar-block-form__time-trigger.is-open {
        box-shadow: inset 0 0 0 2px #4f84ff;
        background: #ffffff;
    }

    .calendar-block-form textarea {
        min-height: 92px;
        padding: 14px 16px;
        resize: vertical;
        font-size: 15px;
    }

    .calendar-block-form__actions {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        align-items: end;
        margin-top: 4px;
    }

    .calendar-block-form__delete,
    .calendar-block-form__cancel,
    .calendar-block-form__save {
        min-height: 48px;
        border: 0;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 800;
    }

    .calendar-block-form__delete {
        min-width: 108px;
        background: #e04f5f;
        color: #fff;
    }

    .calendar-block-form__cancel {
        background: #fff;
        color: #5a6678;
        box-shadow: inset 0 0 0 1px #d6e1ef;
    }

    .calendar-block-form__save {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-block-form__save:disabled {
        background: #e7edf7;
        color: #adb8c7;
    }

    .calendar-block-form__delete[hidden] {
        display: none;
    }

    .calendar-block-time-popover {
        position: absolute;
        z-index: 40;
        width: 320px;
        padding: 8px 0 0;
    }

    .calendar-block-time-popover[hidden] {
        display: none;
    }

    .calendar-block-time-popover__panel {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        border: 1px solid #e0e8f3;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 18px 44px rgba(27, 41, 66, 0.18);
        overflow: hidden;
    }

    .calendar-block-time-popover__column {
        max-height: 210px;
        overflow: auto;
        padding-bottom: 6px;
    }

    .calendar-block-time-popover__column + .calendar-block-time-popover__column {
        border-left: 1px solid #eef3f8;
    }

    .calendar-block-time-popover__label,
    .calendar-block-time-popover__option {
        min-height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1f2937;
        font-size: 14px;
    }

    .calendar-block-time-popover__label {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #fff;
        color: #afb8c6;
        font-weight: 700;
    }

    .calendar-block-time-popover__option {
        width: 100%;
        border: 0;
        background: transparent;
    }

    .calendar-block-time-popover__option.is-active {
        background: #eef4ff;
        color: #4f84ff;
        font-weight: 800;
    }

    .calendar-event-card.is-blocked {
        background: #3c3c3c;
        border-color: #3c3c3c;
    }

    .calendar-event-card.is-blocked .calendar-event-card__service:empty {
        display: none;
    }

    .calendar-agenda-time-services {
        display: grid;
        gap: 12px;
        margin-top: 48px;
        margin-bottom: 22px;
    }

    .calendar-agenda-time-dialog.is-time-picker-open .calendar-agenda-time-services {
        margin-top: 0;
    }

    .calendar-agenda-time-service {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 52px;
        padding: 0 16px;
        border: 1px solid #dfe5ed;
        border-radius: 4px;
        background: #fff;
        color: #111827;
        font-size: 15px;
        font-weight: 700;
    }

    .calendar-agenda-time-service span:last-child {
        font-weight: 500;
    }

    .calendar-agenda-time-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .calendar-agenda-time-actions button {
        min-height: 54px;
        border: 0;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-time-cancel {
        background: #f5f5f5;
        color: #111827;
    }

    .calendar-agenda-time-save {
        background: #5b7ff3;
        color: #fff;
    }

    .calendar-agenda-note-panel {
        position: relative;
    }

    .calendar-agenda-note-panel[hidden] {
        display: none;
    }

    .calendar-agenda-note-panel textarea {
        width: 100%;
        min-height: 112px;
        padding: 24px 56px 18px 24px;
        border: 1px solid #5b7ff3;
        border-radius: 8px;
        background: #fff;
        color: #111827;
        font-size: 22px;
        resize: vertical;
        outline: none;
    }

    .calendar-agenda-note-panel button {
        position: absolute;
        top: 22px;
        right: 18px;
        border: 0;
        background: transparent;
        color: #e04f5f;
        font-size: 22px;
    }

    .calendar-agenda-repeat-dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 1061;
        width: min(600px, calc(100vw - 32px));
        max-height: calc(100dvh - 40px);
        overflow: auto;
        transform: translate(-50%, -50%);
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-repeat-dialog[hidden] {
        display: none;
    }

    .calendar-agenda-repeat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 28px 28px 24px;
    }

    .calendar-agenda-repeat-header h3 {
        margin: 0;
        color: #111827;
        font-size: 26px;
        font-weight: 800;
    }

    .calendar-agenda-repeat-switch {
        position: relative;
        display: inline-flex;
        width: 56px;
        height: 28px;
        border-radius: 999px;
        background: #dfe3eb;
        cursor: pointer;
    }

    .calendar-agenda-repeat-switch input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .calendar-agenda-repeat-switch span {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #fff;
        transition: transform .18s ease;
    }

    .calendar-agenda-repeat-switch input:checked + span {
        transform: translateX(28px);
    }

    .calendar-agenda-repeat-switch.is-checked,
    .calendar-agenda-repeat-switch:has(input:checked) {
        background: #5b7ff3;
    }

    .calendar-agenda-repeat-body {
        padding: 0 28px 28px;
    }

    .calendar-agenda-repeat-empty {
        margin: 0 -28px 0;
        padding: 58px 64px;
        background: #f1f1f1;
        color: #6b7280;
        font-size: 18px;
        line-height: 1.45;
    }

    .calendar-agenda-repeat-fields {
        display: none;
        gap: 24px;
    }

    .calendar-agenda-repeat-dialog.is-enabled .calendar-agenda-repeat-empty {
        display: none;
    }

    .calendar-agenda-repeat-dialog.is-enabled .calendar-agenda-repeat-fields {
        display: grid;
    }

    .calendar-agenda-repeat-field label {
        display: block;
        margin-bottom: 8px;
        color: #111827;
        font-size: 15px;
        font-weight: 600;
    }

    .calendar-agenda-repeat-select,
    .calendar-agenda-repeat-date,
    .calendar-agenda-repeat-count input {
        width: 100%;
        min-height: 56px;
        border: 0;
        border-radius: 8px;
        background: #f5f5f5;
        color: #111827;
        font-size: 18px;
        padding: 0 18px;
    }

    .calendar-agenda-repeat-end-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid #dbe1ea;
        border-radius: 6px;
        overflow: hidden;
    }

    .calendar-agenda-repeat-end-tabs button {
        min-height: 58px;
        border: 0;
        background: #fff;
        color: #4b5563;
        font-size: 17px;
        font-weight: 800;
    }

    .calendar-agenda-repeat-end-tabs button.is-active {
        background: #5b7ff3;
        color: #fff;
    }

    .calendar-agenda-repeat-count {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
    }

    .calendar-agenda-repeat-count span {
        color: #111827;
        font-size: 17px;
        font-weight: 600;
    }

    .calendar-agenda-repeat-specific[hidden],
    .calendar-agenda-repeat-count[hidden] {
        display: none;
    }

    .calendar-agenda-total {
        display: none;
        flex: 0 0 auto;
        padding: 0 0 18px;
        border-bottom: 1px solid #e7eef8;
        color: #e04f5f;
        font-size: 18px;
        font-weight: 500;
        text-align: center;
    }

    .calendar-agenda-modal.is-review-mode .calendar-agenda-total {
        display: block;
    }

    .calendar-agenda-modal.is-empty-review .calendar-agenda-total {
        display: none;
    }

    .calendar-agenda-review-empty {
        border: 1px solid #dfe5ed;
        border-radius: 0;
        padding: 20px 16px 28px;
        background: #fff;
    }

    .calendar-agenda-review-empty label {
        display: block;
        margin-bottom: 8px;
        color: #111827;
        font-size: 14px;
        font-weight: 700;
    }

    .calendar-agenda-review-empty__row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 28px;
    }

    .calendar-agenda-review-empty__add {
        min-height: 56px;
        border: 1px solid #d8dfe9;
        border-radius: 8px;
        background: #fff;
        color: #4f84ff;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-customer-empty {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .calendar-agenda-customer-field {
        min-height: 58px;
        margin: 22px 24px 0;
        border-radius: 8px;
        background: #eef3fa;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        align-items: center;
        overflow: hidden;
    }

    .calendar-agenda-customer-field__back {
        display: grid;
        place-items: center;
        height: 100%;
        border: 0;
        background: transparent;
        color: #8a96a8;
        font-size: 18px;
    }

    .calendar-agenda-walkin-copy {
        margin: 28px 24px 8px;
        color: #627086;
        font-size: 17px;
        line-height: 1.5;
        text-align: center;
    }

    .calendar-agenda-customer-new {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 58px;
        margin-top: 40px;
        padding: 0 24px 0 30px;
        border: 0;
        border-top: 1px solid #f0f3f8;
        border-bottom: 1px solid #f0f3f8;
        background: #f8fbff;
        color: #111827;
        text-decoration: none;
        font-size: 18px;
        font-weight: 800;
    }

    .calendar-agenda-customer-new i {
        color: #6b7280;
        font-size: 24px;
    }

    .calendar-agenda-customer-list {
        display: grid;
        gap: 0;
        margin-top: 8px;
        min-height: 0;
        overflow-y: auto;
        padding-bottom: 18px;
    }

    .calendar-agenda-customer-row {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        min-height: 84px;
        padding: 10px 24px;
        border: 0;
        background: #fff;
        text-align: left;
    }

    .calendar-agenda-customer-row:hover,
    .calendar-agenda-customer-row.is-active {
        background: #edf5ff;
    }

    .calendar-agenda-customer-row strong {
        display: block;
        color: #111827;
        font-size: 20px;
        font-weight: 500;
    }

    .calendar-agenda-customer-row__tag {
        display: inline-flex;
        margin-top: 6px;
        padding: 5px 10px;
        border-radius: 8px;
        background: #f2f5f9;
        color: #111827;
        font-size: 13px;
        font-weight: 700;
    }

    .calendar-agenda-customer-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 30px 24px;
    }

    .calendar-agenda-customer-card[hidden],
    .calendar-agenda-customer-empty[hidden] {
        display: none;
    }

    .calendar-agenda-customer-avatar {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: #edf2f7;
        color: #526174;
        font-size: 28px;
    }

    .calendar-agenda-customer-card strong {
        display: block;
        color: #111827;
        font-size: 20px;
        font-weight: 800;
    }

    .calendar-agenda-customer-card span {
        display: inline-flex;
        margin-top: 5px;
        padding: 5px 10px;
        border-radius: 8px;
        background: #edf5ff;
        color: #24405f;
        font-size: 13px;
        font-weight: 700;
    }

    .calendar-agenda-customer-reset {
        margin-left: auto;
        border: 0;
        background: transparent;
        color: #6c7688;
        font-size: 23px;
    }

    .calendar-agenda-customer-menu-wrap {
        position: relative;
        margin-left: auto;
    }

    .calendar-agenda-customer-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 18px);
        z-index: 5;
        min-width: 260px;
        padding: 18px 0;
        border: 1px solid #e1e7f0;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 22px 40px rgba(32, 57, 96, 0.16);
    }

    .calendar-agenda-customer-menu[hidden] {
        display: none;
    }

    .calendar-agenda-customer-menu::before {
        content: "";
        position: absolute;
        top: -10px;
        right: 22px;
        width: 18px;
        height: 18px;
        border-left: 1px solid #e1e7f0;
        border-top: 1px solid #e1e7f0;
        background: #fff;
        transform: rotate(45deg);
    }

    .calendar-agenda-customer-menu button {
        display: block;
        width: 100%;
        padding: 12px 26px;
        border: 0;
        background: transparent;
        color: #4b5563;
        text-align: left;
        font-size: 18px;
    }

    .calendar-agenda-customer-menu button.is-danger {
        color: #dc2626;
    }

    .calendar-agenda-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        padding: 24px;
        flex: 0 0 auto;
    }

    .calendar-agenda-actions button {
        min-height: 56px;
        border: 0;
        border-radius: 8px;
        background: #eef3fa;
        color: #9aa7b8;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-actions .calendar-agenda-save:not(:disabled) {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-agenda-actions .calendar-agenda-checkout:not(:disabled) {
        background: #f5f7fa;
        color: #111827;
    }

    .calendar-agenda-checkout-left,
    .calendar-agenda-checkout-payment {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-review-toolbar,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-note-panel,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-review-addbar,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-review-list,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-picker-search,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-chips,
    .calendar-agenda-modal.is-checkout-mode .calendar-sales-topbar,
    .calendar-agenda-modal.is-checkout-mode .calendar-sales-subfilters,
    .calendar-agenda-modal.is-checkout-mode .calendar-sales-grid,
    .calendar-agenda-modal.is-checkout-mode .calendar-sales-empty,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-services,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-selected,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-total,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-actions {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-checkout-left {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-picker-search {
        display: grid;
        border: 0;
        background: #f5f7fa;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-chips {
        display: flex;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-services {
        display: grid;
        overflow: auto;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-selected {
        display: block;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-item-picker .calendar-agenda-selected__rows {
        max-height: 190px;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-sales-topbar {
        display: flex;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-sales-subfilters {
        display: flex;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-sales-grid {
        display: grid;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-sales-empty {
        display: none;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker.is-sales-empty-tab .calendar-sales-empty {
        display: grid;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-agenda-chips,
    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-agenda-services {
        display: none;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode.is-checkout-item-picker .calendar-agenda-selected {
        display: block;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-left {
        gap: 18px;
        overflow-y: auto;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-right > div:first-child {
        flex: 0 0 auto;
        overflow: visible;
        position: relative;
        z-index: 20;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-right {
        overflow: visible;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-checkout-left {
        display: flex;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-checkout-payment {
        display: flex;
    }

    .calendar-agenda-checkout-left {
        flex: 0 0 auto;
        min-height: min-content;
        flex-direction: column;
        gap: 22px;
        padding-bottom: 28px;
        overflow: visible;
    }

    .calendar-sales-cart-toolbar {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
    }

    .calendar-sales-cart-toolbar__date {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 0 18px;
        border: 0;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 16px;
        font-weight: 700;
    }

    .calendar-sales-cart-toolbar__date i {
        color: #b7c0cf;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode .calendar-sales-cart-toolbar {
        display: flex;
    }

    .calendar-agenda-modal.is-sales-mode.is-checkout-mode .calendar-agenda-checkout-left > .calendar-agenda-checkout-branch {
        display: none;
    }

    .calendar-agenda-checkout-branch {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 52px;
        color: #111827;
        font-size: 17px;
        font-weight: 800;
    }

    .calendar-agenda-checkout-search {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 36px;
        align-items: center;
        min-height: 64px;
        padding: 0 22px;
        border: 0;
        border-radius: 8px;
        background: #f5f7fa;
        color: #697589;
        font-size: 17px;
        font-weight: 700;
        text-align: left;
    }

    .calendar-agenda-checkout-search i {
        justify-self: end;
        color: #4d5f79;
        font-size: 20px;
    }

    .calendar-agenda-checkout-list {
        display: grid;
        gap: 16px;
        min-height: 0;
        overflow: visible;
    }

    .calendar-agenda-checkout-card {
        position: relative;
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr) auto 34px;
        align-items: center;
        gap: 14px;
        min-height: 104px;
        padding: 18px;
        border-radius: 8px;
        background: #f7f7f7;
    }

    .calendar-agenda-checkout-card.is-expanded {
        align-items: start;
        border: 1px solid #dfe5ed;
        background: #fff;
    }

    .calendar-agenda-checkout-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #c9ced7;
    }

    .calendar-agenda-checkout-main {
        min-width: 0;
        border: 0;
        background: transparent;
        padding: 0;
        text-align: left;
    }

    .calendar-agenda-checkout-card strong {
        display: block;
        color: #111827;
        font-size: 18px;
        font-weight: 800;
    }

    .calendar-agenda-checkout-card small {
        display: block;
        margin-top: 4px;
        color: #667386;
        font-size: 15px;
    }

    .calendar-agenda-checkout-price {
        color: #111827;
        font-size: 17px;
        font-weight: 800;
        text-align: right;
    }

    .calendar-agenda-checkout-price span,
    .calendar-agenda-checkout-price del {
        display: block;
        white-space: nowrap;
    }

    .calendar-agenda-checkout-price del {
        margin-top: 4px;
        color: #111827;
        font-size: 14px;
        font-weight: 600;
    }

    .calendar-agenda-checkout-remove {
        border: 0;
        background: transparent;
        color: #e04f5f;
        font-size: 22px;
    }

    .calendar-agenda-checkout-confirm {
        position: absolute;
        top: 48px;
        right: 18px;
        z-index: 80;
        width: 238px;
        padding: 14px 16px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
    }

    .calendar-agenda-checkout-confirm[hidden] {
        display: none;
    }

    .calendar-agenda-checkout-confirm::after {
        content: "";
        position: absolute;
        right: 22px;
        top: 100%;
        border: 10px solid transparent;
        border-top-color: #fff;
    }

    .calendar-agenda-checkout-confirm p {
        margin: 0 0 12px;
        color: #1f2937;
        font-size: 14px;
        line-height: 1.35;
    }

    .calendar-agenda-checkout-confirm__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .calendar-agenda-checkout-confirm__actions button {
        min-width: 58px;
        min-height: 34px;
        border: 0;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 800;
    }

    .calendar-agenda-checkout-confirm__cancel {
        background: transparent;
        color: #4f84ff;
    }

    .calendar-agenda-checkout-confirm__yes {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-agenda-checkout-fields {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 110px minmax(0, 1.35fr) minmax(0, 1.15fr) minmax(0, 1.5fr);
        gap: 12px;
        margin-top: 20px;
    }

    .calendar-agenda-checkout-field label {
        display: block;
        margin-bottom: 8px;
        color: #4b5563;
        font-size: 14px;
        font-weight: 600;
    }

    .calendar-agenda-checkout-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 56px;
        padding: 0 16px;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 17px;
    }

    .calendar-agenda-checkout-box.is-muted {
        color: #a6afbd;
    }

    .calendar-agenda-checkout-control {
        width: 100%;
        min-height: 56px;
        padding: 0 16px;
        border: 0;
        border-radius: 8px;
        outline: 0;
        background: #f5f7fa;
        color: #111827;
        font-size: 17px;
    }

    .calendar-agenda-checkout-control.is-muted::placeholder {
        color: #a6afbd;
    }

    select.calendar-agenda-checkout-control {
        appearance: none;
        background-image:
            linear-gradient(45deg, transparent 50%, #7d8796 50%),
            linear-gradient(135deg, #7d8796 50%, transparent 50%);
        background-position:
            calc(100% - 18px) 50%,
            calc(100% - 12px) 50%;
        background-size: 6px 6px, 6px 6px;
        background-repeat: no-repeat;
        padding-right: 36px;
    }

    .calendar-agenda-checkout-discount-field {
        position: relative;
    }

    .calendar-agenda-checkout-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 60;
        overflow: hidden;
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
    }

    .calendar-agenda-checkout-dropdown[hidden] {
        display: none;
    }

    .calendar-agenda-checkout-dropdown button {
        display: block;
        width: 100%;
        min-height: 42px;
        padding: 0 16px;
        border: 0;
        background: #fff;
        color: #374151;
        font-size: 14px;
        text-align: left;
    }

    .calendar-agenda-checkout-dropdown button:hover {
        background: #edf5ff;
        color: #315edb;
    }

    .calendar-agenda-checkout-iconbox {
        display: grid;
        place-items: center;
        min-height: 56px;
        margin-top: 27px;
        border-radius: 8px;
        background: #f5f7fa;
        color: #111827;
        font-size: 18px;
    }

    .calendar-agenda-checkout-summary {
        width: min(540px, 100%);
        margin: 8px 0 0 auto;
        color: #111827;
        font-size: 17px;
    }

    .calendar-agenda-checkout-summary-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 8px 0;
    }

    .calendar-agenda-checkout-summary-row a {
        color: #4f84ff;
        text-decoration: none;
        font-weight: 700;
    }

    .calendar-agenda-checkout-summary-row.is-total {
        font-weight: 800;
    }

    .calendar-agenda-checkout-due {
        margin-top: 22px;
        color: #1f2937;
        font-size: 26px;
        font-weight: 800;
        text-align: right;
    }

    .calendar-agenda-checkout-payment {
        flex: 1 1 auto;
        flex-direction: column;
        gap: 12px;
        padding: 32px 24px 24px;
        position: relative;
        z-index: 1;
    }

    .calendar-agenda-checkout-payment-label {
        color: #111827;
        font-size: 18px;
        text-align: center;
    }

    .calendar-agenda-checkout-payment-amount {
        display: block;
        width: 100%;
        min-height: 58px;
        border: 0;
        border-radius: 8px;
        outline: 0;
        background: #f5f7fa;
        color: #111827;
        font-size: 28px;
        text-align: center;
    }

    .calendar-agenda-checkout-payment-amount:disabled {
        color: #9aa7b8;
        opacity: 1;
    }

    .calendar-agenda-checkout-payments {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    .calendar-agenda-checkout-payments button {
        min-height: 54px;
        border: 0;
        border-radius: 8px;
        background: #4f84ff;
        color: #fff;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-checkout-payments button:disabled {
        background: #f0f0f0;
        color: #9aa7b8;
    }

    .calendar-agenda-checkout-payment-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-top: auto;
        padding-top: 18px;
        border-top: 1px solid #e7eef8;
        color: #e04f5f;
        font-size: 18px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-pay-panel .calendar-agenda-checkout-payment-footer span {
        min-width: 0;
    }

    .calendar-agenda-invoice-pay-panel .calendar-agenda-checkout-payment-footer span:last-of-type {
        text-align: right;
        overflow-wrap: anywhere;
    }

    .calendar-agenda-payment-list {
        display: grid;
        gap: 10px;
    }

    .calendar-agenda-payment-row {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        color: #111827;
        font-size: 20px;
    }

    .calendar-agenda-payment-row button {
        border: 0;
        background: transparent;
        color: #e04f5f;
        font-size: 18px;
    }

    .calendar-agenda-payment-row strong {
        font-size: 19px;
        font-weight: 500;
        white-space: nowrap;
    }

    .calendar-agenda-checkout-payment-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }

    .calendar-agenda-checkout-payment-actions button {
        min-height: 56px;
        border: 0;
        border-radius: 8px;
        background: #eef3fa;
        color: #111827;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-checkout-payment-actions button:disabled {
        color: #9aa7b8;
    }

    .calendar-agenda-checkout-payment-actions .js-agenda-payment-complete:not(:disabled),
    .calendar-agenda-checkout-payment-actions .js-agenda-invoice-payment-complete:not(:disabled) {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-agenda-more-wrap {
        position: relative;
        min-width: 0;
    }

    .calendar-agenda-more-wrap > button {
        width: 100%;
    }

    .calendar-agenda-more-menu {
        position: absolute;
        left: 0;
        bottom: calc(100% + 12px);
        z-index: 90;
        width: min(270px, calc(100vw - 36px));
        overflow: visible;
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
    }

    .calendar-agenda-more-menu[hidden] {
        display: none;
    }

    .calendar-agenda-more-menu::after {
        content: "";
        position: absolute;
        left: 58px;
        top: 100%;
        transform: translateX(-50%);
        border: 10px solid transparent;
        border-top-color: #fff;
    }

    .calendar-agenda-more-menu button {
        display: block;
        width: 100%;
        min-height: 52px;
        padding: 0 18px;
        border: 0;
        border-radius: 0;
        background: #fff;
        color: #4b5563;
        font-size: 17px;
        font-weight: 500;
        text-align: left;
        white-space: nowrap;
    }

    .calendar-agenda-more-menu button:hover {
        color: #315edb;
        background: #edf5ff;
    }

    .calendar-agenda-invoice-view {
        position: absolute;
        inset: 0;
        z-index: 135;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .calendar-agenda-invoice-view[hidden] {
        display: none;
    }

    .calendar-agenda-invoice-header {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 58px;
        border-bottom: 1px solid #e6edf6;
    }

    .calendar-agenda-invoice-header h3 {
        margin: 0;
        color: #1f2937;
        font-size: 22px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-close {
        position: absolute;
        top: 50%;
        right: 18px;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: #111827;
        font-size: 22px;
    }

    .calendar-agenda-invoice-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
        width: 100%;
        min-height: 0;
        flex: 1 1 auto;
        overflow: hidden;
    }

    .calendar-agenda-invoice-preview {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 0;
        padding: 20px 24px;
        background: #fff;
    }

    .calendar-agenda-invoice-receipt {
        width: min(300px, 100%);
        padding: 18px 16px 16px;
        background: #fff;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
        color: #111827;
        font-size: 12px;
    }

    .calendar-agenda-invoice-a5 {
        width: min(680px, calc(100% - 96px));
        padding: 14px 14px 12px;
        background: #fff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
        color: #111827;
        font-size: 12px;
    }

    .calendar-agenda-invoice-a5-head {
        display: grid;
        grid-template-columns: 82px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
        margin-bottom: 14px;
    }

    .calendar-agenda-invoice-a5-logo {
        display: grid;
        place-items: center;
        width: 78px;
        height: 78px;
        background: #f7f7f7;
        font-size: 34px;
    }

    .calendar-agenda-invoice-a5-store strong,
    .calendar-agenda-invoice-a5-number strong {
        display: block;
        margin-bottom: 4px;
        font-size: 14px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-a5-number {
        text-align: right;
        white-space: nowrap;
    }

    .calendar-agenda-invoice-a5-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }

    .calendar-agenda-invoice-a5-table th,
    .calendar-agenda-invoice-a5-table td {
        padding: 4px 5px;
        border: 1px solid #333;
        vertical-align: top;
    }

    .calendar-agenda-invoice-a5-table th {
        font-weight: 800;
        text-align: left;
    }

    .calendar-agenda-invoice-a5-table td:not(:first-child) {
        text-align: right;
        white-space: nowrap;
    }

    .calendar-agenda-invoice-a5-totals {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 18px;
        margin-top: 8px;
        padding-top: 4px;
        border-top: 1px solid #333;
        font-size: 12px;
    }

    .calendar-agenda-invoice-a5-totals strong,
    .calendar-agenda-invoice-a5-totals span:nth-child(2n) {
        font-weight: 800;
    }

    .calendar-agenda-invoice-a5-seller {
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #d1d5db;
        text-align: left;
    }

    .calendar-agenda-invoice-tools {
        position: absolute;
        right: 14px;
        top: 30px;
        display: grid;
        gap: 12px;
        z-index: 5;
    }

    .calendar-agenda-invoice-tool {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 999px;
        background: #fff;
        color: #111827;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
        font-size: 19px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-tool.is-active {
        background: #eaf2ff;
        color: #4f84ff;
    }

    .calendar-agenda-invoice-tool.is-lower {
        margin-top: 340px;
        color: #6b7280;
    }

    .calendar-agenda-invoice-store {
        display: grid;
        justify-items: center;
        gap: 6px;
        margin-bottom: 14px;
        text-align: center;
    }

    .calendar-agenda-invoice-store i {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        background: #f6f6f6;
        font-size: 24px;
    }

    .calendar-agenda-invoice-store strong {
        font-size: 14px;
    }

    .calendar-agenda-invoice-address {
        max-width: 320px;
        text-align: center;
        line-height: 1.35;
    }

    .calendar-agenda-invoice-title {
        margin: 12px 0 16px;
        text-align: center;
        font-weight: 800;
    }

    .calendar-agenda-invoice-items {
        display: grid;
        gap: 8px;
        margin-bottom: 10px;
    }

    .calendar-agenda-invoice-line,
    .calendar-agenda-invoice-total-row {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
    }

    .calendar-agenda-invoice-line span:last-child,
    .calendar-agenda-invoice-total-row span:last-child {
        text-align: right;
        white-space: nowrap;
    }

    .calendar-agenda-invoice-total-row {
        padding-top: 6px;
        border-top: 1px solid #111827;
        font-weight: 800;
    }

    .calendar-agenda-invoice-seller {
        margin-top: 18px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
    }

    .calendar-agenda-invoice-side {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        position: relative;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
        border-left: 1px solid #e6edf6;
        padding: 20px 16px 20px 18px;
    }

    .calendar-agenda-invoice-side * {
        box-sizing: border-box;
    }

    .calendar-agenda-invoice-side h4 {
        margin: 0;
        color: #1f2937;
        font-size: 18px;
        font-weight: 800;
        overflow-wrap: anywhere;
    }

    .calendar-agenda-invoice-meta {
        overflow-wrap: anywhere;
    }

    .calendar-agenda-invoice-info,
    .calendar-agenda-invoice-pay-panel {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
    }

    .calendar-agenda-invoice-info[hidden],
    .calendar-agenda-invoice-pay-panel[hidden] {
        display: none;
    }

    .calendar-agenda-invoice-pay-panel {
        gap: 12px;
        padding-top: 38px;
    }

    .calendar-agenda-invoice-payments {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        max-width: 100%;
    }

    .calendar-agenda-invoice-payments button {
        background: #4f84ff;
    }

    .calendar-agenda-invoice-payment-reset {
        flex: 0 0 auto;
        margin-left: -4px;
        border: 0;
        background: transparent;
        color: #df4d61;
        font-size: 15px;
        line-height: 1;
    }

    .calendar-agenda-loyalty-drawer {
        position: absolute;
        inset: 0;
        z-index: 35;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px 20px;
        background: #fff;
    }

    .calendar-agenda-loyalty-drawer[hidden] {
        display: none;
    }

    .calendar-agenda-loyalty-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .calendar-agenda-loyalty-header h3 {
        margin: 0;
        color: #111827;
        font-size: 20px;
        font-weight: 800;
    }

    .calendar-agenda-loyalty-header button {
        border: 0;
        background: transparent;
        color: #555;
        font-size: 24px;
        line-height: 1;
    }

    .calendar-agenda-loyalty-avatar {
        width: 82px;
        height: 82px;
        margin: 12px auto 0;
        border-radius: 50%;
        background: #c8cdd5;
    }

    .calendar-agenda-loyalty-empty {
        display: grid;
        min-height: 132px;
        place-items: center;
        align-content: center;
        gap: 10px;
        padding: 22px;
        background: #f2f2f2;
        color: #777;
        text-align: center;
    }

    .calendar-agenda-loyalty-empty i {
        font-size: 36px;
    }

    .calendar-agenda-invoice-status {
        width: max-content;
        margin: auto auto 28px;
        padding: 8px 22px;
        border: 1px solid #d99030;
        border-radius: 999px;
        color: #d99030;
        font-size: 14px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-status.is-paid {
        border-color: #86d4e6;
        color: #86d4e6;
    }

    .calendar-agenda-invoice-meta {
        color: #6b7280;
        font-size: 14px;
        line-height: 1.5;
        text-align: center;
    }

    .calendar-agenda-invoice-share {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 16px;
        margin: auto 0 20px;
        color: #6b7280;
        font-size: 12px;
    }

    .calendar-agenda-invoice-share button,
    .calendar-agenda-invoice-share a {
        display: grid;
        justify-items: center;
        gap: 6px;
        border: 0;
        background: transparent;
        color: inherit;
        text-decoration: none;
        font: inherit;
    }

    .calendar-agenda-invoice-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        max-width: 100%;
    }

    .calendar-agenda-invoice-more-wrap {
        position: relative;
        min-width: 0;
        z-index: 80;
    }

    .calendar-agenda-invoice-actions button {
        min-width: 0;
        min-height: 42px;
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        color: #4b5563;
        font-size: 14px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-actions button:first-child {
        border: 0;
        background: #f1f4f8;
        color: #111827;
    }

    .calendar-agenda-invoice-more-wrap > button {
        width: 100%;
    }

    .calendar-agenda-invoice-more-menu {
        position: absolute;
        left: 0;
        right: auto;
        bottom: calc(100% + 10px);
        z-index: 180;
        width: min(280px, calc(100vw - 48px));
        max-width: calc(100vw - 48px);
        padding: 6px 0;
        transform: none;
        border: 1px solid #dbe4f1;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
    }

    .calendar-agenda-invoice-more-menu[hidden] {
        display: none;
    }

    .calendar-agenda-invoice-more-menu::after {
        content: "";
        position: absolute;
        left: 24%;
        top: 100%;
        transform: translateX(-50%);
        border: 10px solid transparent;
        border-top-color: #fff;
    }

    .calendar-agenda-invoice-more-menu button {
        display: block;
        width: 100%;
        min-height: 40px;
        padding: 0 16px;
        border: 0;
        border-radius: 0;
        background: #fff;
        color: #4f84ff;
        font-size: 14px;
        font-weight: 700;
        text-align: left;
        white-space: nowrap;
    }

    .calendar-agenda-invoice-more-menu button:hover {
        background: #edf5ff;
    }

    .calendar-agenda-invoice-more-menu button.is-danger {
        color: #e04f5f;
    }

    .calendar-agenda-invoice-detail-modal {
        position: absolute;
        inset: 0;
        z-index: 150;
        display: grid;
        place-items: center;
        background: rgba(17, 24, 39, 0.55);
    }

    .calendar-agenda-invoice-detail-modal[hidden] {
        display: none;
    }

    .calendar-agenda-invoice-detail-box {
        width: min(480px, calc(100vw - 40px));
        padding: 28px 28px 22px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 26px 52px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-invoice-detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 26px;
    }

    .calendar-agenda-invoice-detail-header h3 {
        margin: 0;
        color: #333;
        font-size: 24px;
        font-weight: 700;
    }

    .calendar-agenda-invoice-detail-header button {
        border: 0;
        background: transparent;
        color: #333;
        font-size: 20px;
    }

    .calendar-agenda-invoice-detail-field {
        margin-bottom: 16px;
    }

    .calendar-agenda-invoice-detail-field label {
        display: block;
        margin-bottom: 6px;
        color: #333;
        font-size: 14px;
    }

    .calendar-agenda-invoice-detail-field select,
    .calendar-agenda-invoice-detail-field textarea {
        width: 100%;
        border: 0;
        border-radius: 8px;
        outline: 0;
        background: #f5f5f5;
        color: #333;
        font-size: 16px;
    }

    .calendar-agenda-invoice-detail-field select {
        min-height: 48px;
        padding: 0 16px;
    }

    .calendar-agenda-invoice-detail-field textarea {
        min-height: 150px;
        padding: 14px 16px;
        resize: vertical;
    }

    .calendar-agenda-invoice-detail-actions {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 28px;
    }

    .calendar-agenda-invoice-detail-actions button {
        min-width: 96px;
        min-height: 44px;
        border: 0;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 800;
    }

    .calendar-agenda-invoice-detail-actions button:first-child {
        background: #f5f5f5;
        color: #111827;
    }

    .calendar-agenda-invoice-detail-actions button:last-child {
        background: #4f84ff;
        color: #fff;
    }

    .calendar-agenda-payment-detail-modal,
    .calendar-agenda-void-invoice-modal {
        position: absolute;
        inset: 0;
        z-index: 160;
        display: grid;
        place-items: center;
        background: rgba(17, 24, 39, 0.55);
    }

    .calendar-agenda-payment-detail-modal[hidden],
    .calendar-agenda-void-invoice-modal[hidden] {
        display: none;
    }

    .calendar-agenda-payment-detail-box,
    .calendar-agenda-void-invoice-box {
        width: min(490px, calc(100vw - 40px));
        padding: 26px 28px 20px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 26px 52px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-payment-detail-header,
    .calendar-agenda-void-invoice-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 28px;
    }

    .calendar-agenda-payment-detail-header h3,
    .calendar-agenda-void-invoice-header h3 {
        margin: 0;
        color: #333;
        font-size: 22px;
        font-weight: 800;
    }

    .calendar-agenda-payment-detail-header button,
    .calendar-agenda-void-invoice-header button {
        border: 0;
        background: transparent;
        color: #333;
        font-size: 18px;
    }

    .calendar-agenda-payment-detail-field {
        margin-bottom: 26px;
    }

    .calendar-agenda-payment-detail-field label {
        display: block;
        margin-bottom: 8px;
        color: #333;
        font-size: 14px;
    }

    .calendar-agenda-payment-detail-field select {
        width: 100%;
        min-height: 48px;
        padding: 0 16px;
        border: 0;
        border-radius: 8px;
        outline: 0;
        background: #f5f5f5;
        color: #333;
        font-size: 16px;
    }

    .calendar-agenda-payment-detail-actions,
    .calendar-agenda-void-invoice-actions {
        display: flex;
        justify-content: center;
        gap: 14px;
    }

    .calendar-agenda-payment-detail-actions button,
    .calendar-agenda-void-invoice-actions button {
        min-width: 118px;
        min-height: 44px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 800;
    }

    .calendar-agenda-payment-detail-cancel,
    .calendar-agenda-void-invoice-cancel {
        border: 1px solid #dbe4f1;
        background: #fff;
        color: #4b5563;
    }

    .calendar-agenda-payment-detail-save {
        border: 1px solid #dbe4f1;
        background: #fff;
        color: #4b5563;
    }

    .calendar-agenda-void-invoice-box p {
        margin: 0 0 42px;
        color: #333;
        font-size: 15px;
    }

    .calendar-agenda-void-invoice-confirm {
        border: 0;
        background: #e04f5f;
        color: #fff;
    }

    .calendar-agenda-voucher-drawer {
        position: absolute;
        inset: 0;
        z-index: 170;
        display: flex;
        justify-content: flex-end;
        background: rgba(17, 24, 39, 0.55);
    }

    .calendar-agenda-voucher-drawer[hidden] {
        display: none;
    }

    .calendar-agenda-voucher-panel {
        width: min(420px, 78vw);
        height: 100%;
        padding: 28px 26px;
        background: #fff;
        box-shadow: -22px 0 46px rgba(15, 23, 42, 0.18);
    }

    .calendar-agenda-voucher-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 26px;
    }

    .calendar-agenda-voucher-header h3 {
        margin: 0;
        color: #333;
        font-size: 26px;
        font-weight: 500;
    }

    .calendar-agenda-voucher-header button {
        border: 0;
        background: transparent;
        color: #333;
        font-size: 22px;
    }

    .calendar-agenda-voucher-search {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 28px;
        align-items: center;
        gap: 10px;
        min-height: 58px;
        padding: 0 18px;
        border-radius: 8px;
        background: #f5f5f5;
    }

    .calendar-agenda-voucher-search input {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #333;
        font-size: 20px;
    }

    .calendar-agenda-voucher-search input::placeholder {
        color: #b4bbc5;
    }

    .calendar-agenda-voucher-search__scan {
        width: 28px;
        height: 28px;
        border: 0;
        padding: 0;
        background: transparent;
        color: #333;
        font-size: 22px;
    }

    .calendar-agenda-voucher-list {
        display: grid;
        gap: 16px;
        margin-top: 18px;
        padding-right: 4px;
        overflow-y: auto;
        max-height: calc(100vh - 180px);
    }

    .calendar-agenda-voucher-card {
        position: relative;
        display: grid;
        gap: 14px;
        padding: 18px 20px 16px;
        border: 1px solid #edf1f7;
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
        text-align: left;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    }

    .calendar-agenda-voucher-card:hover {
        transform: translateY(-1px);
        border-color: #d8e4ff;
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
    }

    .calendar-agenda-voucher-card.is-disabled {
        opacity: 0.5;
        box-shadow: none;
    }

    .calendar-agenda-voucher-card.is-disabled::after {
        content: "Habis digunakan";
        position: absolute;
        right: -42px;
        bottom: 26px;
        width: 220px;
        padding: 8px 0;
        background: rgba(223, 226, 232, 0.95);
        color: #737987;
        font-size: 18px;
        text-align: center;
        transform: rotate(39deg);
    }

    .calendar-agenda-voucher-card__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        color: #3c3c3c;
    }

    .calendar-agenda-voucher-card__type,
    .calendar-agenda-voucher-card__expiry {
        font-size: 16px;
        line-height: 1.2;
    }

    .calendar-agenda-voucher-card__body {
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr);
        gap: 16px;
        align-items: center;
    }

    .calendar-agenda-voucher-ticket {
        position: relative;
        width: 52px;
        height: 80px;
        border-radius: 0;
        display: grid;
        place-items: center;
        font-size: 24px;
        font-weight: 800;
        color: #111;
        background: #ffec57;
    }

    .calendar-agenda-voucher-ticket--gift {
        background: #6fd2a2;
        color: #fff;
    }

    .calendar-agenda-voucher-ticket::before,
    .calendar-agenda-voucher-ticket::after {
        content: "";
        position: absolute;
        left: 50%;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        transform: translateX(-50%);
    }

    .calendar-agenda-voucher-ticket::before {
        top: -10px;
    }

    .calendar-agenda-voucher-ticket::after {
        bottom: -10px;
    }

    .calendar-agenda-voucher-card__content {
        min-width: 0;
    }

    .calendar-agenda-voucher-card__title {
        margin: 0;
        color: #e89a29;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.35;
    }

    .calendar-agenda-voucher-card__title--gift {
        color: #4d9d79;
    }

    .calendar-agenda-voucher-card__value {
        margin: 8px 0 0;
        color: #111;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.25;
    }

    .calendar-agenda-voucher-card__footer {
        color: #444;
        font-size: 16px;
    }

    .calendar-agenda-voucher-empty {
        display: grid;
        place-items: center;
        gap: 12px;
        min-height: 150px;
        margin-top: 84px;
        background: #f6f6f6;
        color: #7a7a7a;
        font-size: 22px;
        font-weight: 700;
    }

    .calendar-agenda-voucher-empty i {
        font-size: 42px;
        font-weight: 400;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-empty {
        height: auto;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-field {
        grid-template-columns: minmax(0, 1fr);
        margin: 24px 24px 0;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-field__back,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-new,
    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-list {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-search {
        padding: 0 16px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-walkin-copy {
        margin: 58px 24px 0;
        color: #627086;
        font-size: 18px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-card {
        position: relative;
        z-index: 30;
        padding: 42px 24px 30px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-card .js-agenda-customer-tag {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-menu {
        z-index: 80;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-customer-field {
        grid-template-columns: 58px minmax(0, 1fr);
        margin: 24px 24px 0;
        border: 1px solid #5b7ff3;
        background: #fff;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-customer-field__back {
        display: grid;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-customer-new {
        display: flex;
        margin-top: 56px;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-customer-list {
        display: grid;
        max-height: 430px;
        overflow-y: auto;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-walkin-copy,
    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-checkout-payment-label,
    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-checkout-payment-amount,
    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-checkout-payments {
        display: none;
    }

    .calendar-agenda-modal.is-checkout-mode.is-checkout-customer-search .calendar-agenda-checkout-payment {
        padding-top: 0;
    }

    .calendar-agenda-item-dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 1061;
        transform: translate(-50%, -50%);
        width: min(420px, calc(100vw - 32px));
        padding: 22px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-item-dialog[hidden] {
        display: none;
    }

    .calendar-agenda-item-dialog h3 {
        margin: 0;
        color: #1f2937;
        font-size: 24px;
        font-weight: 800;
    }

    .calendar-agenda-item-dialog__subtitle {
        margin-top: 6px;
        color: #1f2937;
        font-size: 16px;
    }

    .calendar-agenda-item-dialog__count {
        margin: 6px 0 16px;
        color: #111827;
        font-size: 18px;
    }

    .calendar-agenda-item-dialog__choice {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 12px;
        background: #edf5ff;
        color: #111827;
        font-size: 15px;
    }

    .calendar-agenda-item-dialog__choice strong {
        display: block;
        margin-bottom: 6px;
        font-size: 17px;
    }

    .calendar-agenda-item-dialog__meta {
        display: block;
        margin-bottom: 6px;
        color: #6f7d91;
        font-size: 15px;
    }

    .calendar-agenda-item-dialog__choice i {
        align-self: center;
        color: #4f84ff;
        font-size: 24px;
    }

    .calendar-agenda-item-dialog__qty {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr) 64px;
        align-items: center;
        gap: 14px;
        margin: 26px 0 34px;
    }

    .calendar-agenda-item-dialog__qty button {
        min-height: 50px;
        border: 0;
        background: transparent;
        color: #111827;
        font-size: 24px;
        font-weight: 800;
    }

    .calendar-agenda-item-dialog__qty span {
        display: grid;
        place-items: center;
        min-height: 54px;
        border-radius: 6px;
        background: #f5f5f5;
        color: #111827;
        font-size: 22px;
        font-weight: 800;
    }

    .calendar-agenda-item-dialog__actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }

    .calendar-agenda-item-dialog__actions button {
        min-height: 56px;
        border: 0;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 800;
    }

    .calendar-agenda-item-dialog__cancel {
        background: #f5f5f5;
        color: #111827;
    }

    .calendar-agenda-item-dialog__add {
        background: #4f84ff;
        color: #fff;
    }

    /* Compact agenda density for Chrome 100% */
    .calendar-agenda-modal__header {
        height: 64px;
        flex-basis: 64px;
        padding: 10px 18px;
    }

    .calendar-agenda-modal__header h2 {
        font-size: 25px;
    }

    .calendar-agenda-modal__header .btn-close {
        font-size: 18px;
    }

    .calendar-agenda-modal__body {
        height: calc(100dvh - 64px);
        grid-template-columns: minmax(0, 1fr) 390px;
    }

    .calendar-agenda-left,
    .calendar-agenda-right {
        height: calc(100dvh - 64px);
    }

    .calendar-agenda-left {
        gap: 14px;
        padding: 18px 18px 0;
    }

    .calendar-agenda-searchbar {
        min-height: 56px;
    }

    .calendar-agenda-searchbar input,
    .calendar-agenda-customer-search {
        font-size: 16px;
    }

    .calendar-agenda-searchbar button,
    .calendar-agenda-searchbar i {
        font-size: 18px;
    }

    .calendar-agenda-chips {
        gap: 10px;
    }

    .calendar-sales-topbar {
        gap: 10px;
    }

    .calendar-agenda-chip {
        min-height: 44px;
        padding: 0 22px;
        font-size: 14px;
    }

    .calendar-sales-tab {
        min-height: 44px;
        padding: 0 22px;
        font-size: 14px;
    }

    .calendar-agenda-services {
        gap: 12px 16px;
    }

    .calendar-agenda-service {
        grid-template-columns: 76px minmax(0, 1fr);
        min-height: 76px;
    }

    .calendar-agenda-service__initials {
        font-size: 17px;
    }

    .calendar-agenda-service__body {
        padding: 13px 12px;
    }

    .calendar-agenda-service__body strong {
        font-size: 14px;
    }

    .calendar-agenda-service__meta {
        gap: 7px;
        margin-top: 7px;
        font-size: 13px;
    }

    .calendar-agenda-dot {
        width: 7px;
        height: 7px;
    }

    .calendar-agenda-service__gender {
        font-size: 16px;
    }

    .calendar-agenda-selected__rows {
        max-height: 124px;
        padding: 12px 18px 6px;
    }

    .calendar-agenda-selected__row {
        grid-template-columns: 36px minmax(0, 1fr) auto;
        gap: 14px;
        padding: 6px 0;
        font-size: 14px;
    }

    .calendar-agenda-selected__row.is-checkout-picker {
        grid-template-columns: 36px 78px minmax(0, 1fr) auto;
    }

    .calendar-agenda-selected__qty {
        min-height: 40px;
        font-size: 15px;
    }

    .calendar-agenda-selected__remove {
        font-size: 18px;
    }

    .calendar-agenda-selected__footer {
        padding: 12px 18px;
    }

    .calendar-agenda-summary {
        font-size: 15px;
    }

    .calendar-agenda-footer-action {
        min-width: 200px;
        min-height: 46px;
        font-size: 15px;
    }

    .calendar-agenda-review-toolbar {
        gap: 8px;
    }

    .calendar-agenda-review-pill {
        min-height: 46px;
        padding: 0 16px;
        font-size: 14px;
    }

    .calendar-agenda-review-addbar {
        min-height: 50px;
        padding: 0 18px;
        font-size: 16px;
    }

    .calendar-agenda-review-list {
        gap: 16px;
        padding-bottom: 18px;
    }

    .calendar-agenda-review-card {
        padding: 18px 14px 20px;
    }

    .calendar-agenda-review-card.is-collapsed {
        padding: 16px 14px;
    }

    .calendar-agenda-review-card__head {
        gap: 12px;
    }

    .calendar-agenda-review-card__toggle {
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 14px;
    }

    .calendar-agenda-review-number {
        width: 48px;
        height: 48px;
        font-size: 16px;
    }

    .calendar-agenda-review-card strong {
        font-size: 16px;
    }

    .calendar-agenda-review-card.is-collapsed strong {
        font-size: 15px;
    }

    .calendar-agenda-review-card__meta {
        gap: 7px;
        font-size: 14px;
    }

    .calendar-agenda-review-remove {
        font-size: 20px;
    }

    .calendar-agenda-review-confirm {
        width: 210px;
        padding: 12px 14px;
    }

    .calendar-agenda-review-confirm p {
        margin-bottom: 12px;
        font-size: 14px;
    }

    .calendar-agenda-review-confirm__cancel,
    .calendar-agenda-review-confirm__yes {
        min-width: 52px;
        min-height: 34px;
        font-size: 13px;
    }

    .calendar-agenda-review-fields {
        gap: 10px;
        margin-top: 22px;
    }

    .calendar-agenda-review-field label {
        margin-bottom: 6px;
        font-size: 13px;
    }

    .calendar-agenda-review-box {
        min-height: 48px;
        padding: 0 13px;
        font-size: 15px;
    }

    .calendar-agenda-review-option {
        min-height: 46px;
        padding: 0 18px;
        font-size: 16px;
    }

    .calendar-agenda-review-warning {
        margin-top: 16px;
        padding: 12px 18px;
        font-size: 14px;
    }

    .calendar-agenda-time-dialog,
    .calendar-agenda-repeat-dialog,
    .calendar-agenda-item-dialog {
        width: min(460px, calc(100vw - 32px));
    }

    .calendar-agenda-time-dialog,
    .calendar-agenda-item-dialog {
        padding: 24px;
    }

    .calendar-agenda-time-dialog h3,
    .calendar-agenda-repeat-header h3 {
        font-size: 22px;
    }

    .calendar-agenda-time-display {
        min-height: 50px;
        font-size: 21px;
    }

    .calendar-agenda-time-column {
        max-height: 176px;
    }

    .calendar-agenda-time-column__label,
    .calendar-agenda-time-option {
        min-height: 38px;
    }

    .calendar-agenda-time-service {
        min-height: 46px;
        font-size: 14px;
    }

    .calendar-agenda-time-actions button,
    .calendar-agenda-repeat-actions button,
    .calendar-agenda-item-dialog__actions button {
        min-height: 48px;
        font-size: 15px;
    }

    .calendar-agenda-repeat-header {
        padding: 24px 24px 20px;
    }

    .calendar-agenda-repeat-body {
        padding: 0 24px 24px;
    }

    .calendar-agenda-repeat-empty {
        margin: 0 -24px;
        padding: 44px 54px;
        font-size: 16px;
    }

    .calendar-agenda-repeat-select,
    .calendar-agenda-repeat-date,
    .calendar-agenda-repeat-count input {
        min-height: 50px;
        font-size: 16px;
    }

    .calendar-agenda-note-panel textarea {
        min-height: 94px;
        padding: 18px 48px 14px 18px;
        font-size: 18px;
    }

    .calendar-agenda-customer-field {
        min-height: 50px;
        margin: 18px 18px 0;
    }

    .calendar-agenda-walkin-copy {
        margin: 24px 18px 6px;
        font-size: 15px;
    }

    .calendar-agenda-customer-new {
        min-height: 50px;
        margin-top: 32px;
        padding: 0 20px;
        font-size: 16px;
    }

    .calendar-agenda-customer-list {
        padding-bottom: 14px;
    }

    .calendar-agenda-customer-row {
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 10px;
        min-height: 72px;
        padding: 8px 18px;
    }

    .calendar-agenda-customer-avatar {
        width: 48px;
        height: 48px;
        font-size: 24px;
    }

    .calendar-agenda-customer-row strong,
    .calendar-agenda-customer-card strong {
        font-size: 18px;
    }

    .calendar-agenda-customer-row__tag,
    .calendar-agenda-customer-card span {
        padding: 4px 9px;
        font-size: 12px;
    }

    .calendar-agenda-customer-card {
        gap: 12px;
        padding: 24px 18px;
    }

    .calendar-agenda-customer-reset {
        font-size: 20px;
    }

    .calendar-agenda-customer-menu {
        min-width: 230px;
        padding: 14px 0;
    }

    .calendar-agenda-customer-menu button {
        padding: 10px 22px;
        font-size: 16px;
    }

    .calendar-agenda-actions {
        gap: 12px;
        padding: 18px;
    }

    .calendar-agenda-actions button {
        min-height: 48px;
        font-size: 15px;
    }

    .calendar-agenda-total {
        padding-bottom: 14px;
        font-size: 16px;
    }

    .calendar-agenda-checkout-left {
        gap: 18px;
        padding-bottom: 22px;
    }

    .calendar-agenda-checkout-branch {
        min-height: 44px;
        font-size: 15px;
    }

    .calendar-agenda-checkout-search {
        min-height: 56px;
        padding: 0 18px;
        font-size: 16px;
    }

    .calendar-agenda-checkout-list {
        gap: 12px;
    }

    .calendar-agenda-checkout-card {
        grid-template-columns: 48px minmax(0, 1fr) auto 30px;
        min-height: 88px;
        gap: 12px;
        padding: 14px;
    }

    .calendar-agenda-checkout-avatar {
        width: 48px;
        height: 48px;
    }

    .calendar-agenda-checkout-card strong {
        font-size: 16px;
    }

    .calendar-agenda-checkout-card small {
        font-size: 13px;
    }

    .calendar-agenda-checkout-price {
        font-size: 15px;
    }

    .calendar-agenda-checkout-remove {
        font-size: 19px;
    }

    .calendar-agenda-checkout-fields {
        grid-template-columns: 92px minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1.25fr);
        gap: 10px;
        margin-top: 16px;
    }

    .calendar-agenda-checkout-field label {
        margin-bottom: 6px;
        font-size: 13px;
    }

    .calendar-agenda-checkout-box,
    .calendar-agenda-checkout-control {
        min-height: 48px;
        padding: 0 13px;
        font-size: 15px;
    }

    .calendar-agenda-checkout-dropdown button {
        min-height: 38px;
        padding: 0 13px;
        font-size: 13px;
    }

    .calendar-agenda-checkout-iconbox {
        min-height: 48px;
        margin-top: 24px;
        font-size: 16px;
    }

    .calendar-agenda-checkout-summary {
        font-size: 15px;
    }

    .calendar-agenda-checkout-summary-row {
        padding: 6px 0;
    }

    .calendar-agenda-checkout-due {
        margin-top: 18px;
        font-size: 22px;
    }

    .calendar-agenda-checkout-payment {
        gap: 10px;
        padding: 26px 18px 18px;
    }

    .calendar-agenda-checkout-payment-label {
        font-size: 16px;
    }

    .calendar-agenda-checkout-payment-amount {
        min-height: 52px;
        font-size: 24px;
    }

    .calendar-agenda-checkout-payments {
        gap: 8px;
    }

    .calendar-agenda-checkout-payments button {
        min-height: 48px;
        font-size: 15px;
    }

    .calendar-agenda-checkout-payment-footer {
        padding-top: 14px;
        font-size: 16px;
    }

    .calendar-agenda-checkout-payment-actions {
        gap: 10px;
    }

    .calendar-agenda-checkout-payment-actions button {
        min-height: 48px;
        font-size: 15px;
    }

    .calendar-agenda-more-menu button {
        min-height: 46px;
        font-size: 15px;
    }

    .calendar-agenda-checkout-confirm {
        top: 40px;
        right: 12px;
        width: 218px;
        padding: 12px 14px 10px;
    }

    .calendar-agenda-checkout-confirm p {
        font-size: 13px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-field {
        margin: 18px 18px 0;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-walkin-copy {
        margin: 44px 18px 0;
        font-size: 16px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-card {
        padding: 34px 18px 24px;
    }

    .calendar-agenda-item-dialog h3 {
        font-size: 21px;
    }

    .calendar-agenda-item-dialog__count {
        font-size: 16px;
    }

    .calendar-agenda-item-dialog__choice strong {
        font-size: 15px;
    }

    .calendar-agenda-item-dialog__qty {
        margin: 22px 0 28px;
    }

    .calendar-agenda-item-dialog__qty span {
        min-height: 48px;
        font-size: 20px;
    }

    .calendar-agenda-confirm {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        background: rgba(17, 24, 39, 0.56);
    }

    .calendar-agenda-confirm[hidden] {
        display: none;
    }

    .calendar-agenda-confirm__box {
        width: min(590px, calc(100vw - 40px));
        padding: 28px 30px 14px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 26px 52px rgba(15, 23, 42, 0.22);
    }

    .calendar-agenda-confirm__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 46px;
    }

    .calendar-agenda-confirm__header h3 {
        margin: 0;
        color: #1f2937;
        font-size: 28px;
        font-weight: 800;
    }

    .calendar-agenda-confirm__close {
        border: 0;
        background: transparent;
        color: #111827;
        font-size: 26px;
    }

    .calendar-agenda-confirm p {
        max-width: 520px;
        margin: 0 0 58px;
        color: #1f2937;
        font-size: 18px;
        line-height: 1.45;
    }

    .calendar-agenda-confirm__action {
        display: flex;
        justify-content: flex-end;
    }

    .calendar-agenda-confirm__exit {
        min-width: 230px;
        min-height: 56px;
        border: 0;
        border-radius: 8px;
        background: #e34d6f;
        color: #fff;
        font-size: 17px;
        font-weight: 800;
    }

    /* Extra compact pass for Chrome 100% */
    .calendar-agenda-modal__header {
        height: 58px;
        flex-basis: 58px;
        padding: 8px 16px;
    }

    .calendar-agenda-modal__header h2 {
        font-size: 22px;
    }

    .calendar-agenda-modal__header .btn-close {
        font-size: 16px;
    }

    .calendar-agenda-modal__body {
        height: calc(100dvh - 58px);
        grid-template-columns: minmax(0, 1fr) 360px;
        max-width: 100%;
    }

    #agendaModal .modal-content,
    .calendar-agenda-modal__body,
    .calendar-agenda-right,
    .calendar-agenda-right > div:first-child,
    .calendar-agenda-customer-empty,
    .calendar-agenda-customer-card,
    .calendar-agenda-checkout-payment {
        min-width: 0;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-right {
        overflow-x: clip;
    }

    .calendar-agenda-checkout-payment-amount,
    .calendar-agenda-checkout-payments,
    .calendar-agenda-checkout-payment-footer,
    .calendar-agenda-checkout-payment-actions {
        max-width: 100%;
    }

    .calendar-agenda-left,
    .calendar-agenda-right {
        height: calc(100dvh - 58px);
    }

    .calendar-agenda-left {
        gap: 11px;
        padding: 14px 16px 0;
    }

    .calendar-agenda-searchbar {
        min-height: 48px;
        grid-template-columns: 30px minmax(0, 1fr) 30px;
        gap: 8px;
    }

    .calendar-agenda-searchbar input,
    .calendar-agenda-customer-search {
        font-size: 14px;
    }

    .calendar-agenda-searchbar button,
    .calendar-agenda-searchbar i {
        font-size: 16px;
    }

    .calendar-agenda-chips {
        gap: 8px;
    }

    .calendar-sales-topbar {
        gap: 8px;
    }

    .calendar-agenda-chip {
        min-height: 38px;
        padding: 0 18px;
        font-size: 13px;
    }

    .calendar-sales-tab {
        min-height: 38px;
        padding: 0 18px;
        font-size: 13px;
    }

    .calendar-agenda-services {
        gap: 10px 14px;
    }

    .calendar-agenda-service {
        grid-template-columns: 68px minmax(0, 1fr);
        min-height: 64px;
    }

    .calendar-agenda-service__initials {
        font-size: 15px;
    }

    .calendar-agenda-service__body {
        padding: 10px 10px;
    }

    .calendar-agenda-service__body strong {
        font-size: 13px;
    }

    .calendar-agenda-service__meta {
        gap: 6px;
        margin-top: 5px;
        font-size: 12px;
    }

    .calendar-agenda-selected__rows {
        max-height: 110px;
        padding: 10px 16px 4px;
    }

    .calendar-agenda-selected__row {
        grid-template-columns: 30px minmax(0, 1fr) auto;
        gap: 12px;
        padding: 4px 0;
        font-size: 13px;
    }

    .calendar-agenda-selected__row.is-checkout-picker {
        grid-template-columns: 30px 64px minmax(0, 1fr) auto;
    }

    .calendar-agenda-selected__qty {
        min-height: 34px;
        font-size: 13px;
    }

    .calendar-agenda-selected__footer {
        padding: 10px 16px;
    }

    .calendar-agenda-summary {
        font-size: 13px;
    }

    .calendar-agenda-footer-action {
        min-width: 176px;
        min-height: 40px;
        font-size: 13px;
    }

    .calendar-agenda-review-toolbar {
        gap: 7px;
    }

    .calendar-agenda-review-pill {
        min-height: 40px;
        padding: 0 13px;
        font-size: 13px;
    }

    .calendar-agenda-review-addbar {
        min-height: 44px;
        padding: 0 16px;
        font-size: 14px;
    }

    .calendar-agenda-review-list {
        gap: 12px;
        padding-bottom: 14px;
    }

    .calendar-agenda-review-card {
        padding: 14px 12px 16px;
    }

    .calendar-agenda-review-card.is-collapsed {
        padding: 12px;
    }

    .calendar-agenda-review-card__head {
        gap: 10px;
    }

    .calendar-agenda-review-card__toggle {
        grid-template-columns: 40px minmax(0, 1fr);
        gap: 12px;
    }

    .calendar-agenda-review-number {
        width: 40px;
        height: 40px;
        font-size: 14px;
    }

    .calendar-agenda-review-card strong,
    .calendar-agenda-review-card.is-collapsed strong {
        font-size: 13px;
    }

    .calendar-agenda-review-card__meta {
        gap: 6px;
        font-size: 12px;
    }

    .calendar-agenda-review-remove {
        font-size: 18px;
    }

    .calendar-agenda-review-fields {
        gap: 8px;
        margin-top: 16px;
    }

    .calendar-agenda-review-field label {
        margin-bottom: 5px;
        font-size: 12px;
    }

    .calendar-agenda-review-box {
        min-height: 40px;
        padding: 0 11px;
        font-size: 13px;
    }

    .calendar-agenda-review-warning {
        margin-top: 12px;
        padding: 10px 14px;
        font-size: 12px;
    }

    .calendar-agenda-customer-field {
        min-height: 42px;
        margin: 14px 14px 0;
    }

    .calendar-agenda-customer-field__back {
        width: 38px;
        font-size: 14px;
    }

    .calendar-agenda-walkin-copy {
        margin: 20px 14px 4px;
        font-size: 13px;
    }

    .calendar-agenda-customer-new {
        min-height: 42px;
        margin-top: 26px;
        padding: 0 16px;
        font-size: 14px;
    }

    .calendar-agenda-customer-row {
        grid-template-columns: 40px minmax(0, 1fr);
        gap: 9px;
        min-height: 62px;
        padding: 7px 14px;
    }

    .calendar-agenda-customer-avatar {
        width: 40px;
        height: 40px;
        font-size: 20px;
    }

    .calendar-agenda-customer-row strong,
    .calendar-agenda-customer-card strong {
        font-size: 15px;
    }

    .calendar-agenda-customer-row__tag,
    .calendar-agenda-customer-card span {
        padding: 3px 8px;
        font-size: 10px;
    }

    .calendar-agenda-customer-card {
        gap: 10px;
        padding: 18px 14px;
    }

    .calendar-agenda-customer-reset {
        font-size: 17px;
    }

    .calendar-agenda-customer-menu {
        min-width: 200px;
        padding: 10px 0;
    }

    .calendar-agenda-customer-menu button {
        padding: 8px 18px;
        font-size: 14px;
    }

    .calendar-agenda-actions {
        gap: 10px;
        padding: 14px;
    }

    .calendar-agenda-actions button {
        min-height: 42px;
        font-size: 13px;
    }

    .calendar-agenda-total {
        padding-bottom: 10px;
        font-size: 14px;
    }

    .calendar-agenda-checkout-left {
        gap: 14px;
        padding-bottom: 18px;
    }

    .calendar-agenda-checkout-branch {
        min-height: 38px;
        font-size: 13px;
    }

    .calendar-agenda-checkout-search {
        min-height: 48px;
        padding: 0 16px;
        font-size: 14px;
    }

    .calendar-agenda-checkout-list {
        gap: 10px;
    }

    .calendar-agenda-checkout-card {
        grid-template-columns: 42px minmax(0, 1fr) auto 28px;
        min-height: 76px;
        gap: 10px;
        padding: 12px;
    }

    .calendar-agenda-checkout-avatar {
        width: 42px;
        height: 42px;
    }

    .calendar-agenda-checkout-card strong {
        font-size: 14px;
    }

    .calendar-agenda-checkout-card small,
    .calendar-agenda-checkout-price {
        font-size: 12px;
    }

    .calendar-agenda-checkout-remove {
        font-size: 17px;
    }

    .calendar-agenda-checkout-fields {
        grid-template-columns: 78px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr);
        gap: 8px;
        margin-top: 12px;
    }

    .calendar-agenda-checkout-field label {
        margin-bottom: 4px;
        font-size: 11px;
    }

    .calendar-agenda-checkout-box,
    .calendar-agenda-checkout-control {
        min-height: 40px;
        padding: 0 11px;
        font-size: 13px;
    }

    .calendar-agenda-checkout-dropdown button {
        min-height: 34px;
        padding: 0 11px;
        font-size: 12px;
    }

    .calendar-agenda-checkout-iconbox {
        min-height: 40px;
        margin-top: 20px;
        font-size: 14px;
    }

    .calendar-agenda-checkout-summary {
        font-size: 13px;
    }

    .calendar-agenda-checkout-summary-row {
        padding: 4px 0;
    }

    .calendar-agenda-checkout-due {
        margin-top: 14px;
        font-size: 18px;
    }

    .calendar-agenda-checkout-payment {
        gap: 8px;
        padding: 22px 14px 14px;
    }

    .calendar-agenda-checkout-payment-label {
        font-size: 14px;
    }

    .calendar-agenda-checkout-payment-amount {
        min-height: 46px;
        font-size: 21px;
    }

    .calendar-agenda-checkout-payments {
        gap: 7px;
    }

    .calendar-agenda-checkout-payments button,
    .calendar-agenda-checkout-payment-actions button {
        min-height: 42px;
        font-size: 13px;
    }

    .calendar-agenda-more-menu button {
        min-height: 40px;
        font-size: 13px;
    }

    .calendar-agenda-checkout-confirm {
        top: 34px;
        right: 10px;
        width: 198px;
        padding: 10px 12px 9px;
    }

    .calendar-agenda-checkout-confirm p {
        margin-bottom: 9px;
        font-size: 12px;
    }

    .calendar-agenda-checkout-confirm__actions button {
        min-height: 30px;
        min-width: 52px;
        font-size: 12px;
    }

    .calendar-agenda-checkout-payment-footer {
        padding-top: 12px;
        font-size: 14px;
    }

    .calendar-agenda-payment-list {
        gap: 8px;
    }

    .calendar-agenda-payment-row {
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 10px;
        font-size: 16px;
    }

    .calendar-agenda-payment-row button {
        font-size: 15px;
    }

    .calendar-agenda-payment-row strong {
        font-size: 15px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-field {
        margin: 14px 14px 0;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-walkin-copy {
        margin: 34px 14px 0;
        font-size: 13px;
    }

    .calendar-agenda-modal.is-checkout-mode .calendar-agenda-customer-card {
        padding: 26px 14px 18px;
    }

    .calendar-agenda-confirm__box {
        width: min(470px, calc(100vw - 40px));
        padding: 22px 24px 12px;
    }

    .calendar-agenda-confirm__header {
        gap: 14px;
        margin-bottom: 34px;
    }

    .calendar-agenda-confirm__header h3 {
        font-size: 22px;
    }

    .calendar-agenda-confirm__close {
        font-size: 20px;
    }

    .calendar-agenda-confirm p {
        max-width: 410px;
        margin-bottom: 42px;
        font-size: 15px;
    }

    .calendar-agenda-confirm__exit {
        min-width: 185px;
        min-height: 46px;
        font-size: 14px;
    }

    .calendar-agenda-voucher-panel {
        width: min(360px, 78vw);
        padding: 22px 20px;
    }

    .calendar-agenda-voucher-header {
        margin-bottom: 20px;
    }

    .calendar-agenda-voucher-header h3 {
        font-size: 22px;
    }

    .calendar-agenda-voucher-search {
        min-height: 48px;
        padding: 0 14px;
    }

    .calendar-agenda-voucher-search input {
        font-size: 16px;
    }

    .calendar-agenda-voucher-list {
        gap: 14px;
    }

    .calendar-agenda-voucher-card {
        padding: 16px;
        border-radius: 20px;
    }

    .calendar-agenda-voucher-card__title {
        font-size: 18px;
    }

    .calendar-agenda-voucher-card__value {
        font-size: 16px;
    }

    .calendar-agenda-voucher-card__type,
    .calendar-agenda-voucher-card__expiry,
    .calendar-agenda-voucher-card__footer {
        font-size: 13px;
    }

    .calendar-agenda-voucher-ticket {
        width: 42px;
        height: 68px;
        font-size: 20px;
    }

    .calendar-agenda-voucher-card.is-disabled::after {
        right: -54px;
        width: 190px;
        font-size: 15px;
    }

    .calendar-agenda-voucher-empty {
        min-height: 120px;
        margin-top: 68px;
        font-size: 18px;
    }

    .calendar-agenda-voucher-empty i {
        font-size: 34px;
    }

    @media (max-width: 1200px) {
        .calendar-agenda-modal__body {
            grid-template-columns: 1fr;
        }

        .calendar-agenda-right {
            min-height: auto;
            border-left: 0;
            border-top: 1px solid #e7eef8;
        }

        .calendar-agenda-services {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 700px) {
        .calendar-agenda-modal__header h2 {
            font-size: 24px;
        }

        .calendar-agenda-left {
            padding: 16px 14px 0;
        }

        .calendar-agenda-services {
            grid-template-columns: 1fr;
        }

        .calendar-agenda-selected__footer,
        .calendar-agenda-actions {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
        }

        .calendar-agenda-footer-action {
            width: 100%;
            min-width: 0;
        }
    }

    .flatpickr-day.in-selected-week,
    .flatpickr-day.in-hover-week {
        background: #f2f5fa !important;
        border-color: transparent !important;
        color: #4b5563 !important;
    }

    .flatpickr-day.selected.in-selected-week,
    .flatpickr-day.selected.in-hover-week,
    .flatpickr-day.start-week,
    .flatpickr-day.end-week {
        background: #4f84e9 !important;
        border-color: #4f84e9 !important;
        color: #fff !important;
    }
</style>

<section class="calendar-shell">
    <div class="calendar-toolbar d-flex justify-content-between align-items-center w-100 mb-4">
        <div class="calendar-toolbar-main">
            <button type="button" class="custom-toolbar-btn dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="bi bi-shop text-muted-icon"></i>
                Star Salon
            </button>
            <div class="dropdown-menu soft-dropdown">
                <a class="dropdown-item active" href="<?= e(url('/calendar?view=' . $calendarView . '&date=' . $calendar['date'] . $staffQuery . $filterQuery)) ?>">Star Salon</a>
            </div>

            <button type="button" class="custom-toolbar-btn dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                <?= $requestedStaffId ? e($activeStaff['name']) : 'Semua Staf Yang Bekerja' ?>
            </button>
            <div class="dropdown-menu soft-dropdown">
                <a class="dropdown-item <?= $requestedStaffId ? '' : 'active' ?>" href="<?= e(url('/calendar?view=' . $calendarView . '&date=' . $calendar['date'] . $filterQuery)) ?>">Semua Staf Yang Bekerja</a>
                <?php foreach ($calendar['staff'] as $staffMember): ?>
                    <a class="dropdown-item <?= (int) $activeStaff['id'] === (int) $staffMember['id'] && $requestedStaffId ? 'active' : '' ?>" href="<?= e(url('/calendar?view=' . $calendarView . '&date=' . $calendar['date'] . '&staff_id=' . $staffMember['id'] . $filterQuery)) ?>">
                        <?= e($staffMember['name']) ?>
                    </a>
                <?php endforeach; ?>
            </div>

            <div class="custom-toolbar-group">
                <a href="<?= e(url('/calendar?view=' . $calendarView . '&date=' . $previousDate->format('Y-m-d') . $staffQuery . $filterQuery)) ?>" class="date-nav-btn text-decoration-none" aria-label="Periode sebelumnya">
                    <i class="bi bi-chevron-left"></i>
                </a>
                
                <form method="get" action="<?= e(url('/calendar')) ?>" class="position-relative d-flex align-items-center px-3 gap-2">
                    <input type="hidden" name="view" value="<?= e($calendarView) ?>">
                    <?php if ($requestedStaffId): ?>
                        <input type="hidden" name="staff_id" value="<?= e((string) $requestedStaffId) ?>">
                    <?php endif; ?>
                    <?php if ($calendarFilter !== 'all'): ?>
                        <input type="hidden" name="filter" value="<?= e($calendarFilter) ?>">
                    <?php endif; ?>
                    <i class="bi bi-calendar3 text-muted-icon"></i>
                    <span class="fw-bold" style="color: #111827; font-size: 0.95rem; cursor: pointer;">
                        <?= e($isDayView ? $dayLabel : $weekRangeLabel) ?>
                    </span>
                    <input class="calendar-date-input js-datepicker position-absolute opacity-0 w-100 h-100 top-0 start-0" type="text" name="date" value="<?= e($calendar['date']) ?>" data-calendar-picker="<?= $isDayView ? 'day' : 'week' ?>" style="cursor: pointer;">
                </form>

                <a href="<?= e(url('/calendar?view=' . $calendarView . '&date=' . $nextDate->format('Y-m-d') . $staffQuery . $filterQuery)) ?>" class="date-nav-btn text-decoration-none" aria-label="Periode berikutnya">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </div>
        </div>

        <div class="calendar-toolbar-actions">
            <div class="view-switcher-container">
                <a href="<?= e(url('/calendar?view=schedule&date=' . $calendar['date'] . $staffQuery . $filterQuery)) ?>" class="view-switcher-btn <?= $isScheduleView ? 'active' : '' ?>" aria-label="Schedule View">
                    <i class="bi bi-clock"></i>
                    <?php if ($isScheduleView): ?><span>Schedule View</span><?php endif; ?>
                </a>
                <a href="<?= e(url('/calendar?view=week&date=' . $calendar['date'] . $staffQuery . $filterQuery)) ?>" class="view-switcher-btn <?= $isWeekView ? 'active' : '' ?>" aria-label="Tampilan Minggu">
                    <i class="bi bi-layout-three-columns"></i>
                    <?php if ($isWeekView): ?><span>Week</span><?php endif; ?>
                </a>
                <a href="<?= e(url('/calendar?view=day&date=' . $calendar['date'] . $staffQuery . $filterQuery)) ?>" class="view-switcher-btn <?= $isDayView ? 'active' : '' ?>" aria-label="Tampilan Hari">
                    <i class="bi bi-phone"></i>
                    <?php if ($isDayView): ?><span>Day</span><?php endif; ?>
                </a>
            </div>

            <button type="button" class="refresh-btn js-calendar-scroll-now" aria-label="Scroll ke waktu sekarang">
                <i class="bi bi-arrow-repeat"></i>
            </button>
        </div>
    </div>

    <div class="single-staff-calendar <?= $isScheduleView ? 'is-schedule-view' : ($isDayView ? 'is-day-view' : 'is-week-view') ?>">
        <?php if ($isScheduleView): ?>
            <div class="cal-header-row">
                <div class="cal-header-all"><?php $renderCalendarFilter(); ?></div>
                <div class="schedule-staff-head">
                    <span class="icon-bg"><i class="bi bi-person"></i></span>
                    <span><?= e($requestedStaffId ? $activeStaff['name'] : $activeStaff['name']) ?></span>
                </div>
            </div>

            <div class="schedule-list-panel">
                <?php if ($scheduleItems): ?>
                    <?php foreach ($scheduleItems as $item): ?>
                        <div class="schedule-list-row">
                            <div class="schedule-list-time">
                                <?= e(substr($item['start_at'], 11, 5)) ?> - <?= e(substr($item['end_at'], 11, 5)) ?>
                            </div>
                            <div class="schedule-list-card <?= $item['type'] === 'blocked' ? 'is-blocked' : '' ?>">
                                <strong><?= e($item['title']) ?></strong>
                                <span><?= e($item['description']) ?> -</span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php else: ?>
                    <div class="schedule-empty">Tidak Ada Agenda</div>
                <?php endif; ?>
            </div>
        <?php elseif ($isDayView): ?>
            <div class="cal-header-row">
                <div class="cal-header-all"><?php $renderCalendarFilter(); ?></div>
                <div class="cal-day-header-grid">
                    <div class="cal-day-staff-head">
                        <span class="icon-bg"><i class="bi bi-person"></i></span>
                        <span><?= e($activeStaff['name']) ?></span>
                    </div>
                </div>
            </div>

            <div class="cal-body-scroll">
                <div class="cal-body-row" style="height: <?= ($endHour + 1) * 120 ?>px;">
                    <div class="cal-time-col">
                        <?php for($i = $startHour; $i <= $endHour; $i++): ?>
                            <div class="hour-block time-label">
                                <?= sprintf('%02d:00', $i) ?>
                            </div>
                        <?php endfor; ?>
                    </div>

                    <div class="cal-day-grid-wrap">
                        <div class="cal-day-grid-col cal-day-grid-col--single">
                            <?php for($i = $startHour; $i <= $endHour; $i++): ?>
                                <div class="hour-block" style="position: absolute; top: <?= $i * 120 ?>px; left: 0; right: 0; pointer-events: none;"></div>
                            <?php endfor; ?>

                            <div class="cal-interactive-slots">
                                <?php for($h = $startHour; $h <= $endHour; $h++): ?>
                                    <?php for($m = 0; $m < 60; $m += $intervalMinutes): ?>
                                        <div class="click-slot js-calendar-slot"
                                             data-date="<?= e($calendar['date']) ?>"
                                             data-time="<?= sprintf('%02d:%02d', $h, $m) ?>"
                                             data-staff-id="<?= e((string) $activeStaff['id']) ?>"
                                             data-staff-name="<?= e($activeStaff['name']) ?>">
                                            <span class="slot-hover-time"><?= sprintf('%02d:%02d', $h, $m) ?></span>
                                        </div>
                                    <?php endfor; ?>
                                <?php endfor; ?>
                            </div>

                            <?php foreach ($calendarTimedItemsFor($calendar['date'], (int) $activeStaff['id']) as $item): ?>
                                <?php
                                    $left = ((float) $item['column'] / (float) $item['columns']) * 100;
                                    $width = (1 / (float) $item['columns']) * 100;
                                    $statusKey = $calendarStatusKey((string) ($item['status'] ?? 'new'));
                                    $statusIcon = match ($statusKey) {
                                        'confirmed' => 'bi-hand-thumbs-up',
                                        'arrived' => 'bi-emoji-smile',
                                        'started' => 'bi-play-fill',
                                        'completed' => 'bi-check-lg',
                                        default => '',
                                    };
                                    $typeClass = $item['type'] === 'blocked' ? 'is-blocked' : ($item['type'] === 'sale' ? 'is-sale' : '');
                                    if ($item['type'] === 'booking') {
                                        $typeClass .= ' is-' . $statusKey;
                                    }
                                    $eventTop = (int) $item['top'] + 4;
                                    $eventHeight = max(18, (int) $item['height'] - 8);
                                    $eventStyle = sprintf(
                                        'top: %dpx; height: %dpx; left: calc(%.4f%% + 3px); width: calc(%.4f%% - 6px);',
                                        $eventTop,
                                        $eventHeight,
                                        $left,
                                        $width
                                    );
                                    $itemTime = substr($item['start_at'], 11, 5) . ' - ' . substr($item['end_at'], 11, 5);
                                    $itemDate = substr((string) $item['start_at'], 0, 10);
                                ?>
                                <div class="calendar-event-blue calendar-event-card <?= e(trim($typeClass)) ?>"
                                     style="<?= e($eventStyle) ?>"
                                     tabindex="0"
                                     data-calendar-event="1"
                                     data-event-type="<?= e((string) $item['type']) ?>"
                                     data-event-id="<?= e((string) ($item['id'] ?? 0)) ?>"
                                     data-event-staff-id="<?= e((string) ($item['staff_id'] ?? 0)) ?>"
                                     data-event-customer-id="<?= e((string) ($item['customer_id'] ?? 0)) ?>"
                                     data-event-customer-name="<?= e((string) ($item['customer_name'] ?? '')) ?>"
                                     data-event-customer-phone="<?= e((string) ($item['customer_phone'] ?? '')) ?>"
                                     data-event-service-id="<?= e((string) ($item['service_id'] ?? 0)) ?>"
                                     data-event-title="<?= e((string) $item['title']) ?>"
                                     data-event-subtitle="<?= e((string) $item['subtitle']) ?>"
                                     data-event-staff="<?= e((string) $item['staff']) ?>"
                                     data-event-reference="<?= e((string) $item['reference']) ?>"
                                     data-event-status="<?= e($statusKey) ?>"
                                     data-event-start="<?= e((string) $item['start_at']) ?>"
                                     data-event-end="<?= e((string) $item['end_at']) ?>"
                                     data-event-date="<?= e($itemDate) ?>"
                                     data-event-duration="<?= e((string) ($item['duration'] ?? 60)) ?>"
                                     data-event-price="<?= e((string) ($item['price'] ?? 0)) ?>"
                                     data-event-notes="<?= e((string) ($item['notes'] ?? '')) ?>">
                                    <i class="bi <?= e($statusIcon) ?> calendar-event-card__status-icon" aria-hidden="true"></i>
                                    <div class="calendar-event-card__inner">
                                        <div class="calendar-event-card__time"><?= e($itemTime) ?></div>
                                        <div class="calendar-event-card__title"><?= e($item['title']) ?></div>
                                        <div class="calendar-event-card__service"><?= e($item['subtitle']) ?></div>
                                    </div>
                                    <div class="calendar-event-popover" role="tooltip">
                                        <div class="calendar-event-popover__body">
                                            <div class="calendar-event-popover__time"><?= e($itemTime) ?></div>
                                            <strong><?= e($item['title']) ?></strong>
                                            <span><?= e($item['subtitle']) ?></span>
                                            <small><?= e($item['staff']) ?> - <?= e($item['status']) ?></small>
                                            <?php if ($item['notes'] !== ''): ?>
                                                <small><?= e($item['notes']) ?></small>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>

                        <?php if ($indicatorOffset !== null): ?>
                            <div class="now-indicator" style="top: <?= $indicatorOffset ?>px;">
                                <div class="now-indicator-pill">
                                    <?= e(date('H:i')) ?>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        <?php else: ?>
            <div class="cal-header-row">
                <div class="cal-header-all"><?php $renderCalendarFilter(); ?></div>
                <div class="cal-week-header-grid">
                    <?php foreach ($weekDays as $day): ?>
                        <div class="cal-week-day-head <?= $day['date'] === $calendar['date'] ? 'active' : '' ?>">
                            <div>
                                <strong><?= e($day['name']) ?></strong>
                                <span><?= e($day['label']) ?></span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="cal-body-scroll">
                <div class="cal-body-row" style="height: <?= ($endHour + 1) * 120 ?>px;">
                    <div class="cal-time-col">
                        <?php for($i = $startHour; $i <= $endHour; $i++): ?>
                            <div class="hour-block time-label">
                                <?= sprintf('%02d:00', $i) ?>
                            </div>
                        <?php endfor; ?>
                    </div>

                    <div class="cal-week-grid-col">
                        <?php foreach ($weekDays as $day): ?>
                            <div class="cal-day-grid-col">
                                <?php for($i = $startHour; $i <= $endHour; $i++): ?>
                                    <div class="hour-block" style="position: absolute; top: <?= $i * 120 ?>px; left: 0; right: 0; pointer-events: none;"></div>
                                <?php endfor; ?>

                                <div class="cal-interactive-slots">
                                    <?php for($h = $startHour; $h <= $endHour; $h++): ?>
                                        <?php for($m = 0; $m < 60; $m += $intervalMinutes): ?>
                                            <div class="click-slot js-calendar-slot"
                                                 data-date="<?= e($day['date']) ?>"
                                                 data-time="<?= sprintf('%02d:%02d', $h, $m) ?>"
                                                 data-staff-id="<?= e((string) $activeStaff['id']) ?>"
                                                 data-staff-name="<?= e($activeStaff['name']) ?>">
                                                <span class="slot-hover-time"><?= sprintf('%02d:%02d', $h, $m) ?></span>
                                            </div>
                                        <?php endfor; ?>
                                    <?php endfor; ?>
                                </div>

                                <?php foreach ($calendarTimedItemsFor($day['date'], (int) $activeStaff['id']) as $item): ?>
                                    <?php
                                        $left = ((float) $item['column'] / (float) $item['columns']) * 100;
                                        $width = (1 / (float) $item['columns']) * 100;
                                        $statusKey = $calendarStatusKey((string) ($item['status'] ?? 'new'));
                                        $statusIcon = match ($statusKey) {
                                            'confirmed' => 'bi-hand-thumbs-up',
                                            'arrived' => 'bi-emoji-smile',
                                            'started' => 'bi-play-fill',
                                            'completed' => 'bi-check-lg',
                                            default => '',
                                        };
                                        $typeClass = $item['type'] === 'blocked' ? 'is-blocked' : ($item['type'] === 'sale' ? 'is-sale' : '');
                                        if ($item['type'] === 'booking') {
                                            $typeClass .= ' is-' . $statusKey;
                                        }
                                        $eventTop = (int) $item['top'] + 4;
                                        $eventHeight = max(18, (int) $item['height'] - 8);
                                        $eventStyle = sprintf(
                                            'top: %dpx; height: %dpx; left: calc(%.4f%% + 3px); width: calc(%.4f%% - 6px);',
                                            $eventTop,
                                            $eventHeight,
                                            $left,
                                            $width
                                        );
                                        $itemTime = substr($item['start_at'], 11, 5) . ' - ' . substr($item['end_at'], 11, 5);
                                        $itemDate = substr((string) $item['start_at'], 0, 10);
                                    ?>
                                    <div class="calendar-event-blue calendar-event-card <?= e(trim($typeClass)) ?>"
                                         style="<?= e($eventStyle) ?>"
                                         tabindex="0"
                                         data-calendar-event="1"
                                         data-event-type="<?= e((string) $item['type']) ?>"
                                         data-event-id="<?= e((string) ($item['id'] ?? 0)) ?>"
                                         data-event-staff-id="<?= e((string) ($item['staff_id'] ?? 0)) ?>"
                                         data-event-customer-id="<?= e((string) ($item['customer_id'] ?? 0)) ?>"
                                         data-event-customer-name="<?= e((string) ($item['customer_name'] ?? '')) ?>"
                                         data-event-customer-phone="<?= e((string) ($item['customer_phone'] ?? '')) ?>"
                                         data-event-service-id="<?= e((string) ($item['service_id'] ?? 0)) ?>"
                                         data-event-title="<?= e((string) $item['title']) ?>"
                                         data-event-subtitle="<?= e((string) $item['subtitle']) ?>"
                                         data-event-staff="<?= e((string) $item['staff']) ?>"
                                         data-event-reference="<?= e((string) $item['reference']) ?>"
                                         data-event-status="<?= e($statusKey) ?>"
                                         data-event-start="<?= e((string) $item['start_at']) ?>"
                                         data-event-end="<?= e((string) $item['end_at']) ?>"
                                         data-event-date="<?= e($itemDate) ?>"
                                         data-event-duration="<?= e((string) ($item['duration'] ?? 60)) ?>"
                                         data-event-price="<?= e((string) ($item['price'] ?? 0)) ?>"
                                         data-event-notes="<?= e((string) ($item['notes'] ?? '')) ?>">
                                        <i class="bi <?= e($statusIcon) ?> calendar-event-card__status-icon" aria-hidden="true"></i>
                                        <div class="calendar-event-card__inner">
                                            <div class="calendar-event-card__time"><?= e($itemTime) ?></div>
                                            <div class="calendar-event-card__title"><?= e($item['title']) ?></div>
                                            <div class="calendar-event-card__service"><?= e($item['subtitle']) ?></div>
                                        </div>
                                        <div class="calendar-event-popover" role="tooltip">
                                            <div class="calendar-event-popover__body">
                                                <div class="calendar-event-popover__time"><?= e($itemTime) ?></div>
                                                <strong><?= e($item['title']) ?></strong>
                                                <span><?= e($item['subtitle']) ?></span>
                                                <small><?= e($item['staff']) ?> - <?= e($item['status']) ?></small>
                                                <?php if ($item['notes'] !== ''): ?>
                                                    <small><?= e($item['notes']) ?></small>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endforeach; ?>

                        <?php if ($indicatorOffset !== null): ?>
                            <div class="now-indicator" style="top: <?= $indicatorOffset ?>px;">
                                <div class="now-indicator-pill">
                                    <?= e(date('H:i')) ?>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <div class="calendar-fab-wrapper">
        <div class="calendar-fab-menu" id="calendarFabMenu">
            <button class="calendar-fab-menu__item d-flex align-items-center gap-2 w-100 border-0 bg-transparent text-start js-calendar-entry-trigger"
                    type="button"
                    data-entry-mode="sales"
                    data-bs-toggle="modal"
                    data-bs-target="#agendaModal">
                <i class="bi bi-plus-lg"></i> <span>Penjualan</span>
            </button>
            <button class="calendar-fab-menu__item border-0 bg-transparent text-start d-flex align-items-center gap-2 w-100" type="button" data-bs-toggle="modal" data-bs-target="#blockTimeModal">
                <i class="bi bi-plus-lg"></i> <span>Blokir Waktu</span>
            </button>
            <button class="calendar-fab-menu__item border-0 bg-transparent text-start d-flex align-items-center gap-2 w-100 js-calendar-entry-trigger"
                    type="button"
                    data-entry-mode="agenda"
                    data-bs-toggle="modal"
                    data-bs-target="#agendaModal">
                <i class="bi bi-plus-lg"></i> <span>Agenda</span>
            </button>
            <button class="calendar-fab-menu__item calendar-fab-menu__close border-0 text-start d-flex align-items-center gap-2 w-100 js-calendar-fab-close" type="button">
                <i class="bi bi-x-lg"></i> <span>Tutup</span>
            </button>
        </div>
        <button class="calendar-fab custom-fab-green js-calendar-fab" type="button" aria-label="Tambah aksi kalender" aria-expanded="false" aria-controls="calendarFabMenu">
            <i class="bi bi-plus"></i>
        </button>
    </div>
</section>

<div class="modal fade" id="calendarAgendaViewModal" tabindex="-1" aria-hidden="true" data-status-action="<?= e(url('/calendar/bookings/status')) ?>">
    <div class="modal-dialog modal-dialog-centered calendar-agenda-view-dialog">
        <div class="modal-content calendar-agenda-view">
            <div class="calendar-agenda-view__panel">
                <div class="calendar-agenda-view__header">
                    <h2>Lihat Agenda</h2>
                    <button type="button" class="calendar-agenda-view__close" data-bs-dismiss="modal" aria-label="Tutup">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>

                <div class="calendar-agenda-view__customer js-agenda-view-customer">Pelanggan Walk-In</div>

                <div class="calendar-agenda-view__status-wrap">
                    <button class="calendar-agenda-view__status js-agenda-view-status-toggle" type="button" aria-expanded="false">
                        <span class="js-agenda-view-status-label">NEW</span>
                        <i class="bi bi-chevron-down"></i>
                    </button>
                    <div class="calendar-agenda-view__status-menu js-agenda-view-status-menu" hidden>
                        <button class="calendar-agenda-view__status-option is-new" type="button" data-agenda-view-status="new">
                            <i class="bi bi-circle"></i>
                            <span>NEW</span>
                        </button>
                        <button class="calendar-agenda-view__status-option is-confirmed" type="button" data-agenda-view-status="confirmed">
                            <i class="bi bi-hand-thumbs-up"></i>
                            <span>CONFIRMED</span>
                        </button>
                        <button class="calendar-agenda-view__status-option is-arrived" type="button" data-agenda-view-status="arrived">
                            <i class="bi bi-emoji-smile"></i>
                            <span>ARRIVED</span>
                        </button>
                        <button class="calendar-agenda-view__status-option is-started" type="button" data-agenda-view-status="started">
                            <i class="bi bi-play"></i>
                            <span>STARTED</span>
                        </button>
                        <button class="calendar-agenda-view__status-option is-completed" type="button" data-agenda-view-status="completed">
                            <i class="bi bi-check-lg"></i>
                            <span>COMPLETED</span>
                        </button>
                    </div>
                </div>

                <div class="calendar-agenda-view__meta">
                    <i class="bi bi-geo-alt-fill"></i>
                    <span class="js-agenda-view-branch">Star Salon</span>
                    <span>&bull;</span>
                    <span class="js-agenda-view-date"><?= e($dayLabel) ?></span>
                </div>

                <div class="calendar-agenda-view__services js-agenda-view-services"></div>

                <div class="calendar-agenda-view__updated">
                    <i class="bi bi-clock"></i>
                    <span class="js-agenda-view-updated">Terakhir diperbarui pada: -</span>
                </div>

                <div class="calendar-agenda-view__footer">
                    <div class="calendar-agenda-view__total js-agenda-view-total">Total: Rp 0,00</div>
                    <div class="calendar-agenda-view__more-wrap">
                        <button type="button" class="calendar-agenda-view__more js-agenda-view-more-toggle" aria-expanded="false">Lainnya <i class="bi bi-caret-down-fill ms-1"></i></button>
                        <div class="calendar-agenda-view__more-menu js-agenda-view-more-menu" hidden>
                            <button type="button" class="calendar-agenda-view__more-item js-agenda-view-action" data-agenda-view-action="edit">
                                <i class="bi bi-pencil"></i>
                                <span>Ubah Agenda</span>
                            </button>
                            <button type="button" class="calendar-agenda-view__more-item js-agenda-view-action" data-agenda-view-action="add-product">
                                <i class="bi bi-plus-lg"></i>
                                <span>Tambahkan Produk</span>
                            </button>
                            <button type="button" class="calendar-agenda-view__more-item js-agenda-view-action" data-agenda-view-action="reschedule">
                                <i class="bi bi-calendar-event"></i>
                                <span>Jadwal Ulang</span>
                            </button>
                            <button type="button" class="calendar-agenda-view__more-item is-danger js-agenda-view-action" data-agenda-view-action="cancelled">
                                <i class="bi bi-x-lg"></i>
                                <span>Batal</span>
                            </button>
                            <button type="button" class="calendar-agenda-view__more-item is-danger js-agenda-view-action" data-agenda-view-action="no_show">
                                <i class="bi bi-person-x"></i>
                                <span>Tidak hadir</span>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="calendar-agenda-view__checkout">Checkout</button>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="agendaModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-fullscreen">
        <form method="post"
              action="<?= e(url('/calendar/bookings')) ?>"
              class="modal-content calendar-agenda-modal js-booking-form js-calendar-agenda-form"
              data-update-action="<?= e(url('/calendar/bookings/update')) ?>"
              data-customers="<?= e(json_encode($customers, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-staff="<?= e(json_encode($calendar['staff'], JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-resources="<?= e(json_encode($agendaResources, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-discounts="<?= e(json_encode($agendaDiscountRows, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-owned-vouchers="<?= e(json_encode($agendaOwnedVouchers, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-sales-catalogs="<?= e(json_encode($agendaSalesCatalogs, JSON_HEX_APOS | JSON_HEX_QUOT)) ?>"
              data-today="<?= e(date('Y-m-d')) ?>"
              data-sales-url="<?= e(url('/sales?tab=invoices')) ?>">
            <?= csrf_field() ?>
            <input class="js-agenda-booking-id" type="hidden" name="booking_id" value="">
            <input class="js-agenda-customer-name" type="hidden" name="customer_name" value="Walk-In">
            <input class="js-agenda-customer-phone" type="hidden" name="customer_phone" value="">
            <input class="js-agenda-branch-input" type="hidden" name="branch_name" value="Star Salon">
            <input class="js-calendar-date-input" type="hidden" name="date" value="<?= e($calendar['date']) ?>">
            <input class="js-calendar-time-input" type="hidden" name="time" value="<?= e($selectedTime) ?>">
            <input class="js-agenda-repeat-enabled-input" type="hidden" name="repeat_enabled" value="0">
            <input class="js-agenda-repeat-frequency-input" type="hidden" name="repeat_frequency" value="daily">
            <input class="js-agenda-repeat-end-type-input" type="hidden" name="repeat_end_type" value="after">
            <select class="d-none js-calendar-staff-input js-staff-services" name="staff_id" aria-hidden="true" tabindex="-1">
                <?php foreach ($calendar['staff'] as $staffMember): ?>
                    <option value="<?= e((string) $staffMember['id']) ?>" <?= (int) $activeStaff['id'] === (int) $staffMember['id'] ? 'selected' : '' ?>>
                        <?= e($staffMember['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <div class="js-agenda-service-inputs"></div>

            <div class="calendar-agenda-modal__header">
                <div></div>
                <h2 class="js-agenda-title">Agenda Baru</h2>
                <button type="button" class="btn-close js-agenda-close-request" aria-label="Tutup"></button>
            </div>

            <div class="calendar-agenda-modal__body">
                <div class="calendar-agenda-left">
                    <div class="calendar-agenda-review-toolbar">
                        <div class="calendar-agenda-branch-select">
                            <button class="calendar-agenda-review-pill js-agenda-branch-toggle" type="button" aria-expanded="false">
                                <span class="js-agenda-branch-label">Star Salon</span>
                                <i class="bi bi-chevron-down ms-4"></i>
                            </button>
                            <div class="calendar-agenda-branch-menu js-agenda-branch-menu" hidden>
                                <button class="js-agenda-branch-option" type="button" data-branch-name="Star Salon">Star Salon</button>
                            </div>
                        </div>
                        <div class="calendar-agenda-review-spacer"></div>
                        <button class="calendar-agenda-review-pill js-agenda-shared-time-open" type="button"><i class="bi bi-clock"></i>Jam mulai bersamaan</button>
                        <button class="calendar-agenda-review-pill js-agenda-note-open" type="button"><i class="bi bi-chat-square"></i>Catatan</button>
                        <button class="calendar-agenda-review-pill js-agenda-repeat-open" type="button"><i class="bi bi-arrow-repeat"></i>Ulang</button>
                        <div class="calendar-agenda-date-picker-wrap">
                            <button class="calendar-agenda-review-pill js-agenda-date-open" type="button">
                                <i class="bi bi-calendar3"></i><span class="js-agenda-date-label"><?= e($selectedDate->format('d M Y')) ?></span>
                            </button>
                            <input class="js-agenda-date-picker js-datepicker" type="text" value="<?= e($calendar['date']) ?>" tabindex="-1" aria-hidden="true">
                        </div>
                    </div>

                    <div class="calendar-agenda-note-panel js-agenda-note-panel" hidden>
                        <textarea class="js-agenda-note-input" name="notes" placeholder="Catatan"></textarea>
                        <button class="js-agenda-note-close" type="button" aria-label="Tutup catatan"><i class="bi bi-x-lg"></i></button>
                    </div>

                    <button class="calendar-agenda-review-addbar js-agenda-review-add-service" type="button">
                        <span>Tambahkan Layanan</span>
                        <i class="bi bi-search"></i>
                    </button>

                    <div class="calendar-agenda-review-list js-agenda-review-list"></div>

                    <div class="calendar-agenda-searchbar calendar-agenda-picker-search">
                        <button class="js-agenda-picker-back" type="button" data-bs-dismiss="modal" aria-label="Kembali"><i class="bi bi-chevron-left"></i></button>
                        <input class="js-agenda-service-search" type="search" placeholder="Cari service..." autocomplete="off">
                        <i class="bi bi-search"></i>
                    </div>

                    <div class="calendar-sales-topbar js-calendar-sales-topbar">
                        <button class="calendar-sales-tab js-calendar-sales-tab" type="button" data-sales-catalog="payable">Akan Dibayar</button>
                        <button class="calendar-sales-tab is-active js-calendar-sales-tab" type="button" data-sales-catalog="services">Services</button>
                        <button class="calendar-sales-tab js-calendar-sales-tab" type="button" data-sales-catalog="packages">Packages</button>
                        <button class="calendar-sales-tab js-calendar-sales-tab" type="button" data-sales-catalog="products">Products</button>
                        <button class="calendar-sales-tab js-calendar-sales-tab" type="button" data-sales-catalog="vouchers">Vouchers</button>
                        <button class="calendar-sales-tab js-calendar-sales-tab" type="button" data-sales-catalog="plans">Plans</button>
                    </div>

                    <div class="calendar-sales-subfilters js-calendar-sales-subfilters" hidden></div>

                    <div class="calendar-agenda-chips js-calendar-service-filters" aria-label="Kategori layanan">
                        <button class="calendar-agenda-chip is-active js-agenda-filter" type="button" data-agenda-filter="all">Paket Layanan</button>
                        <button class="calendar-agenda-chip js-agenda-filter" type="button" data-agenda-filter="hair-cut">Hair Cut</button>
                        <button class="calendar-agenda-chip js-agenda-filter" type="button" data-agenda-filter="hair-treatment">Hair Treatment</button>
                        <button class="calendar-agenda-chip js-agenda-filter" type="button" data-agenda-filter="hair-coloring">Hair Coloring</button>
                    </div>

                    <div class="calendar-sales-empty js-calendar-sales-empty">Belum ada item pada tab ini.</div>
                    <div class="calendar-sales-grid js-calendar-sales-grid" hidden></div>

                    <div class="calendar-agenda-services">
                        <?php foreach ($services as $service): ?>
                            <?php
                                $category = $agendaServiceCategory($service);
                                $initials = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string) $service['name']), 0, 2) ?: 'SV');
                                $hours = (int) ceil(((int) $service['duration']) / 60);
                            ?>
                            <button class="calendar-agenda-service js-agenda-service-card"
                                    type="button"
                                    data-service-id="<?= e((string) $service['id']) ?>"
                                    data-service-name="<?= e($service['name']) ?>"
                                    data-service-price="<?= e((string) $service['price']) ?>"
                                    data-service-duration="<?= e((string) $service['duration']) ?>"
                                    data-service-category="<?= e($category) ?>">
                                <span class="calendar-agenda-service__initials"><?= e($initials) ?></span>
                                <span class="calendar-agenda-service__body">
                                    <strong><?= e($service['name']) ?></strong>
                                    <span class="calendar-agenda-service__meta">
                                        <span><?= e((string) $hours) ?>h</span>
                                        <span class="calendar-agenda-dot"></span>
                                        <span><?= money($service['price']) ?></span>
                                        <?php if (in_array('Men', $service['variants'] ?? [], true)): ?>
                                            <i class="bi bi-gender-male calendar-agenda-service__gender"></i>
                                        <?php elseif (in_array('Women', $service['variants'] ?? [], true)): ?>
                                            <i class="bi bi-gender-female calendar-agenda-service__gender"></i>
                                        <?php endif; ?>
                                    </span>
                                </span>
                            </button>
                        <?php endforeach; ?>
                    </div>

                    <div class="calendar-agenda-selected is-empty js-agenda-selected">
                        <div class="calendar-agenda-selected__rows js-agenda-selected-rows"></div>
                        <div class="calendar-agenda-selected__footer">
                            <div class="calendar-agenda-summary js-agenda-summary">0 Layanan <span class="calendar-agenda-dot d-inline-block mx-2"></span> Rp 0</div>
                            <button class="calendar-agenda-footer-action js-agenda-footer-action" type="button" disabled>Tambahkan 0 Layanan</button>
                        </div>
                    </div>

                    <div class="calendar-agenda-checkout-left js-agenda-checkout-left" hidden>
                        <div class="calendar-sales-cart-toolbar js-calendar-sales-cart-toolbar" hidden>
                            <div class="calendar-agenda-checkout-branch"><i class="bi bi-geo-alt-fill"></i><span class="js-agenda-checkout-branch">Star Salon</span></div>
                            <button class="calendar-sales-cart-toolbar__date js-agenda-date-open-secondary" type="button">
                                <i class="bi bi-calendar3"></i><span class="js-agenda-date-label-secondary"><?= e($selectedDate->format('d M Y')) ?></span>
                            </button>
                        </div>
                        <div class="calendar-agenda-checkout-branch"><i class="bi bi-geo-alt-fill"></i><span class="js-agenda-checkout-branch">Star Salon</span></div>
                        <button class="calendar-agenda-checkout-search js-checkout-item-picker-open" type="button">
                            <span>Cari item untuk di jual</span>
                            <i class="bi bi-search"></i>
                        </button>
                        <div class="calendar-agenda-checkout-list js-agenda-checkout-list"></div>
                        <div class="calendar-agenda-checkout-summary">
                            <div class="calendar-agenda-checkout-summary-row">
                                <span>Sub Total</span>
                                <span class="js-agenda-checkout-subtotal">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-checkout-summary-row">
                                <a href="#" class="js-agenda-checkout-discount">Tambah Diskon</a>
                                <span class="js-agenda-checkout-discount-total">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-checkout-summary-row">
                                <span>Pajak</span>
                                <span>Rp 0</span>
                            </div>
                            <div class="calendar-agenda-checkout-summary-row">
                                <span>Jumlah Pembulatan</span>
                                <span>Rp 0</span>
                            </div>
                            <div class="calendar-agenda-checkout-summary-row is-total">
                                <span>Total</span>
                                <span class="js-agenda-checkout-total">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-checkout-summary-row">
                                <a href="#" class="js-agenda-checkout-tip">Tambah tip</a>
                                <span></span>
                            </div>
                            <div class="calendar-agenda-checkout-due js-agenda-checkout-due">Sisa pembayaran Rp 0,00</div>
                        </div>
                    </div>
                </div>

                <div class="calendar-agenda-right">
                    <div>
                        <div class="calendar-agenda-customer-empty js-agenda-customer-empty">
                            <div class="calendar-agenda-customer-field">
                                <button class="calendar-agenda-customer-field__back js-agenda-customer-back" type="button" aria-label="Walk-In">
                                    <i class="bi bi-arrow-left"></i>
                                </button>
                                <input class="calendar-agenda-customer-search js-agenda-customer-search"
                                       type="search"
                                       placeholder="Cari customer"
                                       autocomplete="off">
                            </div>
                            <a class="calendar-agenda-customer-new" href="<?= e(url('/customers?modal=customer')) ?>">
                                <span>Pelanggan Baru</span>
                                <i class="bi bi-plus-lg"></i>
                            </a>
                            <div class="calendar-agenda-walkin-copy">Cari customer, atau kosongkan untuk Walk-In.</div>
                            <div class="calendar-agenda-customer-list js-agenda-customer-list">
                                <?php foreach ($customers as $customer): ?>
                                    <?php $customerTags = $customer['tags'] ?? []; ?>
                                    <button class="calendar-agenda-customer-row js-agenda-customer-row"
                                            type="button"
                                            data-customer-name="<?= e($customer['name']) ?>"
                                            data-customer-phone="<?= e($customer['phone']) ?>"
                                            data-customer-tags="<?= e(implode(', ', $customerTags)) ?>">
                                        <span class="calendar-agenda-customer-avatar"><i class="bi bi-emoji-smile"></i></span>
                                        <div>
                                            <strong><?= e($customer['name']) ?></strong>
                                            <?php if ($customerTags !== []): ?>
                                                <span class="calendar-agenda-customer-row__tag"><?= e($customerTags[0]) ?></span>
                                            <?php endif; ?>
                                        </div>
                                    </button>
                                <?php endforeach; ?>
                            </div>
                        </div>

                        <div class="calendar-agenda-customer-card js-agenda-customer-card" hidden>
                            <div class="calendar-agenda-customer-avatar"><i class="bi bi-emoji-smile"></i></div>
                            <div>
                                <strong class="js-agenda-customer-display">Walk-In</strong>
                                <span class="js-agenda-customer-tag">Walk-In</span>
                            </div>
                            <div class="calendar-agenda-customer-menu-wrap">
                                <button class="calendar-agenda-customer-reset js-agenda-customer-menu-toggle" type="button" aria-label="Menu pelanggan" aria-expanded="false">
                                    <i class="bi bi-three-dots"></i>
                                </button>
                                <div class="calendar-agenda-customer-menu js-agenda-customer-menu" hidden>
                                    <button class="js-agenda-customer-remove" type="button">Hapus dari checkout</button>
                                    <button type="button">Detail Pelanggan</button>
                                    <button class="is-danger" type="button">Blokir Pelanggan</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="calendar-agenda-checkout-payment js-agenda-checkout-payment" hidden>
                        <div class="calendar-agenda-checkout-payment-label">Bayar</div>
                        <input class="calendar-agenda-checkout-payment-amount js-agenda-checkout-payment-amount"
                               type="text"
                               inputmode="numeric"
                               value="Rp 0,00"
                               aria-label="Nominal pembayaran">
                        <div class="calendar-agenda-checkout-payments">
                            <button class="js-agenda-payment-method" type="button" data-payment-method="CASH">CASH</button>
                            <button class="js-agenda-payment-method" type="button" data-payment-method="VOUCHER">VOUCHER</button>
                            <button class="js-agenda-payment-method" type="button" data-payment-method="OTHER">OTHER</button>
                            <button class="js-agenda-payment-method" type="button" data-payment-method="CARD">CARD</button>
                        </div>
                        <div class="calendar-agenda-checkout-payment-footer">
                            <span>Sisa pembayaran</span>
                            <span class="js-agenda-checkout-payment-due">Rp 0,00</span>
                        </div>
                        <div class="calendar-agenda-payment-list js-agenda-payment-list"></div>
                        <div class="calendar-agenda-checkout-payment-actions">
                            <div class="calendar-agenda-more-wrap">
                                <button class="js-agenda-more-toggle" type="button" aria-expanded="false">
                                    Lainnya <i class="bi bi-chevron-down ms-2"></i>
                                </button>
                                <div class="calendar-agenda-more-menu js-agenda-more-menu" hidden>
                                    <button class="js-agenda-view-invoice" type="button">Simpan Belum Dibayar</button>
                                    <button class="js-agenda-invoice-detail-open" type="button">Detail Faktur</button>
                                </div>
                            </div>
                            <button class="js-agenda-payment-complete" type="button" disabled>Selesaikan</button>
                        </div>
                    </div>
                    <div class="calendar-agenda-voucher-drawer js-agenda-voucher-drawer" hidden>
                        <div class="calendar-agenda-voucher-panel">
                            <div class="calendar-agenda-voucher-header">
                                <h3>Gunakan Voucher</h3>
                                <button class="js-agenda-voucher-close" type="button" aria-label="Tutup voucher">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div class="calendar-agenda-voucher-search">
                                <input class="js-agenda-voucher-search" type="search" placeholder="Masukkan kode voucher" autocomplete="off">
                                <button class="calendar-agenda-voucher-search__scan" type="button" aria-label="Scan voucher">
                                    <i class="bi bi-upc-scan"></i>
                                </button>
                            </div>
                            <div class="calendar-agenda-voucher-list js-agenda-voucher-list"></div>
                            <div class="calendar-agenda-voucher-empty js-agenda-voucher-empty">
                                <i class="bi bi-file-earmark-x"></i>
                                <strong>No Result</strong>
                            </div>
                        </div>
                    </div>
                    <div class="calendar-agenda-total js-agenda-review-total">Jumlah total Rp 0</div>
                    <div class="calendar-agenda-actions">
                        <button class="calendar-agenda-checkout js-agenda-checkout" type="button" disabled>Checkout</button>
                        <button class="calendar-agenda-save js-agenda-submit" type="submit" disabled>Simpan Agenda</button>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-invoice-view js-agenda-invoice-view" hidden>
                <div class="calendar-agenda-invoice-header">
                    <h3>Lihat Faktur</h3>
                    <button class="calendar-agenda-invoice-close js-agenda-invoice-view-close" type="button" aria-label="Tutup faktur">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="calendar-agenda-invoice-body">
                    <div class="calendar-agenda-invoice-preview">
                        <div class="calendar-agenda-invoice-receipt js-agenda-invoice-receipt">
                            <div class="calendar-agenda-invoice-store">
                                <i class="bi bi-shop"></i>
                                <strong>Star Salon</strong>
                                <div class="calendar-agenda-invoice-address">Star Salon - Jl. Raya Inpres No.04, RT.4/RW.10, P. Tengah, Kec. Kramat jati, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13540</div>
                            </div>
                            <div class="calendar-agenda-invoice-title">
                                <div>Faktur 2</div>
                                <div class="js-agenda-invoice-date"><?= e(date('d M Y', strtotime($calendar['date']))) ?></div>
                            </div>
                            <div class="calendar-agenda-invoice-items js-agenda-invoice-items"></div>
                            <div class="calendar-agenda-invoice-total-row">
                                <span></span>
                                <span>Sub Total</span>
                                <span class="js-agenda-invoice-subtotal">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-invoice-total-row">
                                <span></span>
                                <span>Total</span>
                                <span class="js-agenda-invoice-total">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-invoice-total-row">
                                <span></span>
                                <span>Grand total</span>
                                <span class="js-agenda-invoice-grand-total">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-invoice-total-row">
                                <span></span>
                                <span>Sisa pembayaran</span>
                                <span class="js-agenda-invoice-remaining">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-invoice-seller">Penjualan oleh Rayhan Doni Pramana</div>
                        </div>
                        <div class="calendar-agenda-invoice-a5 js-agenda-invoice-a5" hidden>
                            <div class="calendar-agenda-invoice-a5-head">
                                <div class="calendar-agenda-invoice-a5-logo"><i class="bi bi-shop"></i></div>
                                <div class="calendar-agenda-invoice-a5-store">
                                    <strong>Star Salon</strong>
                                    <div>Star Salon - Jl. Raya Inpres No.04, RT.4/RW.10, P. Tengah, Kec. Kramat jati, Kota Jakarta Timur, Daerah Khusus Ibukota Jakarta 13540</div>
                                </div>
                                <div class="calendar-agenda-invoice-a5-number">
                                    <strong>Faktur 2</strong>
                                    <div class="js-agenda-invoice-a5-date"><?= e(date('d M Y', strtotime($calendar['date']))) ?></div>
                                </div>
                            </div>
                            <table class="calendar-agenda-invoice-a5-table">
                                <thead>
                                    <tr>
                                        <th>Nama Item</th>
                                        <th>QTY</th>
                                        <th>Harga</th>
                                        <th>Diskon</th>
                                        <th>Tarif Pajak</th>
                                        <th>Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody class="js-agenda-invoice-a5-items"></tbody>
                            </table>
                            <div class="calendar-agenda-invoice-a5-totals">
                                <span>Sub Total</span><span class="js-agenda-invoice-a5-subtotal">Rp 0,00</span>
                                <strong>Total</strong><span class="js-agenda-invoice-a5-total">Rp 0,00</span>
                                <strong>Grand total</strong><span class="js-agenda-invoice-a5-grand-total">Rp 0,00</span>
                                <strong>Sisa pembayaran</strong><span class="js-agenda-invoice-a5-remaining">Rp 0,00</span>
                            </div>
                            <div class="calendar-agenda-invoice-a5-seller">Penjualan oleh Rayhan Doni Pramana</div>
                        </div>
                        <div class="calendar-agenda-invoice-tools">
                            <button class="calendar-agenda-invoice-tool js-agenda-invoice-format is-active" type="button" data-invoice-format="receipt" aria-label="Tampilan struk">
                                <i class="bi bi-receipt-cutoff"></i>
                            </button>
                            <button class="calendar-agenda-invoice-tool js-agenda-invoice-format" type="button" data-invoice-format="a5" aria-label="Tampilan A5">A5</button>
                            <button class="calendar-agenda-invoice-tool is-lower js-agenda-invoice-download" type="button" aria-label="Download faktur">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="calendar-agenda-invoice-tool js-agenda-invoice-print" type="button" aria-label="Print faktur">
                                <i class="bi bi-printer"></i>
                            </button>
                        </div>
                    </div>
                    <div class="calendar-agenda-invoice-side js-agenda-invoice-side">
                        <h4 class="js-agenda-invoice-customer">Walk-In</h4>
                        <div class="calendar-agenda-invoice-info js-agenda-invoice-info-panel">
                            <div class="calendar-agenda-invoice-status js-agenda-invoice-status">UNPAID</div>
                            <div class="calendar-agenda-invoice-meta js-agenda-invoice-meta">
                                <div>Dibuat pada <?= e(date('d M Y H:i')) ?></div>
                                <div>Tanggal jatuh tempo faktur <?= e(date('d M Y', strtotime($calendar['date']))) ?></div>
                                <div>di Star Salon Oleh Rayhan Doni Pramana dari POINT OF SALE</div>
                            </div>
                            <div class="calendar-agenda-invoice-share">
                                <button class="js-agenda-invoice-copy-link" type="button"><i class="bi bi-link-45deg"></i>Copy link</button>
                                <a class="js-agenda-invoice-email" href="#"><i class="bi bi-envelope"></i>Email</a>
                                <a class="js-agenda-invoice-whatsapp" href="#" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i>whatsapp</a>
                            </div>
                            <div class="calendar-agenda-invoice-actions js-agenda-invoice-actions">
                                <div class="calendar-agenda-invoice-more-wrap">
                                    <button class="js-agenda-invoice-more-toggle" type="button" aria-expanded="false">
                                        Lainnya <i class="bi bi-caret-down-fill ms-1"></i>
                                    </button>
                                    <div class="calendar-agenda-invoice-more-menu js-agenda-invoice-more-menu" hidden>
                                        <button class="js-agenda-invoice-mark-unpaid" type="button">Ubah faktur unpaid</button>
                                        <button class="js-agenda-invoice-reschedule" type="button">Agendakan Ulang</button>
                                        <button class="js-agenda-invoice-void" type="button">Dibatalkan</button>
                                        <button class="js-agenda-payment-detail-open" type="button">Rincian Pembayaran</button>
                                    </div>
                                </div>
                                <button class="js-agenda-invoice-pay-now" type="button">Bayar Sekarang</button>
                            </div>
                        </div>
                        <div class="calendar-agenda-invoice-pay-panel js-agenda-invoice-pay-panel" hidden>
                            <div class="calendar-agenda-checkout-payment-label">Bayar</div>
                            <input class="calendar-agenda-checkout-payment-amount js-agenda-invoice-payment-amount"
                                   type="text"
                                   inputmode="numeric"
                                   value="Rp 0,00"
                                   aria-label="Nominal pembayaran faktur">
                            <div class="calendar-agenda-checkout-payments calendar-agenda-invoice-payments">
                                <button class="js-agenda-invoice-payment-method" type="button" data-payment-method="CASH">CASH</button>
                                <button class="js-agenda-invoice-payment-method" type="button" data-payment-method="VOUCHER">VOUCHER</button>
                                <button class="js-agenda-invoice-payment-method" type="button" data-payment-method="OTHER">OTHER</button>
                                <button class="js-agenda-invoice-loyalty-open" type="button">LOYALTY POINT</button>
                                <button class="js-agenda-invoice-payment-method" type="button" data-payment-method="CARD">CARD</button>
                            </div>
                            <div class="calendar-agenda-checkout-payment-footer">
                                <span>Sisa pembayaran</span>
                                <span class="js-agenda-invoice-payment-due">Rp 0,00</span>
                                <button class="calendar-agenda-invoice-payment-reset js-agenda-invoice-payment-reset" type="button" aria-label="Hapus pembayaran">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div class="calendar-agenda-payment-list js-agenda-invoice-payment-list"></div>
                            <div class="calendar-agenda-checkout-payment-actions">
                                <button type="button">Lainnya <i class="bi bi-caret-down-fill ms-1"></i></button>
                                <button class="js-agenda-invoice-payment-complete" type="button" disabled>Selesaikan</button>
                            </div>
                        </div>
                        <div class="calendar-agenda-loyalty-drawer js-agenda-loyalty-drawer" hidden>
                            <div class="calendar-agenda-loyalty-header">
                                <h3>Tukar Point</h3>
                                <button class="js-agenda-loyalty-close" type="button" aria-label="Tutup tukar point">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                            <div class="calendar-agenda-loyalty-avatar" aria-hidden="true"></div>
                            <div class="calendar-agenda-loyalty-empty">
                                <i class="bi bi-file-earmark-x"></i>
                                <strong>No Loyalty Points With Discount Type Found</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-tool-backdrop js-agenda-tool-backdrop" hidden></div>
            <div class="calendar-agenda-item-dialog js-agenda-item-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="agendaItemDialogTitle">
                <h3 id="agendaItemDialogTitle" class="js-agenda-item-title">Layanan</h3>
                <div class="calendar-agenda-item-dialog__subtitle js-agenda-item-subtitle" hidden></div>
                <div class="calendar-agenda-item-dialog__count">1 pilihan</div>
                <div class="calendar-agenda-item-dialog__choice">
                    <div>
                        <strong class="js-agenda-item-choice-title">(1h)</strong>
                        <span class="calendar-agenda-item-dialog__meta js-agenda-item-choice-meta" hidden></span>
                        <span class="js-agenda-item-price">Rp 0,00</span>
                    </div>
                    <i class="bi bi-record-circle"></i>
                </div>
                <div class="calendar-agenda-item-dialog__qty">
                    <button class="js-agenda-item-minus" type="button" aria-label="Kurangi">-</button>
                    <span class="js-agenda-item-qty">1</span>
                    <button class="js-agenda-item-plus" type="button" aria-label="Tambah">+</button>
                </div>
                <div class="calendar-agenda-item-dialog__actions">
                    <button class="calendar-agenda-item-dialog__cancel js-agenda-item-cancel" type="button">Batal</button>
                    <button class="calendar-agenda-item-dialog__add js-agenda-item-add" type="button">Tambahkan</button>
                </div>
            </div>
            <div class="calendar-agenda-time-dialog js-agenda-shared-time-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="agendaSharedTimeTitle">
                <h3 id="agendaSharedTimeTitle">Atur jam mulai bersamaan untuk semua layanan</h3>
                <button class="calendar-agenda-time-display js-agenda-shared-time-toggle" type="button">
                    <i class="bi bi-clock"></i>
                    <span class="js-agenda-shared-time-display">00:00</span>
                </button>
                <div class="calendar-agenda-time-picker" aria-label="Pilih jam mulai">
                    <div class="calendar-agenda-time-column js-agenda-shared-time-hours">
                        <div class="calendar-agenda-time-column__label">HH</div>
                    </div>
                    <div class="calendar-agenda-time-column js-agenda-shared-time-minutes">
                        <div class="calendar-agenda-time-column__label">mm</div>
                    </div>
                </div>
                <div class="calendar-agenda-time-services js-agenda-shared-time-services"></div>
                <div class="calendar-agenda-time-actions">
                    <button class="calendar-agenda-time-cancel js-agenda-shared-time-cancel" type="button">Batal</button>
                    <button class="calendar-agenda-time-save js-agenda-shared-time-save" type="button">Simpan</button>
                </div>
            </div>

            <div class="calendar-agenda-repeat-dialog js-agenda-repeat-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="agendaRepeatTitle">
                <div class="calendar-agenda-repeat-header">
                    <h3 id="agendaRepeatTitle">Ulangi agenda ini</h3>
                    <label class="calendar-agenda-repeat-switch js-agenda-repeat-switch">
                        <input class="js-agenda-repeat-toggle" type="checkbox">
                        <span></span>
                    </label>
                </div>
                <div class="calendar-agenda-repeat-body">
                    <p class="calendar-agenda-repeat-empty">Aktifkan agenda berulang untuk melakukan agenda berulang sesuai dengan tanggal/waktu yang diatur</p>
                    <div class="calendar-agenda-repeat-fields">
                        <div class="calendar-agenda-repeat-field">
                            <label>Ulang setiap:</label>
                            <select class="calendar-agenda-repeat-select js-agenda-repeat-frequency" name="repeat_rule">
                                <optgroup label="Daily">
                                    <option value="daily">Daily</option>
                                    <?php for ($i = 2; $i <= 7; $i++): ?>
                                        <option value="daily:<?= e((string) $i) ?>">Every <?= e((string) $i) ?> Days</option>
                                    <?php endfor; ?>
                                </optgroup>
                                <optgroup label="Weekly">
                                    <option value="weekly">Weekly</option>
                                    <?php for ($i = 2; $i <= 10; $i++): ?>
                                        <option value="weekly:<?= e((string) $i) ?>">Every <?= e((string) $i) ?> Weeks</option>
                                    <?php endfor; ?>
                                </optgroup>
                                <optgroup label="Monthly">
                                    <option value="monthly">Monthly</option>
                                    <?php for ($i = 2; $i <= 10; $i++): ?>
                                        <option value="monthly:<?= e((string) $i) ?>">Every <?= e((string) $i) ?> Months</option>
                                    <?php endfor; ?>
                                </optgroup>
                            </select>
                        </div>
                        <div class="calendar-agenda-repeat-field">
                            <label>Akhir perulangan</label>
                            <div class="calendar-agenda-repeat-end-tabs">
                                <button class="js-agenda-repeat-end-tab is-active" type="button" data-repeat-end="after">Setelah</button>
                                <button class="js-agenda-repeat-end-tab" type="button" data-repeat-end="date">Tanggal Spesifik</button>
                            </div>
                        </div>
                        <div class="calendar-agenda-repeat-count js-agenda-repeat-count-row">
                            <input class="js-agenda-repeat-count" type="number" name="repeat_count" min="1" value="5">
                            <span>Kali</span>
                        </div>
                        <div class="calendar-agenda-repeat-specific js-agenda-repeat-date-row" hidden>
                            <input class="calendar-agenda-repeat-date js-agenda-repeat-date js-datepicker" type="text" name="repeat_until" value="<?= e($calendar['date']) ?>" autocomplete="off">
                        </div>
                    </div>
                    <div class="calendar-agenda-time-actions mt-4">
                        <button class="calendar-agenda-time-cancel js-agenda-repeat-cancel" type="button">Batal</button>
                        <button class="calendar-agenda-time-save js-agenda-repeat-apply" type="button">Terapkan</button>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-invoice-detail-modal js-agenda-invoice-detail-modal" hidden>
                <div class="calendar-agenda-invoice-detail-box" role="dialog" aria-modal="true" aria-labelledby="agendaInvoiceDetailTitle">
                    <div class="calendar-agenda-invoice-detail-header">
                        <h3 id="agendaInvoiceDetailTitle">Invoice Details</h3>
                        <button class="js-agenda-invoice-detail-close" type="button" aria-label="Tutup detail faktur">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="calendar-agenda-invoice-detail-field">
                        <label>Received by</label>
                        <select class="js-agenda-invoice-received">
                            <option value="">Select</option>
                            <?php foreach ($calendar['staff'] as $staffMember): ?>
                                <option value="<?= e((string) $staffMember['id']) ?>"><?= e($staffMember['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="calendar-agenda-invoice-detail-field">
                        <label>Notes</label>
                        <textarea class="js-agenda-invoice-notes"></textarea>
                    </div>
                    <div class="calendar-agenda-invoice-detail-actions">
                        <button class="js-agenda-invoice-detail-cancel" type="button">Batal</button>
                        <button class="js-agenda-invoice-detail-save" type="button">Simpan</button>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-payment-detail-modal js-agenda-payment-detail-modal" hidden>
                <div class="calendar-agenda-payment-detail-box" role="dialog" aria-modal="true" aria-labelledby="agendaPaymentDetailTitle">
                    <div class="calendar-agenda-payment-detail-header">
                        <h3 id="agendaPaymentDetailTitle">Rincian Pembayaran</h3>
                        <button class="js-agenda-payment-detail-close" type="button" aria-label="Tutup rincian pembayaran">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="calendar-agenda-payment-detail-field">
                        <label>Pembayaran diterima oleh</label>
                        <select class="js-agenda-payment-detail-staff">
                            <?php foreach ($calendar['staff'] as $staffMember): ?>
                                <option value="<?= e((string) $staffMember['id']) ?>"><?= e($staffMember['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="calendar-agenda-payment-detail-actions">
                        <button class="calendar-agenda-payment-detail-cancel js-agenda-payment-detail-cancel" type="button">Batal</button>
                        <button class="calendar-agenda-payment-detail-save js-agenda-payment-detail-save" type="button">Selesai</button>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-void-invoice-modal js-agenda-void-invoice-modal" hidden>
                <div class="calendar-agenda-void-invoice-box" role="dialog" aria-modal="true" aria-labelledby="agendaVoidInvoiceTitle">
                    <div class="calendar-agenda-void-invoice-header">
                        <h3 id="agendaVoidInvoiceTitle">Void Faktur</h3>
                        <button class="js-agenda-void-invoice-close" type="button" aria-label="Tutup void faktur">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <p>Anda yakin akan menghapus faktur ini?</p>
                    <div class="calendar-agenda-void-invoice-actions">
                        <button class="calendar-agenda-void-invoice-cancel js-agenda-void-invoice-cancel" type="button">Batal</button>
                        <button class="calendar-agenda-void-invoice-confirm js-agenda-void-invoice-confirm" type="button">Void Faktur</button>
                    </div>
                </div>
            </div>

            <div class="calendar-agenda-confirm js-agenda-exit-confirm" hidden>
                <div class="calendar-agenda-confirm__box" role="dialog" aria-modal="true" aria-labelledby="agendaExitTitle">
                    <div class="calendar-agenda-confirm__header">
                        <h3 id="agendaExitTitle">Apakah Anda yakin?</h3>
                        <button class="calendar-agenda-confirm__close js-agenda-exit-cancel" type="button" aria-label="Tutup">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <p>Data tidak akan tersimpan. Apakah Anda yakin akan keluar tanpa menyimpan data terlebih dahulu?</p>
                    <div class="calendar-agenda-confirm__action">
                        <button class="calendar-agenda-confirm__exit js-agenda-exit-confirmed" type="button">Ya, keluar sekarang</button>
                    </div>
                </div>
            </div>
        </form>
    </div>
</div>

<div class="modal fade calendar-block-modal" id="blockTimeModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="calendar-block-modal__header">
                <h3 class="js-calendar-block-title">Blokir Waktu</h3>
                <button class="calendar-block-modal__close" type="button" data-bs-dismiss="modal" aria-label="Tutup">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="calendar-block-modal__body">
                <form method="post" action="<?= e(url('/calendar/blocks')) ?>" class="calendar-block-form js-calendar-block-form">
                    <?= csrf_field() ?>
                    <input type="hidden" name="title" value="Blokir Waktu">
                    <input class="js-calendar-block-id" type="hidden" name="block_id" value="">
                    <div class="calendar-block-form__field">
                        <label>Lokasi</label>
                        <div class="calendar-block-form__select-wrap">
                            <select class="calendar-block-form__select" aria-label="Lokasi blokir waktu">
                                <option>Star Salon</option>
                            </select>
                            <i class="bi bi-chevron-down"></i>
                        </div>
                    </div>
                    <div class="calendar-block-form__field">
                        <label>Staf</label>
                        <div class="calendar-block-form__select-wrap">
                            <select class="calendar-block-form__select js-calendar-staff-input js-calendar-block-staff" name="staff_id" data-default-value="<?= e((string) $activeStaff['id']) ?>" required>
                                <option value="">Select</option>
                                <?php foreach ($calendar['staff'] as $staffMember): ?>
                                    <option value="<?= e((string) $staffMember['id']) ?>" <?= (int) $staffMember['id'] === (int) $activeStaff['id'] ? 'selected' : '' ?>><?= e($staffMember['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <i class="bi bi-chevron-down"></i>
                        </div>
                    </div>
                    <div class="calendar-block-form__field">
                        <label>Tanggal Diblokir</label>
                        <div class="calendar-block-form__date-wrap">
                            <i class="bi bi-calendar3"></i>
                            <input class="calendar-block-form__date js-datepicker js-calendar-date-input js-calendar-block-date" type="text" name="date" value="<?= e($calendar['date']) ?>" data-default-value="<?= e($calendar['date']) ?>" autocomplete="off" required>
                        </div>
                    </div>
                    <div class="calendar-block-form__times">
                        <div class="calendar-block-form__field">
                            <label>Jam mulai</label>
                            <div class="calendar-block-form__time-wrap">
                                <button class="calendar-block-form__time-trigger js-calendar-block-time-trigger is-placeholder" type="button" data-block-time-target="start">
                                    <i class="bi bi-clock"></i>
                                    <span class="js-calendar-block-time-display" data-block-time-display="start">HH:mm</span>
                                </button>
                                <input class="js-calendar-time-input js-calendar-block-time-input" type="hidden" name="start_time" value="<?= e($selectedTime) ?>" data-default-value="<?= e($selectedTime) ?>" data-block-time-input="start">
                            </div>
                        </div>
                        <div class="calendar-block-form__field">
                            <label>Jam berakhir</label>
                            <div class="calendar-block-form__time-wrap">
                                <button class="calendar-block-form__time-trigger js-calendar-block-time-trigger is-placeholder" type="button" data-block-time-target="end">
                                    <i class="bi bi-clock"></i>
                                    <span class="js-calendar-block-time-display" data-block-time-display="end">HH:mm</span>
                                </button>
                                <input class="js-calendar-end-time-input js-calendar-block-time-input" type="hidden" name="end_time" value="<?= e($selectedEndTime) ?>" data-default-value="<?= e($selectedEndTime) ?>" data-block-time-input="end">
                            </div>
                        </div>
                    </div>
                    <div class="calendar-block-form__field">
                        <label>Deskripsi</label>
                        <textarea name="description" class="js-calendar-block-description" placeholder="Tulis alasan blokir waktu" required></textarea>
                    </div>
                    <div class="calendar-block-form__actions">
                        <button class="calendar-block-form__delete js-calendar-block-delete" type="submit" formaction="<?= e(url('/calendar/blocks/delete')) ?>" formnovalidate hidden>Hapus</button>
                        <button class="calendar-block-form__cancel" type="button" data-bs-dismiss="modal">Batal</button>
                        <button class="calendar-block-form__save js-calendar-block-save" type="submit">Simpan</button>
                    </div>
                    <div class="calendar-block-time-popover js-calendar-block-time-popover" hidden>
                        <div class="calendar-block-time-popover__panel">
                            <div class="calendar-block-time-popover__column js-calendar-block-time-hours">
                                <div class="calendar-block-time-popover__label">HH</div>
                            </div>
                            <div class="calendar-block-time-popover__column js-calendar-block-time-minutes">
                                <div class="calendar-block-time-popover__label">mm</div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
