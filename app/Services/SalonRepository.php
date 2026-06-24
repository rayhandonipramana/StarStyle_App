<?php

declare(strict_types=1);

namespace App\Services;

final class SalonRepository
{
    private const LEGACY_TABLE_ALIASES = [
        'stock_opname_sessions' => 'inventory_opname_sessions',
        'stock_opname_session_items' => 'inventory_opname_session_items',
    ];

    private array $baseData;
    private ?\PDO $pdo = null;
    private ?bool $dbReady = null;
    private array $tableExistsCache = [];
    private array $columnExistsCache = [];
    private bool $inventorySchemaEnsured = false;
    private bool $inventorySeedEnsured = false;
    private bool $staffScheduleSchemaEnsured = false;
    private bool $staffScheduleSeedEnsured = false;

    public function __construct(
        private readonly array $config,
        private readonly array $permissions,
    ) {
        date_default_timezone_set($config['timezone'] ?? 'Asia/Bangkok');
        $this->baseData = DemoData::make($config);
        $this->bootSessionState();
    }

    private function wantsDb(): bool
    {
        return ($this->config['data_source'] ?? 'demo') === 'db';
    }

    private function usingDb(): bool
    {
        return $this->wantsDb() && $this->databaseReady();
    }

    private function databaseReady(): bool
    {
        if (!$this->wantsDb()) {
            return false;
        }

        if ($this->dbReady !== null) {
            return $this->dbReady;
        }

        try {
            $pdo = $this->pdo();
            $pdo->query('SELECT 1');

            foreach (['users', 'roles', 'permissions'] as $table) {
                $pdo->query(sprintf('SELECT 1 FROM `%s` LIMIT 1', $table))->fetch();
            }

            return $this->dbReady = true;
        } catch (\Throwable) {
            return $this->dbReady = false;
        }
    }

    private function canUsePdo(): bool
    {
        if (!$this->wantsDb()) {
            return false;
        }

        try {
            $this->pdo();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function inventoryDbEnabled(): bool
    {
        if (!$this->canUsePdo()) {
            return false;
        }

        foreach ([
            'products',
            'suppliers',
            'stock_opname_sessions',
            'stock_opnames',
            'purchase_orders',
            'stock_movements',
        ] as $table) {
            if ($this->tableExists($table)) {
                return true;
            }
        }

        return false;
    }

    private function pdo(): \PDO
    {
        if (!$this->wantsDb()) {
            throw new \RuntimeException('Data source bukan DB.');
        }

        if ($this->pdo instanceof \PDO) {
            return $this->pdo;
        }

        $db = $this->config['db'] ?? [];
        $host = (string) ($db['host'] ?? '127.0.0.1');
        $port = (int) ($db['port'] ?? 3306);
        $database = (string) ($db['database'] ?? '');
        $charset = (string) ($db['charset'] ?? 'utf8mb4');
        $username = (string) ($db['username'] ?? 'root');
        $password = (string) ($db['password'] ?? '');

        if ($database === '') {
            throw new \RuntimeException('Konfigurasi database kosong: config.db.database');
        }

        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

        $this->pdo = new \PDO($dsn, $username, $password, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return $this->pdo;
    }

    private function dbAll(string $sql, array $params = []): array
    {
        $stmt = $this->pdo()->prepare($this->resolveSqlTableAliases($sql));
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    private function dbOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->pdo()->prepare($this->resolveSqlTableAliases($sql));
        $stmt->execute($params);
        $row = $stmt->fetch();

        return is_array($row) ? $row : null;
    }

    private function dbExecute(string $sql, array $params = []): void
    {
        $stmt = $this->pdo()->prepare($this->resolveSqlTableAliases($sql));
        $stmt->execute($params);
    }

    private function resolveTableName(string $table): string
    {
        if (!$this->canUsePdo()) {
            return self::LEGACY_TABLE_ALIASES[$table] ?? $table;
        }

        if ($this->tableListedInSchemaRaw($table)) {
            return $table;
        }

        $legacyTable = self::LEGACY_TABLE_ALIASES[$table] ?? null;
        if ($legacyTable !== null && $this->tableListedInSchemaRaw($legacyTable)) {
            return $legacyTable;
        }

        return $table;
    }

    private function resolveSqlTableAliases(string $sql): string
    {
        foreach (self::LEGACY_TABLE_ALIASES as $logicalTable => $_legacyTable) {
            $resolvedTable = $this->resolveTableName($logicalTable);
            if ($resolvedTable === $logicalTable) {
                continue;
            }

            $sql = preg_replace('/`' . preg_quote($logicalTable, '/') . '`/', '`' . $resolvedTable . '`', $sql) ?? $sql;
            $sql = preg_replace('/\b' . preg_quote($logicalTable, '/') . '\b/', $resolvedTable, $sql) ?? $sql;
        }

        return $sql;
    }

    private function tableListedInSchemaRaw(string $table): bool
    {
        $stmt = $this->pdo()->prepare(
            "SELECT 1
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = :table_name
             LIMIT 1"
        );
        $stmt->execute(['table_name' => $table]);

        return (bool) $stmt->fetchColumn();
    }

    private function tableListedInSchema(string $table): bool
    {
        return $this->tableListedInSchemaRaw($this->resolveTableName($table));
    }

    private function tableCanBeQueried(string $table): bool
    {
        $table = $this->resolveTableName($table);
        try {
            $this->pdo()->query(sprintf('SELECT 1 FROM `%s` LIMIT 1', $table))->fetch();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function tableExists(string $table): bool
    {
        if (!$this->canUsePdo()) {
            return false;
        }

        if (array_key_exists($table, $this->tableExistsCache)) {
            return $this->tableExistsCache[$table];
        }

        if (!$this->tableListedInSchema($table)) {
            return $this->tableExistsCache[$table] = false;
        }

        return $this->tableExistsCache[$table] = $this->tableCanBeQueried($table);
    }

    private function isRepairableWorkflowTableException(\Throwable $throwable, array $tables): bool
    {
        if (!$throwable instanceof \PDOException) {
            return false;
        }

        $message = strtolower($throwable->getMessage());
        $isMissingInEngine = str_contains($message, "doesn't exist in engine");
        $isMissingTable = str_contains($message, 'base table or view not found')
            || str_contains($message, 'sqlstate[42s02]')
            || str_contains($message, "doesn't exist");

        if (!$isMissingInEngine && !$isMissingTable) {
            return false;
        }

        foreach ($tables as $table) {
            $resolvedTable = strtolower($this->resolveTableName($table));
            if (str_contains($message, strtolower($table)) || str_contains($message, $resolvedTable)) {
                return true;
            }
        }

        return false;
    }

    private function isMissingOrBrokenTableException(\Throwable $throwable): bool
    {
        if (!$throwable instanceof \PDOException) {
            return false;
        }

        $message = strtolower($throwable->getMessage());

        return str_contains($message, "doesn't exist in engine")
            || str_contains($message, 'base table or view not found')
            || str_contains($message, 'sqlstate[42s02]')
            || str_contains($message, 'sqlstate[hy000]: general error: 1813');
    }

    private function resetInventoryWorkflowSchemaState(): void
    {
        $this->tableExistsCache = [];
        $this->columnExistsCache = [];
        $this->inventorySchemaEnsured = false;
    }

    private function rebuildInventoryWorkflowTables(array $tables): void
    {
        $this->resetInventoryWorkflowSchemaState();

        foreach ($tables as $table) {
            if (!$this->tableListedInSchema($table)) {
                continue;
            }

            $this->pdo()->exec(sprintf('DROP TABLE IF EXISTS `%s`', $this->resolveTableName($table)));
        }

        $this->resetInventoryWorkflowSchemaState();
        $this->ensureInventoryWorkflowSchema();
    }

    private function withInventoryWorkflowRepair(callable $callback)
    {
        $workflowTables = [
            'stock_opname_session_items',
            'stock_opname_sessions',
            'purchase_order_receiving_logs',
            'purchase_order_items',
        ];

        try {
            return $callback();
        } catch (\Throwable $throwable) {
            if (!$this->isRepairableWorkflowTableException($throwable, $workflowTables)) {
                throw $throwable;
            }

            $this->rebuildInventoryWorkflowTables($workflowTables);

            return $callback();
        }
    }

    private function columnExists(string $table, string $column): bool
    {
        if (!$this->tableExists($table)) {
            return false;
        }

        $cacheKey = $table . '.' . $column;
        if (array_key_exists($cacheKey, $this->columnExistsCache)) {
            return $this->columnExistsCache[$cacheKey];
        }

        $resolvedTable = $this->resolveTableName($table);
        $row = $this->dbOne(
            "SELECT 1
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = :table_name
               AND column_name = :column_name
             LIMIT 1",
            [
                'table_name' => $resolvedTable,
                'column_name' => $column,
            ]
        );

        return $this->columnExistsCache[$cacheKey] = $row !== null;
    }

    public function findUserByEmail(string $email, string $portal): ?array
    {
        if ($this->usingDb()) {
            return $this->dbOne(
                "SELECT u.id, u.name, u.email, u.password, u.portal, u.avatar, r.name AS role,
                        s.id AS staff_id, c.id AS customer_id
                 FROM users u
                 JOIN roles r ON r.id = u.role_id
                 LEFT JOIN staff s ON s.user_id = u.id AND s.deleted_at IS NULL
                 LEFT JOIN customers c ON c.user_id = u.id AND c.deleted_at IS NULL
                 WHERE LOWER(u.email) = LOWER(:email) AND u.portal = :portal AND u.is_active = 1
                 LIMIT 1",
                [
                    'email' => $email,
                    'portal' => $portal,
                ]
            );
        }

        foreach ($this->baseData['users'] as $user) {
            if (strcasecmp($user['email'], $email) === 0 && $user['portal'] === $portal) {
                return $user;
            }
        }

        return null;
    }

    public function findUserById(int $userId): ?array
    {
        if ($this->usingDb()) {
            return $this->dbOne(
                "SELECT u.id, u.name, u.email, u.password, u.portal, u.avatar, r.name AS role,
                        s.id AS staff_id, c.id AS customer_id
                 FROM users u
                 JOIN roles r ON r.id = u.role_id
                 LEFT JOIN staff s ON s.user_id = u.id AND s.deleted_at IS NULL
                 LEFT JOIN customers c ON c.user_id = u.id AND c.deleted_at IS NULL
                 WHERE u.id = :id AND u.is_active = 1
                 LIMIT 1",
                ['id' => $userId]
            );
        }

        foreach ($this->baseData['users'] as $user) {
            if ($user['id'] === $userId) {
                return $user;
            }
        }

        return null;
    }

    public function getPermissionsForUser(array $user): array
    {
        if ($this->usingDb()) {
            // Admin gets all permissions.
            if (($user['role'] ?? '') === 'admin') {
                $stmt = $this->pdo()->query('SELECT permission_key FROM permissions ORDER BY permission_key');

                return array_map(static fn (array $row): string => (string) $row['permission_key'], $stmt->fetchAll());
            }

            // Staff can be overridden by staff_permissions table; otherwise role_permissions.
            if (($user['role'] ?? '') === 'staff') {
                $stmt = $this->pdo()->prepare(
                    "SELECT sp.permission_key
                     FROM staff s
                     JOIN staff_permissions sp ON sp.staff_id = s.id
                     WHERE s.user_id = :user_id AND sp.granted = 1"
                );
                $stmt->execute(['user_id' => (int) ($user['id'] ?? 0)]);
                $overrides = $stmt->fetchAll();
                if ($overrides !== []) {
                    return array_values(array_unique(array_map(static fn (array $row): string => (string) $row['permission_key'], $overrides)));
                }
            }

            // Role-based permissions.
            $stmt = $this->pdo()->prepare(
                "SELECT p.permission_key
                 FROM users u
                 JOIN role_permissions rp ON rp.role_id = u.role_id
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE u.id = :user_id"
            );
            $stmt->execute(['user_id' => (int) ($user['id'] ?? 0)]);

            return array_map(static fn (array $row): string => (string) $row['permission_key'], $stmt->fetchAll());
        }

        if ($user['role'] === 'admin') {
            return $this->allPermissionKeys();
        }

        if ($user['role'] !== 'staff') {
            return $this->permissions['defaults'][$user['role']] ?? [];
        }

        $staffId = $user['staff_id'] ?? null;
        $defaults = $this->permissions['defaults']['staff'] ?? [];
        $overrides = $_SESSION['starstyle']['staff_permissions'][$staffId] ?? null;

        return array_values(array_unique(is_array($overrides) ? $overrides : $defaults));
    }

    public function getLandingData(): array
    {
        $services = $this->getServices();
        $transactions = $this->getTransactions();
        $bookings = $this->getBookings();
        $settings = $this->getSettings();

        return [
            'heroMetrics' => [
                ['label' => 'Booking aktif hari ini', 'value' => count(array_filter($bookings, fn (array $booking): bool => str_starts_with($booking['start_at'], date('Y-m-d')) && in_array($booking['status'], ['new', 'pending', 'confirmed', 'arrived', 'started'], true)))],
                ['label' => 'Transaksi minggu ini', 'value' => count($transactions)],
                ['label' => 'Layanan premium', 'value' => count(array_filter($services, fn (array $service): bool => $service['price'] >= 500000))],
            ],
            'featuredServices' => array_slice($services, 0, 4),
            'packages' => $this->getPackages(),
            'reviews' => $this->getReviews(),
            'business' => [
                'name' => $settings['business_name'] ?? $this->config['business']['name'],
                'city' => $this->config['business']['city'],
                'hotline' => $this->config['business']['hotline'],
                'email' => $this->config['business']['email'],
                'hours' => $settings['hours'] ?? $this->config['business']['hours'],
                'address' => $settings['address'] ?? $this->config['business']['address'],
            ],
        ];
    }

    public function getServices(): array
    {
        if ($this->usingDb()) {
            $services = $this->dbAll(
                "SELECT s.id, s.group_id, s.name, s.duration_minutes, s.base_price, s.status, s.description
                 FROM services s
                 WHERE s.deleted_at IS NULL
                 ORDER BY s.id"
            );
            $variantRows = $this->dbAll("SELECT service_id, variant_name FROM service_variants ORDER BY id");
            $skillRows = $this->dbAll("SELECT staff_id, service_id FROM staff_skills ORDER BY staff_id, service_id");

            $variantsByService = [];
            foreach ($variantRows as $row) {
                $variantsByService[(int) $row['service_id']][] = (string) $row['variant_name'];
            }

            $staffByService = [];
            foreach ($skillRows as $row) {
                $staffByService[(int) $row['service_id']][] = (int) $row['staff_id'];
            }

            return array_map(static function (array $service) use ($variantsByService, $staffByService): array {
                $serviceId = (int) $service['id'];

                return [
                    'id' => $serviceId,
                    'group_id' => (int) $service['group_id'],
                    'name' => (string) $service['name'],
                    'duration' => (int) $service['duration_minutes'],
                    'price' => (float) $service['base_price'],
                    'variants' => $variantsByService[$serviceId] ?? [],
                    'staff_ids' => $staffByService[$serviceId] ?? [],
                    'status' => (string) $service['status'],
                    'description' => (string) ($service['description'] ?? ''),
                ];
            }, $services);
        }

        return $this->baseData['services'];
    }

    public function getServiceGroups(): array
    {
        if ($this->usingDb()) {
            $stmt = $this->pdo()->query("SELECT id, name, description FROM service_groups ORDER BY id");

            return $stmt->fetchAll();
        }

        return $this->baseData['service_groups'];
    }

    public function getPackages(): array
    {
        if ($this->usingDb()) {
            $packages = $this->dbAll("SELECT id, name, package_price, description FROM service_packages ORDER BY id");
            $itemRows = $this->dbAll(
                "SELECT spi.package_id, s.name
                 FROM service_package_items spi
                 JOIN services s ON s.id = spi.service_id
                 ORDER BY spi.package_id, s.name"
            );
            $itemsByPackage = [];
            foreach ($itemRows as $row) {
                $itemsByPackage[(int) $row['package_id']][] = (string) $row['name'];
            }

            return array_map(static function (array $package) use ($itemsByPackage): array {
                return [
                    'id' => (int) $package['id'],
                    'name' => (string) $package['name'],
                    'items' => $itemsByPackage[(int) $package['id']] ?? [],
                    'price' => (float) $package['package_price'],
                    'description' => (string) ($package['description'] ?? ''),
                ];
            }, $packages);
        }

        return $this->baseData['packages'];
    }

    public function getStaff(): array
    {
        if ($this->usingDb()) {
            $staffRows = $this->dbAll(
                "SELECT s.id, s.user_id, s.location_id, s.name, s.email, s.phone, s.role_title, s.status,
                        s.commission_type, s.commission_value, s.rating, l.name AS location_name
                 FROM staff s
                 LEFT JOIN locations l ON l.id = s.location_id
                 WHERE s.deleted_at IS NULL
                 ORDER BY s.id"
            );
            $skillRows = $this->dbAll(
                "SELECT ss.staff_id, sv.name AS service_name
                 FROM staff_skills ss
                 JOIN services sv ON sv.id = ss.service_id
                 ORDER BY ss.staff_id, sv.name"
            );
            $specialtiesByStaff = [];
            foreach ($skillRows as $row) {
                $specialtiesByStaff[(int) $row['staff_id']][] = (string) $row['service_name'];
            }

            return array_map(static function (array $staff) use ($specialtiesByStaff): array {
                $staffId = (int) $staff['id'];

                return [
                    'id' => $staffId,
                    'user_id' => $staff['user_id'] !== null ? (int) $staff['user_id'] : null,
                    'name' => (string) $staff['name'],
                    'role' => (string) $staff['role_title'],
                    'email' => (string) ($staff['email'] ?? ''),
                    'phone' => (string) ($staff['phone'] ?? ''),
                    'status' => (string) $staff['status'],
                    'specialties' => $specialtiesByStaff[$staffId] ?? [],
                    'commission_type' => (string) $staff['commission_type'],
                    'commission_value' => (float) $staff['commission_value'],
                    'rating' => (float) $staff['rating'],
                    'location_name' => (string) ($staff['location_name'] ?: 'Star Salon'),
                ];
            }, $staffRows);
        }

        return $this->baseData['staff'];
    }

    public function getCustomers(): array
    {
        if ($this->usingDb()) {
            $rows = $this->dbAll(
                "SELECT id, user_id, member_id, name, gender, phone, email, loyalty_points, last_visit_at, tags, status, notes, address
                 FROM customers
                 WHERE deleted_at IS NULL
                 ORDER BY id"
            );

            return array_map(static function (array $customer): array {
                $tags = json_decode((string) ($customer['tags'] ?? '[]'), true);

                return [
                    'id' => (int) $customer['id'],
                    'user_id' => $customer['user_id'] !== null ? (int) $customer['user_id'] : null,
                    'name' => (string) $customer['name'],
                    'gender' => (string) ($customer['gender'] ?? ''),
                    'phone' => (string) ($customer['phone'] ?? ''),
                    'email' => (string) ($customer['email'] ?? ''),
                    'member_id' => (string) $customer['member_id'],
                    'loyalty_points' => (int) $customer['loyalty_points'],
                    'last_visit' => (string) ($customer['last_visit_at'] ?? ''),
                    'birthdate' => '',
                    'tags' => is_array($tags) ? array_values(array_map('strval', $tags)) : [],
                    'status' => (string) ($customer['status'] ?? 'Aktif'),
                    'notes' => (string) ($customer['notes'] ?? ''),
                    'address' => (string) ($customer['address'] ?? ''),
                ];
            }, $rows);
        }

        return $this->baseData['customers'];
    }

    public function getProducts(): array
    {
        if ($this->inventoryDbEnabled() && $this->tableExists('products')) {
            $hasSku = $this->columnExists('products', 'sku');
            $hasCode = $this->columnExists('products', 'code');
            $hasBrandName = $this->columnExists('products', 'brand');
            $hasCategoryName = $this->columnExists('products', 'category');
            $hasBrandId = $this->columnExists('products', 'brand_id') && $this->tableExists('brands');
            $hasCategoryId = $this->columnExists('products', 'category_id') && $this->tableExists('categories');
            $hasSupplierId = $this->columnExists('products', 'supplier_id') && $this->tableExists('suppliers');
            $hasSellPrice = $this->columnExists('products', 'sell_price');
            $hasSellingPrice = $this->columnExists('products', 'selling_price');
            $rows = $this->dbAll(
                'SELECT p.id, p.name, p.stock, p.status'
                . ($hasSku ? ', p.sku' : '')
                . ($hasCode ? ', p.code' : '')
                . ($hasBrandName ? ', p.brand AS brand_name' : '')
                . ($hasCategoryName ? ', p.category AS category_name' : '')
                . ($hasSellPrice ? ', p.sell_price' : '')
                . ($hasSellingPrice ? ', p.selling_price' : '')
                . ($hasBrandId ? ', b.name AS brand_name_lookup' : '')
                . ($hasCategoryId ? ', c.name AS category_name_lookup' : '')
                . ($hasSupplierId ? ', s.name AS supplier_name' : '')
                . ' FROM products p'
                . ($hasBrandId ? ' LEFT JOIN brands b ON b.id = p.brand_id' : '')
                . ($hasCategoryId ? ' LEFT JOIN categories c ON c.id = p.category_id' : '')
                . ($hasSupplierId ? ' LEFT JOIN suppliers s ON s.id = p.supplier_id' : '')
                . ' ORDER BY p.id'
            );

            return array_map(static function (array $product): array {
                $price = isset($product['sell_price'])
                    ? (float) $product['sell_price']
                    : (isset($product['selling_price']) ? (float) $product['selling_price'] : 0.0);
                $brand = (string) ($product['brand_name_lookup'] ?? $product['brand_name'] ?? '');
                $category = (string) ($product['category_name_lookup'] ?? $product['category_name'] ?? '');
                $sku = (string) ($product['sku'] ?? $product['code'] ?? '');

                return [
                    'id' => (int) $product['id'],
                    'name' => (string) $product['name'],
                    'brand' => $brand,
                    'category' => $category,
                    'supplier' => (string) ($product['supplier_name'] ?? ''),
                    'stock' => (int) $product['stock'],
                    'price' => $price,
                    'status' => (string) $product['status'],
                    'sku' => $sku,
                ];
            }, $rows);
        }

        return $this->baseData['products'];
    }

    public function getLocations(): array
    {
        if ($this->inventoryDbEnabled() && $this->tableExists('locations')) {
            $hasAddress = $this->columnExists('locations', 'address');
            $hasIsActive = $this->columnExists('locations', 'is_active');
            $rows = $this->dbAll(
                'SELECT id, name'
                . ($hasAddress ? ', address' : '')
                . ($hasIsActive ? ', is_active' : '')
                . ' FROM locations'
                . ($hasIsActive ? ' WHERE is_active = 1' : '')
                . ' ORDER BY id'
            );

            if ($rows !== []) {
                return array_map(static function (array $location) use ($hasAddress, $hasIsActive): array {
                    return [
                        'id' => (int) $location['id'],
                        'name' => (string) $location['name'],
                        'address' => $hasAddress ? (string) ($location['address'] ?? '') : '',
                        'is_active' => $hasIsActive ? (bool) ($location['is_active'] ?? true) : true,
                    ];
                }, $rows);
            }
        }

        return [[
            'id' => 1,
            'name' => 'Star Salon',
            'address' => (string) ($this->config['business']['address'] ?? ''),
            'is_active' => true,
        ]];
    }

    public function inventoryPayload(): array
    {
        if ($this->inventoryDbEnabled()) {
            $this->ensureInventoryWorkflowSchema();
            $this->ensureInventoryWorkflowSeedData();
        }

        $products = $this->getProducts();

        return [
            'products' => $products,
            'inventoryLocations' => $this->getLocations(),
            'inventoryBrands' => $this->getInventoryBrands(),
            'inventoryCategories' => $this->getInventoryCategories(),
            'inventorySuppliers' => $this->getInventorySuppliers(),
            'supplierMeta' => $this->inventorySupplierMeta(),
            'purchaseRows' => $this->inventoryPurchaseRows(),
            'opnameRows' => $this->inventoryOpnameRows(),
            'opnameDetailProducts' => $this->inventoryOpnameDetailProducts($products),
        ];
    }

    public function getVouchers(): array
    {
        if ($this->usingDb()) {
            $rows = $this->dbAll(
                "SELECT id, voucher_type, name, code, value, usage_limit, used_count, expired_at, status
                 FROM vouchers
                 ORDER BY id"
            );

            return array_map(static function (array $voucher): array {
                return [
                    'id' => (int) $voucher['id'],
                    'name' => (string) $voucher['name'],
                    'code' => (string) $voucher['code'],
                    'type' => (string) $voucher['voucher_type'],
                    'value' => (float) $voucher['value'],
                    'expired_at' => (string) $voucher['expired_at'],
                    'status' => (string) $voucher['status'],
                    'usage_limit' => (int) $voucher['usage_limit'],
                    'used' => (int) $voucher['used_count'],
                ];
            }, $rows);
        }

        return $this->baseData['vouchers'];
    }

    public function getClasses(): array
    {
        if ($this->usingDb()) {
            $classRows = $this->dbAll("SELECT id, staff_id, name, description FROM classes ORDER BY id");
            $sessionRows = $this->dbAll(
                "SELECT cs.class_id, cs.start_at, cs.total_slot, COUNT(cb.id) AS booked_count
                 FROM class_sessions cs
                 LEFT JOIN class_bookings cb ON cb.class_session_id = cs.id AND cb.status <> 'cancelled'
                 GROUP BY cs.id, cs.class_id, cs.start_at, cs.total_slot
                 ORDER BY cs.start_at"
            );
            $sessionByClass = [];
            foreach ($sessionRows as $row) {
                $classId = (int) $row['class_id'];
                if (!isset($sessionByClass[$classId])) {
                    $sessionByClass[$classId] = $row;
                }
            }

            return array_map(static function (array $class) use ($sessionByClass): array {
                $session = $sessionByClass[(int) $class['id']] ?? null;

                return [
                    'id' => (int) $class['id'],
                    'name' => (string) $class['name'],
                    'schedule' => (string) ($session['start_at'] ?? date('Y-m-d H:i:s')),
                    'slot' => (int) ($session['total_slot'] ?? 0),
                    'staff_id' => $class['staff_id'] !== null ? (int) $class['staff_id'] : null,
                    'booked' => (int) ($session['booked_count'] ?? 0),
                    'description' => (string) ($class['description'] ?? ''),
                ];
            }, $classRows);
        }

        return $this->baseData['classes'];
    }

    public function getReviews(): array
    {
        if ($this->usingDb()) {
            $rows = $this->dbAll(
                "SELECT c.name AS customer_name, r.rating, r.feedback, r.created_at
                 FROM reviews r
                 JOIN customers c ON c.id = r.customer_id
                 ORDER BY r.created_at DESC"
            );

            return array_map(static function (array $review): array {
                return [
                    'customer' => (string) $review['customer_name'],
                    'rating' => (int) $review['rating'],
                    'feedback' => (string) ($review['feedback'] ?? ''),
                    'date' => (string) $review['created_at'],
                ];
            }, $rows);
        }

        return $this->baseData['reviews'];
    }

    public function getLogs(): array
    {
        if ($this->usingDb()) {
            $rows = $this->dbAll(
                "SELECT actor_name, action_text, created_at
                 FROM activity_logs
                 ORDER BY created_at DESC"
            );

            return array_map(static function (array $log): array {
                return [
                    'time' => (string) $log['created_at'],
                    'actor' => (string) $log['actor_name'],
                    'action' => (string) $log['action_text'],
                ];
            }, $rows);
        }

        $logs = array_merge($this->baseData['activity_logs'], $_SESSION['starstyle']['activity_logs']);
        usort($logs, fn (array $a, array $b): int => strcmp($b['time'], $a['time']));

        return $logs;
    }

    public function getSettings(): array
    {
        if ($this->usingDb()) {
            $row = $this->dbOne(
                "SELECT business_name, business_hours, address, booking_advance_days, loyalty_ratio, currency, notification_channel
                 FROM business_settings
                 ORDER BY id ASC
                 LIMIT 1"
            );

            return [
                'business_name' => (string) ($row['business_name'] ?? $this->config['business']['name']),
                'hours' => (string) ($row['business_hours'] ?? $this->config['business']['hours']),
                'address' => (string) ($row['address'] ?? $this->config['business']['address']),
                'booking_advance_days' => (int) ($row['booking_advance_days'] ?? 30),
                'loyalty_ratio' => (int) ($row['loyalty_ratio'] ?? 10000),
                'currency' => (string) ($row['currency'] ?? 'IDR'),
                'notification_channel' => (string) ($row['notification_channel'] ?? ''),
            ];
        }

        return $this->baseData['settings'];
    }

    public function getNotifications(): array
    {
        if ($this->usingDb()) {
            return $this->dbAll(
                "SELECT title, type, created_at
                 FROM notifications
                 ORDER BY created_at DESC"
            );
        }

        return $this->baseData['notifications'];
    }

    public function getAttendance(): array
    {
        if ($this->usingDb()) {
            $this->ensureStaffScheduleSchema();
            $this->ensureStaffScheduleSeedData();

            $rows = $this->dbAll(
                "SELECT staff_id, attendance_date, shift_start, shift_end, clock_in, clock_out, source, status, selfie_in_score, selfie_out_score
                 FROM staff_attendance
                 ORDER BY attendance_date DESC, id DESC"
            );
            $latestByStaff = [];
            foreach ($rows as $row) {
                $staffId = (int) $row['staff_id'];
                if (!isset($latestByStaff[$staffId])) {
                    $latestByStaff[$staffId] = [
                        'staff_id' => $staffId,
                        'date' => (string) $row['attendance_date'],
                        'shift_start' => substr((string) $row['shift_start'], 0, 5),
                        'shift_end' => substr((string) $row['shift_end'], 0, 5),
                        'clock_in' => substr((string) $row['clock_in'], 0, 5),
                        'clock_out' => substr((string) $row['clock_out'], 0, 5),
                        'source' => (string) ($row['source'] ?? '-'),
                        'status' => (string) ($row['status'] ?? 'Ontime'),
                        'selfie_in_score' => (float) ($row['selfie_in_score'] ?? 0),
                        'selfie_out_score' => (float) ($row['selfie_out_score'] ?? 0),
                    ];
                }
            }

            return array_values($latestByStaff);
        }

        return $this->baseData['attendance'];
    }

    public function getShifts(): array
    {
        if ($this->usingDb()) {
            $this->ensureStaffScheduleSchema();
            $this->ensureStaffScheduleSeedData();

            return array_map(static function (array $row): array {
                return [
                    'id' => (int) $row['id'],
                    'staff_id' => (int) $row['staff_id'],
                    'date' => (string) $row['shift_date'],
                    'start' => substr((string) $row['start_time'], 0, 5),
                    'end' => substr((string) $row['end_time'], 0, 5),
                    'repeat_mode' => (string) ($row['repeat_mode'] ?? 'none'),
                ];
            }, $this->dbAll(
                "SELECT id, staff_id, shift_date, start_time, end_time, repeat_mode
                 FROM staff_shifts
                 ORDER BY shift_date ASC, staff_id ASC, id ASC"
            ));
        }

        return $this->baseData['shifts'];
    }

    public function getBookings(): array
    {
        if ($this->usingDb()) {
            $bookingRows = $this->dbAll(
                "SELECT id, location_id, customer_id, staff_id, reference, channel, start_at, end_at, status, notes
                 FROM bookings
                 ORDER BY start_at ASC"
            );
            $itemRows = $this->dbAll(
                "SELECT booking_id, service_id, duration_minutes, price
                 FROM booking_items
                 ORDER BY booking_id, id"
            );
            $itemsByBooking = [];
            foreach ($itemRows as $row) {
                $bookingId = (int) $row['booking_id'];
                $itemsByBooking[$bookingId][] = [
                    'service_id' => (int) $row['service_id'],
                    'duration' => (int) $row['duration_minutes'],
                    'price' => (float) $row['price'],
                ];
            }

            return array_map(static function (array $booking) use ($itemsByBooking): array {
                $bookingId = (int) $booking['id'];
                $cursor = new \DateTimeImmutable((string) $booking['start_at']);
                $serviceItems = [];
                $serviceIds = [];
                foreach ($itemsByBooking[$bookingId] ?? [] as $item) {
                    $serviceStart = $cursor;
                    $serviceEnd = $serviceStart->modify('+' . $item['duration'] . ' minutes');
                    $serviceItems[] = [
                        'service_id' => $item['service_id'],
                        'staff_id' => (int) $booking['staff_id'],
                        'start_at' => $serviceStart->format('Y-m-d H:i:s'),
                        'end_at' => $serviceEnd->format('Y-m-d H:i:s'),
                        'duration' => $item['duration'],
                        'price' => $item['price'],
                    ];
                    $serviceIds[] = $item['service_id'];
                    $cursor = $serviceEnd;
                }

                return [
                    'id' => $bookingId,
                    'reference' => (string) $booking['reference'],
                    'customer_id' => (int) $booking['customer_id'],
                    'staff_id' => (int) $booking['staff_id'],
                    'service_ids' => $serviceIds,
                    'service_items' => $serviceItems,
                    'start_at' => (string) $booking['start_at'],
                    'end_at' => (string) $booking['end_at'],
                    'status' => (string) $booking['status'],
                    'channel' => (string) ($booking['channel'] ?? ''),
                    'notes' => (string) ($booking['notes'] ?? ''),
                ];
            }, $bookingRows);
        }

        $bookings = array_merge($this->baseData['bookings'], $_SESSION['starstyle']['bookings']);
        usort($bookings, fn (array $a, array $b): int => strcmp($a['start_at'], $b['start_at']));

        return $bookings;
    }

    public function getBlocks(): array
    {
        if ($this->usingDb()) {
            return array_map(static function (array $block): array {
                return [
                    'id' => (int) $block['id'],
                    'staff_id' => (int) $block['staff_id'],
                    'title' => (string) $block['title'],
                    'start_at' => (string) $block['start_at'],
                    'end_at' => (string) $block['end_at'],
                    'description' => (string) ($block['description'] ?? ''),
                ];
            }, $this->dbAll(
                "SELECT id, staff_id, title, start_at, end_at, description
                 FROM booking_blocks
                 ORDER BY start_at ASC"
            ));
        }

        return array_merge($this->baseData['booking_blocks'], $_SESSION['starstyle']['booking_blocks']);
    }

    public function getTransactions(): array
    {
        if ($this->usingDb()) {
            $transactionRows = $this->dbAll(
                "SELECT id, booking_id, customer_id, staff_id, reference, payment_method, status,
                        discount_amount, rounding_amount, paid_at
                 FROM transactions
                 ORDER BY paid_at DESC"
            );
            $itemRows = $this->dbAll(
                "SELECT transaction_id, item_type, item_name, quantity, price
                 FROM transaction_items
                 ORDER BY transaction_id, id"
            );
            $itemsByTransaction = [];
            foreach ($itemRows as $row) {
                $itemsByTransaction[(int) $row['transaction_id']][] = [
                    'type' => (string) $row['item_type'],
                    'name' => (string) $row['item_name'],
                    'qty' => (int) $row['quantity'],
                    'price' => (float) $row['price'],
                ];
            }

            return array_map(static function (array $transaction) use ($itemsByTransaction): array {
                return [
                    'id' => (int) $transaction['id'],
                    'reference' => (string) $transaction['reference'],
                    'booking_id' => $transaction['booking_id'] !== null ? (int) $transaction['booking_id'] : null,
                    'customer_id' => (int) $transaction['customer_id'],
                    'staff_id' => (int) $transaction['staff_id'],
                    'date' => (string) $transaction['paid_at'],
                    'items' => $itemsByTransaction[(int) $transaction['id']] ?? [],
                    'discount' => (float) $transaction['discount_amount'],
                    'rounding' => (float) $transaction['rounding_amount'],
                    'status' => (string) $transaction['status'],
                    'payment_method' => (string) $transaction['payment_method'],
                ];
            }, $transactionRows);
        }

        $transactions = array_merge($this->baseData['transactions'], $_SESSION['starstyle']['transactions']);
        usort($transactions, fn (array $a, array $b): int => strcmp($b['date'], $a['date']));

        return $transactions;
    }

    public function dashboard(string $range = '7d'): array
    {
        $days = match ($range) {
            '30d' => 30,
            '90d' => 90,
            default => 7,
        };

        $start = new \DateTimeImmutable("-{$days} days");
        $transactions = array_filter($this->getTransactions(), fn (array $transaction): bool => new \DateTimeImmutable($transaction['date']) >= $start);
        $bookings = array_filter($this->getBookings(), fn (array $booking): bool => new \DateTimeImmutable($booking['start_at']) >= $start);

        $salesTotal = array_reduce($transactions, function (float $carry, array $transaction): float {
            $items = array_reduce($transaction['items'], fn (float $sum, array $item): float => $sum + ($item['qty'] * $item['price']), 0.0);

            return $carry + $items - $transaction['discount'] + $transaction['rounding'];
        }, 0.0);

        $agendaValue = array_reduce($bookings, function (float $carry, array $booking): float {
            $serviceTotal = array_reduce($booking['service_ids'], function (float $sum, int $serviceId): float {
                $service = $this->findService($serviceId);

                return $sum + ($service['price'] ?? 0);
            }, 0.0);

            return $carry + $serviceTotal;
        }, 0.0);

        $dailySales = [];
        $dailyAgenda = [];

        for ($index = $days - 1; $index >= 0; $index--) {
            $date = (new \DateTimeImmutable("-{$index} days"))->format('Y-m-d');
            $dailySales[$date] = 0;
            $dailyAgenda[$date] = 0;
        }

        foreach ($transactions as $transaction) {
            $date = substr($transaction['date'], 0, 10);
            $dailySales[$date] = ($dailySales[$date] ?? 0) + array_reduce($transaction['items'], fn (float $sum, array $item): float => $sum + ($item['qty'] * $item['price']), 0.0);
        }

        foreach ($bookings as $booking) {
            $date = substr($booking['start_at'], 0, 10);
            $dailyAgenda[$date] = ($dailyAgenda[$date] ?? 0) + 1;
        }

        $topClasses = array_map(fn (array $class): array => ['label' => $class['name'], 'value' => $class['booked']], $this->getClasses());

        return [
            'cards' => [
                'sales_total' => $salesTotal,
                'agenda_value' => $agendaValue,
                'confirmed' => count(array_filter($bookings, fn (array $booking): bool => $booking['status'] === 'confirmed')),
                'cancelled' => count(array_filter($bookings, fn (array $booking): bool => $booking['status'] === 'cancelled')),
            ],
            'chart' => [
                'labels' => array_keys($dailySales),
                'sales' => array_values($dailySales),
                'agenda' => array_values($dailyAgenda),
            ],
            'upcoming' => array_slice(array_values(array_filter($bookings, fn (array $booking): bool => in_array($booking['status'], ['new', 'pending', 'confirmed', 'arrived', 'started'], true))), 0, 5),
            'recent' => array_slice(array_reverse($this->getBookings()), 0, 5),
            'top' => [
                'services' => array_slice($this->rankItems('service'), 0, 5),
                'products' => array_slice($this->rankItems('product'), 0, 5),
                'classes' => array_slice($topClasses, 0, 5),
                'staff' => array_slice($this->rankStaff(), 0, 5),
            ],
        ];
    }

    public function calendar(?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');

        return [
            'date' => $date,
            'staff' => $this->getStaff(),
            'events' => array_values(array_filter($this->getBookings(), fn (array $booking): bool => str_starts_with($booking['start_at'], $date) && in_array($booking['status'], ['new', 'pending', 'confirmed', 'arrived', 'started', 'completed'], true))),
            'blocks' => array_values(array_filter($this->getBlocks(), fn (array $block): bool => str_starts_with($block['start_at'], $date))),
            'now' => date('Y-m-d') === $date ? date('H:i') : null,
        ];
    }

    public function availability(array $serviceIds, int $staffId, string $date): array
    {
        $totalDuration = array_reduce($serviceIds, function (int $carry, int $serviceId): int {
            $service = $this->findService($serviceId);

            return $carry + (int) ($service['duration'] ?? 0);
        }, 0);

        $bookings = array_filter($this->getBookings(), fn (array $booking): bool => $booking['staff_id'] === $staffId && str_starts_with($booking['start_at'], $date) && in_array($booking['status'], ['awaiting_payment', 'new', 'pending', 'confirmed', 'arrived', 'started'], true));
        $blocks = array_filter($this->getBlocks(), fn (array $block): bool => $block['staff_id'] === $staffId && str_starts_with($block['start_at'], $date));

        $slots = [];

        for ($hour = 9; $hour < 20; $hour++) {
            foreach ([0, 15, 30, 45] as $minute) {
                $start = new \DateTimeImmutable(sprintf('%s %02d:%02d:00', $date, $hour, $minute));
                $end = $start->modify("+{$totalDuration} minutes");

                if ((int) $end->format('H') >= 21 && (int) $end->format('i') > 0) {
                    continue;
                }

                $slots[] = [
                    'time' => $start->format('H:i'),
                    'available' => !$this->hasOverlap($start, $end, $bookings, $blocks),
                ];
            }
        }

        return $slots;
    }

    public function createBooking(array $payload, string $source = 'customer'): array
    {
        $serviceIds = array_map('intval', $payload['service_ids'] ?? []);
        $serviceStartTimes = array_values($payload['service_start_times'] ?? []);
        $serviceDurations = array_values($payload['service_durations'] ?? []);
        $serviceStaffIds = array_values($payload['service_staff_ids'] ?? []);
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $date = trim((string) ($payload['date'] ?? ''));
        $time = trim((string) ($payload['time'] ?? ''));
        $customerName = trim((string) ($payload['customer_name'] ?? ''));
        $customerPhone = trim((string) ($payload['customer_phone'] ?? ''));

        if ($serviceIds === [] || $staffId === 0 || $date === '' || $time === '' || $customerName === '') {
            return ['success' => false, 'message' => 'Mohon lengkapi layanan, staff, tanggal, dan data pelanggan.'];
        }

        $duration = array_reduce($serviceIds, fn (int $carry, int $serviceId): int => $carry + ((int) ($this->findService($serviceId)['duration'] ?? 0)), 0);
        $start = new \DateTimeImmutable("{$date} {$time}:00");
        $end = $start->modify("+{$duration} minutes");
        $dailyBookings = array_filter($this->getBookings(), fn (array $booking): bool => $booking['staff_id'] === $staffId && str_starts_with($booking['start_at'], $date) && in_array($booking['status'], ['awaiting_payment', 'new', 'pending', 'confirmed', 'arrived', 'started'], true));
        $blocks = array_filter($this->getBlocks(), fn (array $block): bool => $block['staff_id'] === $staffId && str_starts_with($block['start_at'], $date));

        if ($this->hasOverlap($start, $end, $dailyBookings, $blocks)) {
            return ['success' => false, 'message' => 'Slot bentrok dengan booking lain atau blocked time.'];
        }

        $serviceItems = [];
        $serviceCursor = $start;
        foreach ($serviceIds as $index => $serviceId) {
            $service = $this->findService($serviceId);
            $serviceDuration = max(5, (int) ($serviceDurations[$index] ?? $service['duration'] ?? 60));
            $serviceStartTime = trim((string) ($serviceStartTimes[$index] ?? ''));
            $serviceStaffId = (int) ($serviceStaffIds[$index] ?? $staffId);
            $serviceStaffId = $serviceStaffId > 0 ? $serviceStaffId : $staffId;
            $serviceStart = $serviceStartTime !== ''
                ? new \DateTimeImmutable("{$date} {$serviceStartTime}:00")
                : $serviceCursor;
            $serviceEnd = $serviceStart->modify("+{$serviceDuration} minutes");

            $serviceItems[] = [
                'service_id' => $serviceId,
                'staff_id' => $serviceStaffId,
                'start_at' => $serviceStart->format('Y-m-d H:i:s'),
                'end_at' => $serviceEnd->format('Y-m-d H:i:s'),
                'duration' => $serviceDuration,
            ];

            if ($serviceStartTime === '') {
                $serviceCursor = $serviceEnd;
            }
        }

        $customerId = $this->resolveCustomer($customerName, $customerPhone);

        if ($this->usingDb()) {
            $reference = 'BK-' . date('ymdHis');
            $notes = trim((string) ($payload['notes'] ?? ''));
            $channel = $source === 'customer' ? 'Portal Customer' : 'Internal';
            $initialStatus = $source === 'customer' ? 'awaiting_payment' : 'new';

            $this->pdo()->beginTransaction();
            try {
                $this->dbExecute(
                    "INSERT INTO bookings (location_id, customer_id, staff_id, reference, channel, start_at, end_at, status, notes)
                     VALUES (NULL, :customer_id, :staff_id, :reference, :channel, :start_at, :end_at, :status, :notes)",
                    [
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'reference' => $reference,
                        'channel' => $channel,
                        'start_at' => $start->format('Y-m-d H:i:s'),
                        'end_at' => $end->format('Y-m-d H:i:s'),
                        'status' => $initialStatus,
                        'notes' => $notes !== '' ? $notes : null,
                    ]
                );
                $bookingId = (int) $this->pdo()->lastInsertId();

                foreach ($serviceItems as $item) {
                    $this->dbExecute(
                        "INSERT INTO booking_items (booking_id, service_id, duration_minutes, price)
                         VALUES (:booking_id, :service_id, :duration, :price)",
                        [
                            'booking_id' => $bookingId,
                            'service_id' => (int) $item['service_id'],
                            'duration' => (int) $item['duration'],
                            'price' => (float) ($this->findService((int) $item['service_id'])['price'] ?? 0),
                        ]
                    );
                }

                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (NULL, :actor_name, :action_text, NOW())",
                    [
                        'actor_name' => $source === 'customer' ? $customerName : 'Admin',
                        'action_text' => 'Membuat booking ' . $reference,
                    ]
                );

                $this->pdo()->commit();

                return [
                    'success' => true,
                    'message' => $source === 'customer' ? 'Booking berhasil dibuat. Lanjutkan ke pembayaran untuk mengaktifkan jadwal.' : 'Booking berhasil dibuat.',
                    'booking' => [
                        'id' => $bookingId,
                        'reference' => $reference,
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'service_ids' => $serviceIds,
                        'service_items' => $serviceItems,
                        'start_at' => $start->format('Y-m-d H:i:s'),
                        'end_at' => $end->format('Y-m-d H:i:s'),
                        'status' => $initialStatus,
                        'channel' => $channel,
                        'notes' => $notes,
                    ],
                ];
            } catch (\Throwable $throwable) {
                $this->pdo()->rollBack();

                return ['success' => false, 'message' => 'Gagal menyimpan booking ke database: ' . $throwable->getMessage()];
            }
        }

        $id = $this->nextId($_SESSION['starstyle']['bookings'], 9000);
        $booking = [
            'id' => $id,
            'reference' => 'BK-' . date('ymd') . '-' . $id,
            'customer_id' => $customerId,
            'staff_id' => $staffId,
            'service_ids' => $serviceIds,
            'service_items' => $serviceItems,
            'start_at' => $start->format('Y-m-d H:i:s'),
            'end_at' => $end->format('Y-m-d H:i:s'),
            'status' => $source === 'customer' ? 'awaiting_payment' : 'new',
            'channel' => $source === 'customer' ? 'Portal Customer' : 'Internal',
            'notes' => trim((string) ($payload['notes'] ?? '')),
        ];

        $_SESSION['starstyle']['bookings'][] = $booking;
        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $source === 'customer' ? $customerName : 'Admin',
            'action' => 'Membuat booking ' . $booking['reference'],
        ];

        return ['success' => true, 'message' => $source === 'customer' ? 'Booking berhasil dibuat. Lanjutkan ke pembayaran untuk mengaktifkan jadwal.' : 'Booking berhasil dibuat.', 'booking' => $booking];
    }

    public function updateBooking(array $payload, array $actor): array
    {
        $bookingId = (int) ($payload['booking_id'] ?? 0);
        $booking = $this->findBooking($bookingId);

        if ($booking === null) {
            return ['success' => false, 'message' => 'Booking yang ingin diubah tidak ditemukan.'];
        }

        $serviceIds = array_map('intval', $payload['service_ids'] ?? []);
        $serviceStartTimes = array_values($payload['service_start_times'] ?? []);
        $serviceDurations = array_values($payload['service_durations'] ?? []);
        $serviceStaffIds = array_values($payload['service_staff_ids'] ?? []);
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $date = trim((string) ($payload['date'] ?? ''));
        $time = trim((string) ($payload['time'] ?? ''));
        $customerName = trim((string) ($payload['customer_name'] ?? ''));
        $customerPhone = trim((string) ($payload['customer_phone'] ?? ''));
        $notes = trim((string) ($payload['notes'] ?? ''));

        if ($serviceIds === [] || $staffId === 0 || $date === '' || $time === '' || $customerName === '') {
            return ['success' => false, 'message' => 'Mohon lengkapi layanan, staff, tanggal, dan data pelanggan.'];
        }

        $start = new \DateTimeImmutable("{$date} {$time}:00");
        $serviceCursor = $start;
        $serviceItems = [];
        $end = $start;

        foreach ($serviceIds as $index => $serviceId) {
            $service = $this->findService($serviceId);
            $serviceDuration = max(5, (int) ($serviceDurations[$index] ?? $service['duration'] ?? 60));
            $serviceStartTime = trim((string) ($serviceStartTimes[$index] ?? ''));
            $serviceStaffId = (int) ($serviceStaffIds[$index] ?? $staffId);
            $serviceStaffId = $serviceStaffId > 0 ? $serviceStaffId : $staffId;
            $serviceStart = $serviceStartTime !== ''
                ? new \DateTimeImmutable("{$date} {$serviceStartTime}:00")
                : $serviceCursor;
            $serviceEnd = $serviceStart->modify("+{$serviceDuration} minutes");

            $serviceItems[] = [
                'service_id' => $serviceId,
                'staff_id' => $serviceStaffId,
                'start_at' => $serviceStart->format('Y-m-d H:i:s'),
                'end_at' => $serviceEnd->format('Y-m-d H:i:s'),
                'duration' => $serviceDuration,
                'price' => (float) ($service['price'] ?? 0),
            ];

            if ($serviceStartTime === '') {
                $serviceCursor = $serviceEnd;
            }

            if ($serviceEnd > $end) {
                $end = $serviceEnd;
            }
        }

        $dailyBookings = array_filter(
            $this->getBookings(),
            fn (array $candidate): bool => (int) ($candidate['id'] ?? 0) !== $bookingId
                && $candidate['staff_id'] === $staffId
                && str_starts_with($candidate['start_at'], $date)
                && in_array($candidate['status'], ['awaiting_payment', 'new', 'pending', 'confirmed', 'arrived', 'started'], true)
        );
        $blocks = array_filter($this->getBlocks(), fn (array $block): bool => $block['staff_id'] === $staffId && str_starts_with($block['start_at'], $date));

        if ($this->hasOverlap($start, $end, $dailyBookings, $blocks)) {
            return ['success' => false, 'message' => 'Slot bentrok dengan booking lain atau blocked time.'];
        }

        $customerId = $this->resolveCustomer($customerName, $customerPhone);

        if ($this->usingDb()) {
            $this->pdo()->beginTransaction();
            try {
                $this->dbExecute(
                    "UPDATE bookings
                     SET customer_id = :customer_id,
                         staff_id = :staff_id,
                         start_at = :start_at,
                         end_at = :end_at,
                         notes = :notes
                     WHERE id = :id",
                    [
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'start_at' => $start->format('Y-m-d H:i:s'),
                        'end_at' => $end->format('Y-m-d H:i:s'),
                        'notes' => $notes !== '' ? $notes : null,
                        'id' => $bookingId,
                    ]
                );

                $this->dbExecute("DELETE FROM booking_items WHERE booking_id = :booking_id", [
                    'booking_id' => $bookingId,
                ]);

                foreach ($serviceItems as $item) {
                    $this->dbExecute(
                        "INSERT INTO booking_items (booking_id, service_id, duration_minutes, price)
                         VALUES (:booking_id, :service_id, :duration, :price)",
                        [
                            'booking_id' => $bookingId,
                            'service_id' => (int) $item['service_id'],
                            'duration' => (int) $item['duration'],
                            'price' => (float) $item['price'],
                        ]
                    );
                }

                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'] ?? 'Admin',
                        'action_text' => 'Mengubah booking ' . (string) ($booking['reference'] ?? $bookingId),
                    ]
                );

                $this->pdo()->commit();
            } catch (\Throwable $throwable) {
                $this->pdo()->rollBack();

                return ['success' => false, 'message' => 'Gagal memperbarui booking: ' . $throwable->getMessage()];
            }
        } else {
            foreach ($_SESSION['starstyle']['bookings'] as &$sessionBooking) {
                if ((int) ($sessionBooking['id'] ?? 0) !== $bookingId) {
                    continue;
                }

                $sessionBooking['customer_id'] = $customerId;
                $sessionBooking['staff_id'] = $staffId;
                $sessionBooking['service_ids'] = $serviceIds;
                $sessionBooking['service_items'] = $serviceItems;
                $sessionBooking['start_at'] = $start->format('Y-m-d H:i:s');
                $sessionBooking['end_at'] = $end->format('Y-m-d H:i:s');
                $sessionBooking['notes'] = $notes;
                break;
            }
            unset($sessionBooking);

            $_SESSION['starstyle']['activity_logs'][] = [
                'time' => date('Y-m-d H:i:s'),
                'actor' => $actor['name'] ?? 'Admin',
                'action' => 'Mengubah booking ' . (string) ($booking['reference'] ?? $bookingId),
            ];
        }

        return ['success' => true, 'message' => 'Agenda berhasil diperbarui.'];
    }

    public function updateBookingStatus(int $bookingId, string $status, array $actor): array
    {
        $booking = $this->findBooking($bookingId);
        if ($booking === null) {
            return ['success' => false, 'message' => 'Booking tidak ditemukan.'];
        }

        $normalizedStatus = strtolower(trim($status));
        $allowedStatuses = ['new', 'confirmed', 'arrived', 'started', 'completed', 'cancelled', 'no_show'];
        if (!in_array($normalizedStatus, $allowedStatuses, true)) {
            return ['success' => false, 'message' => 'Status booking tidak valid.'];
        }

        if ($this->usingDb()) {
            try {
                $this->dbExecute(
                    "UPDATE bookings SET status = :status WHERE id = :id",
                    [
                        'status' => $normalizedStatus,
                        'id' => $bookingId,
                    ]
                );

                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'] ?? 'Admin',
                        'action_text' => 'Mengubah status booking ' . (string) ($booking['reference'] ?? $bookingId) . ' menjadi ' . strtoupper($normalizedStatus),
                    ]
                );
            } catch (\Throwable $throwable) {
                return ['success' => false, 'message' => 'Gagal memperbarui status booking: ' . $throwable->getMessage()];
            }
        } else {
            foreach ($_SESSION['starstyle']['bookings'] as &$sessionBooking) {
                if ((int) ($sessionBooking['id'] ?? 0) !== $bookingId) {
                    continue;
                }

                $sessionBooking['status'] = $normalizedStatus;
                break;
            }
            unset($sessionBooking);

            $_SESSION['starstyle']['activity_logs'][] = [
                'time' => date('Y-m-d H:i:s'),
                'actor' => $actor['name'] ?? 'Admin',
                'action' => 'Mengubah status booking ' . (string) ($booking['reference'] ?? $bookingId) . ' menjadi ' . strtoupper($normalizedStatus),
            ];
        }

        return [
            'success' => true,
            'message' => 'Status agenda berhasil diperbarui.',
            'status' => $normalizedStatus,
        ];
    }

    public function createBlock(array $payload, array $actor): array
    {
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $date = trim((string) ($payload['date'] ?? ''));
        $startTime = trim((string) ($payload['start_time'] ?? ''));
        $endTime = trim((string) ($payload['end_time'] ?? ''));
        $title = trim((string) ($payload['title'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));

        if ($staffId === 0 || $date === '' || $startTime === '' || $endTime === '' || $title === '' || $description === '') {
            return ['success' => false, 'message' => 'Mohon lengkapi staff, tanggal, jam mulai, jam selesai, dan deskripsi blokir waktu.'];
        }

        $start = new \DateTimeImmutable("{$date} {$startTime}:00");
        $end = new \DateTimeImmutable("{$date} {$endTime}:00");

        if ($end <= $start) {
            return ['success' => false, 'message' => 'Jam selesai harus lebih besar daripada jam mulai.'];
        }

        $dailyBookings = array_filter($this->getBookings(), fn (array $booking): bool => $booking['staff_id'] === $staffId && str_starts_with($booking['start_at'], $date) && in_array($booking['status'], ['awaiting_payment', 'new', 'pending', 'confirmed', 'arrived', 'started'], true));
        $dailyBlocks = array_filter($this->getBlocks(), fn (array $block): bool => $block['staff_id'] === $staffId && str_starts_with($block['start_at'], $date));

        if ($this->hasOverlap($start, $end, $dailyBookings, $dailyBlocks)) {
            return ['success' => false, 'message' => 'Block time bentrok dengan booking atau block time lain.'];
        }

        if ($this->usingDb()) {
            try {
                $this->dbExecute(
                    "INSERT INTO booking_blocks (location_id, staff_id, title, start_at, end_at, description)
                     VALUES (NULL, :staff_id, :title, :start_at, :end_at, :description)",
                    [
                        'staff_id' => $staffId,
                        'title' => $title,
                        'start_at' => $start->format('Y-m-d H:i:s'),
                        'end_at' => $end->format('Y-m-d H:i:s'),
                        'description' => $description !== '' ? $description : null,
                    ]
                );
                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'],
                        'action_text' => 'Membuat block time untuk staff ID #' . $staffId,
                    ]
                );
            } catch (\Throwable $throwable) {
                return ['success' => false, 'message' => 'Gagal menyimpan block time ke database: ' . $throwable->getMessage()];
            }

            return [
                'success' => true,
                'message' => 'Block time berhasil dibuat.',
                'block' => [
                    'staff_id' => $staffId,
                    'title' => $title,
                    'start_at' => $start->format('Y-m-d H:i:s'),
                    'end_at' => $end->format('Y-m-d H:i:s'),
                    'description' => $description,
                ],
            ];
        }

        $id = $this->nextId($_SESSION['starstyle']['booking_blocks'], 7000);
        $block = [
            'id' => $id,
            'staff_id' => $staffId,
            'title' => $title,
            'start_at' => $start->format('Y-m-d H:i:s'),
            'end_at' => $end->format('Y-m-d H:i:s'),
            'description' => $description,
        ];

        $_SESSION['starstyle']['booking_blocks'][] = $block;
        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $actor['name'],
            'action' => 'Membuat block time untuk staff ID #' . $staffId,
        ];

        return ['success' => true, 'message' => 'Block time berhasil dibuat.', 'block' => $block];
    }

    public function updateBlock(array $payload, array $actor): array
    {
        $blockId = (int) ($payload['block_id'] ?? 0);
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $date = trim((string) ($payload['date'] ?? ''));
        $startTime = trim((string) ($payload['start_time'] ?? ''));
        $endTime = trim((string) ($payload['end_time'] ?? ''));
        $title = trim((string) ($payload['title'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));

        if ($blockId === 0 || $staffId === 0 || $date === '' || $startTime === '' || $endTime === '' || $title === '' || $description === '') {
            return ['success' => false, 'message' => 'Mohon lengkapi staff, tanggal, jam mulai, jam selesai, dan deskripsi blokir waktu.'];
        }

        $start = new \DateTimeImmutable("{$date} {$startTime}:00");
        $end = new \DateTimeImmutable("{$date} {$endTime}:00");

        if ($end <= $start) {
            return ['success' => false, 'message' => 'Jam selesai harus lebih besar daripada jam mulai.'];
        }

        $dailyBookings = array_filter($this->getBookings(), fn (array $booking): bool => $booking['staff_id'] === $staffId && str_starts_with($booking['start_at'], $date) && in_array($booking['status'], ['awaiting_payment', 'new', 'pending', 'confirmed', 'arrived', 'started'], true));
        $dailyBlocks = array_filter(
            $this->getBlocks(),
            fn (array $block): bool => (int) $block['id'] !== $blockId && $block['staff_id'] === $staffId && str_starts_with($block['start_at'], $date)
        );

        if ($this->hasOverlap($start, $end, $dailyBookings, $dailyBlocks)) {
            return ['success' => false, 'message' => 'Block time bentrok dengan booking atau block time lain.'];
        }

        if ($this->usingDb()) {
            try {
                $this->dbExecute(
                    "UPDATE booking_blocks
                     SET staff_id = :staff_id,
                         title = :title,
                         start_at = :start_at,
                         end_at = :end_at,
                         description = :description
                     WHERE id = :id",
                    [
                        'id' => $blockId,
                        'staff_id' => $staffId,
                        'title' => $title,
                        'start_at' => $start->format('Y-m-d H:i:s'),
                        'end_at' => $end->format('Y-m-d H:i:s'),
                        'description' => $description,
                    ]
                );
                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'],
                        'action_text' => 'Mengubah block time #' . $blockId,
                    ]
                );
            } catch (\Throwable $throwable) {
                return ['success' => false, 'message' => 'Gagal mengubah block time: ' . $throwable->getMessage()];
            }

            return ['success' => true, 'message' => 'Block time berhasil diperbarui.'];
        }

        foreach ($_SESSION['starstyle']['booking_blocks'] as &$block) {
            if ((int) ($block['id'] ?? 0) !== $blockId) {
                continue;
            }

            $block['staff_id'] = $staffId;
            $block['title'] = $title;
            $block['start_at'] = $start->format('Y-m-d H:i:s');
            $block['end_at'] = $end->format('Y-m-d H:i:s');
            $block['description'] = $description;
            break;
        }
        unset($block);

        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $actor['name'],
            'action' => 'Mengubah block time #' . $blockId,
        ];

        return ['success' => true, 'message' => 'Block time berhasil diperbarui.'];
    }

    public function deleteBlock(array $payload, array $actor): array
    {
        $blockId = (int) ($payload['block_id'] ?? 0);

        if ($blockId === 0) {
            return ['success' => false, 'message' => 'Block time tidak ditemukan.'];
        }

        if ($this->usingDb()) {
            try {
                $this->dbExecute("DELETE FROM booking_blocks WHERE id = :id", ['id' => $blockId]);
                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'],
                        'action_text' => 'Menghapus block time #' . $blockId,
                    ]
                );
            } catch (\Throwable $throwable) {
                return ['success' => false, 'message' => 'Gagal menghapus block time: ' . $throwable->getMessage()];
            }

            return ['success' => true, 'message' => 'Block time berhasil dihapus.'];
        }

        $_SESSION['starstyle']['booking_blocks'] = array_values(array_filter(
            $_SESSION['starstyle']['booking_blocks'],
            fn (array $block): bool => (int) ($block['id'] ?? 0) !== $blockId
        ));
        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $actor['name'],
            'action' => 'Menghapus block time #' . $blockId,
        ];

        return ['success' => true, 'message' => 'Block time berhasil dihapus.'];
    }

    public function sales(): array
    {
        $transactions = $this->getTransactions();
        $gross = 0;
        $discount = 0;
        $refund = 0;

        foreach ($transactions as $transaction) {
            $lineTotal = array_reduce($transaction['items'], fn (float $sum, array $item): float => $sum + ($item['qty'] * $item['price']), 0.0);
            $gross += $lineTotal;
            $discount += $transaction['discount'];
            if ($transaction['status'] === 'refund') {
                $refund += $lineTotal;
            }
        }

        return [
            'summary' => [
                'gross' => $gross,
                'net' => $gross - $discount - $refund,
                'discount' => $discount,
                'refund' => $refund,
            ],
            'transactions' => $transactions,
            'services' => $this->getServices(),
            'products' => $this->getProducts(),
            'vouchers' => $this->getVouchers(),
            'cash_drawers' => $this->usingDb()
                ? array_map(static fn (array $drawer): array => [
                    'staff_id' => (int) $drawer['staff_id'],
                    'expected' => (float) $drawer['expected_amount'],
                    'actual' => (float) $drawer['actual_amount'],
                    'status' => (string) $drawer['status'],
                ], $this->dbAll("SELECT staff_id, expected_amount, actual_amount, status FROM cash_drawers ORDER BY open_date DESC"))
                : $this->baseData['cash_drawers'],
            'cash_movements' => $this->usingDb()
                ? array_map(static fn (array $movement): array => [
                    'date' => (string) $movement['created_at'],
                    'type' => (string) $movement['movement_type'],
                    'amount' => (float) $movement['amount'],
                    'note' => (string) ($movement['note'] ?? ''),
                ], $this->dbAll("SELECT created_at, movement_type, amount, note FROM cash_movements ORDER BY created_at DESC"))
                : $this->baseData['cash_movements'],
            'classes' => $this->getClasses(),
        ];
    }

    public function checkout(array $payload, array $actor): array
    {
        $items = json_decode((string) ($payload['items_json'] ?? '[]'), true);
        $customerId = (int) ($payload['customer_id'] ?? 0);
        $staffId = (int) ($payload['staff_id'] ?? 0);
        $voucherCode = trim((string) ($payload['voucher_code'] ?? ''));

        if (!is_array($items) || $items === [] || $customerId === 0 || $staffId === 0) {
            return ['success' => false, 'message' => 'Cart POS belum lengkap.'];
        }

        $calculation = $this->calculateCart($items, $voucherCode);

        if ($this->usingDb()) {
            $reference = 'TRX-' . date('ymdHis');
            $paymentMethod = (string) ($payload['payment_method'] ?? 'Cash');

            $this->pdo()->beginTransaction();
            try {
                $this->dbExecute(
                    "INSERT INTO transactions (booking_id, customer_id, staff_id, reference, payment_method, status, discount_amount, rounding_amount, paid_at)
                     VALUES (NULL, :customer_id, :staff_id, :reference, :payment_method, 'paid', :discount, 0, NOW())",
                    [
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'reference' => $reference,
                        'payment_method' => $paymentMethod,
                        'discount' => (float) $calculation['discount'],
                    ]
                );
                $transactionId = (int) $this->pdo()->lastInsertId();

                foreach ($items as $item) {
                    $this->dbExecute(
                        "INSERT INTO transaction_items (transaction_id, item_type, item_name, quantity, price)
                         VALUES (:transaction_id, :item_type, :item_name, :quantity, :price)",
                        [
                            'transaction_id' => $transactionId,
                            'item_type' => (string) ($item['type'] ?? 'product'),
                            'item_name' => (string) ($item['name'] ?? 'Item'),
                            'quantity' => (int) ($item['qty'] ?? 1),
                            'price' => (float) ($item['price'] ?? 0),
                        ]
                    );
                }

                $invoiceNumber = 'INV-' . date('ymdHis');
                $this->dbExecute(
                    "INSERT INTO invoices (transaction_id, invoice_number, status, issued_at)
                     VALUES (:transaction_id, :invoice_number, 'paid', NOW())",
                    [
                        'transaction_id' => $transactionId,
                        'invoice_number' => $invoiceNumber,
                    ]
                );

                if ($voucherCode !== '') {
                    $voucher = $this->validateVoucher($voucherCode);
                    if ($voucher['valid'] && isset($voucher['voucher']['id'])) {
                        $this->dbExecute(
                            "UPDATE vouchers SET used_count = used_count + 1 WHERE id = :id",
                            ['id' => (int) $voucher['voucher']['id']]
                        );
                    }
                }

                $settings = $this->getSettings();
                $points = (int) floor(((float) $calculation['total']) / max(1, (int) ($settings['loyalty_ratio'] ?? 10000)));
                if ($points > 0) {
                    $this->dbExecute(
                        "INSERT INTO loyalty_ledgers (customer_id, transaction_id, points, type, note, created_at)
                         VALUES (:customer_id, :transaction_id, :points, 'earn', :note, NOW())",
                        [
                            'customer_id' => $customerId,
                            'transaction_id' => $transactionId,
                            'points' => $points,
                            'note' => 'Checkout transaksi ' . $reference,
                        ]
                    );
                    $this->dbExecute(
                        "UPDATE customers SET loyalty_points = loyalty_points + :points, last_visit_at = NOW() WHERE id = :id",
                        [
                            'points' => $points,
                            'id' => $customerId,
                        ]
                    );
                }

                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $actor['name'],
                        'action_text' => 'Checkout transaksi ' . $reference,
                    ]
                );

                $this->pdo()->commit();

                return [
                    'success' => true,
                    'message' => 'Checkout berhasil diproses.',
                    'transaction' => [
                        'id' => $transactionId,
                        'reference' => $reference,
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'date' => date('Y-m-d H:i:s'),
                        'items' => $items,
                        'discount' => (float) $calculation['discount'],
                        'rounding' => 0,
                        'status' => 'paid',
                        'payment_method' => $paymentMethod,
                    ],
                ];
            } catch (\Throwable $throwable) {
                $this->pdo()->rollBack();

                return ['success' => false, 'message' => 'Checkout database gagal: ' . $throwable->getMessage()];
            }
        }

        $id = $this->nextId($_SESSION['starstyle']['transactions'], 8000);
        $transaction = [
            'id' => $id,
            'reference' => 'TRX-' . date('ymd') . '-' . $id,
            'customer_id' => $customerId,
            'staff_id' => $staffId,
            'date' => date('Y-m-d H:i:s'),
            'items' => $items,
            'discount' => $calculation['discount'],
            'rounding' => 0,
            'status' => 'paid',
            'payment_method' => $payload['payment_method'] ?? 'Cash',
        ];

        $_SESSION['starstyle']['transactions'][] = $transaction;
        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $actor['name'],
            'action' => 'Checkout transaksi ' . $transaction['reference'],
        ];

        return ['success' => true, 'message' => 'Checkout berhasil diproses.', 'transaction' => $transaction];
    }

    public function bookingPaymentSummary(int $bookingId): ?array
    {
        $booking = $this->findBooking($bookingId);
        if ($booking === null) {
            return null;
        }

        $customer = $this->findCustomer((int) $booking['customer_id']);
        $staff = $this->findStaff((int) $booking['staff_id']);
        $services = array_values(array_filter(array_map(fn (int $serviceId): ?array => $this->findService($serviceId), $booking['service_ids']), fn (?array $service): bool => $service !== null));
        $items = array_map(fn (array $service): array => [
            'type' => 'service',
            'name' => $service['name'],
            'qty' => 1,
            'price' => (float) ($service['price'] ?? 0),
        ], $services);
        $total = array_reduce($items, fn (float $carry, array $item): float => $carry + ((float) $item['price'] * (int) $item['qty']), 0.0);

        return [
            'booking' => $booking,
            'customer' => $customer,
            'staffMember' => $staff,
            'services' => $services,
            'items' => $items,
            'total' => $total,
        ];
    }

    public function completeCustomerBookingPayment(int $bookingId, array $payload, array $actor): array
    {
        $summary = $this->bookingPaymentSummary($bookingId);
        if ($summary === null) {
            return ['success' => false, 'message' => 'Booking pembayaran tidak ditemukan.'];
        }

        $booking = $summary['booking'];
        if (($booking['status'] ?? '') !== 'awaiting_payment') {
            return ['success' => false, 'message' => 'Booking ini tidak lagi menunggu pembayaran.'];
        }

        $paymentMethod = trim((string) ($payload['payment_method'] ?? ''));
        if ($paymentMethod === '') {
            return ['success' => false, 'message' => 'Pilih metode pembayaran terlebih dahulu.'];
        }

        $items = $summary['items'];
        $customerId = (int) ($booking['customer_id'] ?? 0);
        $staffId = (int) ($booking['staff_id'] ?? 0);
        $bookingReference = (string) ($booking['reference'] ?? '');
        $customerName = (string) ($summary['customer']['name'] ?? ($actor['name'] ?? 'Customer'));

        if ($this->usingDb()) {
            $reference = 'TRX-' . date('ymdHis');

            $this->pdo()->beginTransaction();
            try {
                $this->dbExecute(
                    "UPDATE bookings SET status = 'confirmed' WHERE id = :id",
                    ['id' => $bookingId]
                );

                $this->dbExecute(
                    "INSERT INTO transactions (booking_id, customer_id, staff_id, reference, payment_method, status, discount_amount, rounding_amount, paid_at)
                     VALUES (:booking_id, :customer_id, :staff_id, :reference, :payment_method, 'paid', 0, 0, NOW())",
                    [
                        'booking_id' => $bookingId,
                        'customer_id' => $customerId,
                        'staff_id' => $staffId,
                        'reference' => $reference,
                        'payment_method' => $paymentMethod,
                    ]
                );
                $transactionId = (int) $this->pdo()->lastInsertId();

                foreach ($items as $item) {
                    $this->dbExecute(
                        "INSERT INTO transaction_items (transaction_id, item_type, item_name, quantity, price)
                         VALUES (:transaction_id, :item_type, :item_name, :quantity, :price)",
                        [
                            'transaction_id' => $transactionId,
                            'item_type' => (string) ($item['type'] ?? 'service'),
                            'item_name' => (string) ($item['name'] ?? 'Item'),
                            'quantity' => (int) ($item['qty'] ?? 1),
                            'price' => (float) ($item['price'] ?? 0),
                        ]
                    );
                }

                $invoiceNumber = 'INV-' . date('ymdHis');
                $this->dbExecute(
                    "INSERT INTO invoices (transaction_id, invoice_number, status, issued_at)
                     VALUES (:transaction_id, :invoice_number, 'paid', NOW())",
                    [
                        'transaction_id' => $transactionId,
                        'invoice_number' => $invoiceNumber,
                    ]
                );

                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (:user_id, :actor_name, :action_text, NOW())",
                    [
                        'user_id' => $actor['id'] ?? null,
                        'actor_name' => $customerName,
                        'action_text' => 'Menyelesaikan pembayaran booking ' . $bookingReference,
                    ]
                );

                $this->pdo()->commit();

                return ['success' => true, 'message' => 'Pembayaran berhasil. Booking sudah masuk ke kalender staf terpilih.'];
            } catch (\Throwable $throwable) {
                $this->pdo()->rollBack();

                return ['success' => false, 'message' => 'Gagal memproses pembayaran: ' . $throwable->getMessage()];
            }
        }

        foreach ($_SESSION['starstyle']['bookings'] as $index => $storedBooking) {
            if ((int) ($storedBooking['id'] ?? 0) !== $bookingId) {
                continue;
            }

            $_SESSION['starstyle']['bookings'][$index]['status'] = 'confirmed';
            break;
        }

        $transactionId = $this->nextId($_SESSION['starstyle']['transactions'], 8000);
        $_SESSION['starstyle']['transactions'][] = [
            'id' => $transactionId,
            'booking_id' => $bookingId,
            'reference' => 'TRX-' . date('ymd') . '-' . $transactionId,
            'customer_id' => $customerId,
            'staff_id' => $staffId,
            'date' => date('Y-m-d H:i:s'),
            'items' => $items,
            'discount' => 0,
            'rounding' => 0,
            'status' => 'paid',
            'payment_method' => $paymentMethod,
        ];

        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $customerName,
            'action' => 'Menyelesaikan pembayaran booking ' . $bookingReference,
        ];

        return ['success' => true, 'message' => 'Pembayaran berhasil. Booking sudah masuk ke kalender staf terpilih.'];
    }

    public function calculateCart(array $items, ?string $voucherCode = null): array
    {
        $subtotal = array_reduce($items, fn (float $sum, array $item): float => $sum + ((float) $item['price'] * (int) $item['qty']), 0.0);
        $discount = 0.0;

        if ($voucherCode !== null && $voucherCode !== '') {
            $voucher = $this->validateVoucher($voucherCode);

            if ($voucher['valid']) {
                $voucherData = $voucher['voucher'];
                $discount = $voucherData['type'] === 'gift' ? $voucherData['value'] : round($subtotal * ($voucherData['value'] / 100));
            }
        }

        return [
            'subtotal' => $subtotal,
            'discount' => $discount,
            'total' => max(0, $subtotal - $discount),
        ];
    }

    public function validateVoucher(string $code): array
    {
        foreach ($this->getVouchers() as $voucher) {
            if (strcasecmp($voucher['code'], $code) !== 0) {
                continue;
            }

            $expired = $voucher['expired_at'] < date('Y-m-d');
            $limitReached = $voucher['used'] >= $voucher['usage_limit'];

            if ($expired || $limitReached || $voucher['status'] !== 'Aktif') {
                return ['valid' => false, 'message' => 'Voucher tidak aktif atau sudah expired.', 'voucher' => $voucher];
            }

            return ['valid' => true, 'message' => 'Voucher valid.', 'voucher' => $voucher];
        }

        return ['valid' => false, 'message' => 'Kode voucher tidak ditemukan.', 'voucher' => null];
    }

    public function analytics(): array
    {
        $transactions = $this->getTransactions();
        $customers = $this->getCustomers();
        $inventory = $this->getProducts();
        $bookings = $this->getBookings();
        $staff = $this->getStaff();
        $vouchers = $this->getVouchers();
        $classes = $this->getClasses();

        return [
            'kpis' => [
                ['label' => 'Appointment Conversion', 'value' => '86%'],
                ['label' => 'Sales Growth', 'value' => '+18%'],
                ['label' => 'Retention Rate', 'value' => '72%'],
                ['label' => 'Low Stock Item', 'value' => (string) count(array_filter($inventory, fn (array $product): bool => $product['stock'] <= 8))],
            ],
            'salesByType' => [
                'service' => array_sum(array_map(fn (array $transaction): float => $this->sumItemsByType($transaction['items'], 'service'), $transactions)),
                'product' => array_sum(array_map(fn (array $transaction): float => $this->sumItemsByType($transaction['items'], 'product'), $transactions)),
                'voucher' => 240000,
            ],
            'retention' => [
                'new' => 24,
                'returning' => 61,
                'vip' => count(array_filter($customers, fn (array $customer): bool => in_array('VIP', $customer['tags'], true))),
            ],
            'inventory' => $inventory,
            'bookings' => $bookings,
            'transactions' => $transactions,
            'customers' => $customers,
            'staff' => $staff,
            'vouchers' => $vouchers,
            'classes' => $classes,
        ];
    }

    public function staffDirectory(): array
    {
        return [
            'staff' => $this->getStaff(),
            'shifts' => $this->getShifts(),
            'attendance' => $this->getAttendance(),
            'serviceGroups' => $this->getServiceGroups(),
            'services' => $this->getServices(),
            'products' => $this->getProducts(),
        ];
    }

    public function customerAccount(int $customerId): array
    {
        return [
            'customer' => $this->findCustomer($customerId),
            'bookings' => array_values(array_filter($this->getBookings(), fn (array $booking): bool => $booking['customer_id'] === $customerId)),
            'transactions' => array_values(array_filter($this->getTransactions(), fn (array $transaction): bool => $transaction['customer_id'] === $customerId)),
            'vouchers' => $this->getVouchers(),
        ];
    }

    public function settingsPayload(): array
    {
        if ($this->usingDb()) {
            $staff = array_map(function (array $staffMember): array {
                $staffMember['permissions'] = array_map(
                    static fn (array $row): string => (string) $row['permission_key'],
                    $this->dbAll(
                        "SELECT permission_key
                         FROM staff_permissions
                         WHERE staff_id = :staff_id AND granted = 1
                         ORDER BY permission_key",
                        ['staff_id' => (int) $staffMember['id']]
                    )
                );

                if ($staffMember['permissions'] === []) {
                    $staffMember['permissions'] = $staffMember['role'] === 'Owner'
                        ? $this->allPermissionKeys()
                        : ($this->permissions['defaults']['staff'] ?? []);
                }

                return $staffMember;
            }, $this->getStaff());

            return [
                'settings' => $this->getSettings(),
                'catalog' => $this->permissions['catalog'],
                'staff' => $staff,
            ];
        }

        $staff = array_map(function (array $staffMember): array {
            $staffMember['permissions'] = $_SESSION['starstyle']['staff_permissions'][$staffMember['id']] ?? $this->permissions['defaults']['staff'];

            return $staffMember;
        }, $this->getStaff());

        return [
            'settings' => $this->getSettings(),
            'catalog' => $this->permissions['catalog'],
            'staff' => $staff,
        ];
    }

    public function updateStaffPermissions(int $staffId, array $grantedPermissions, string $actorName): void
    {
        if ($this->usingDb()) {
            $this->pdo()->beginTransaction();
            try {
                $this->dbExecute("DELETE FROM staff_permissions WHERE staff_id = :staff_id", ['staff_id' => $staffId]);
                foreach (array_values(array_unique($grantedPermissions)) as $permissionKey) {
                    $this->dbExecute(
                        "INSERT INTO staff_permissions (staff_id, permission_key, granted, created_at)
                         VALUES (:staff_id, :permission_key, 1, NOW())",
                        [
                            'staff_id' => $staffId,
                            'permission_key' => (string) $permissionKey,
                        ]
                    );
                }
                $this->dbExecute(
                    "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                     VALUES (NULL, :actor_name, :action_text, NOW())",
                    [
                        'actor_name' => $actorName,
                        'action_text' => 'Mengubah permission staff ID #' . $staffId,
                    ]
                );
                $this->pdo()->commit();
            } catch (\Throwable $throwable) {
                $this->pdo()->rollBack();
                throw $throwable;
            }

            return;
        }

        $_SESSION['starstyle']['staff_permissions'][$staffId] = array_values(array_unique($grantedPermissions));
        $_SESSION['starstyle']['activity_logs'][] = [
            'time' => date('Y-m-d H:i:s'),
            'actor' => $actorName,
            'action' => 'Mengubah permission staff ID #' . $staffId,
        ];
    }

    public function searchCustomers(string $query): array
    {
        if ($this->usingDb()) {
            $query = trim($query);
            if ($query === '') {
                return $this->getCustomers();
            }

            $rows = $this->dbAll(
                "SELECT id FROM customers
                 WHERE deleted_at IS NULL
                   AND (name LIKE :query OR phone LIKE :query OR email LIKE :query OR member_id LIKE :query)
                 ORDER BY name ASC",
                ['query' => '%' . $query . '%']
            );
            $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);

            return array_values(array_filter($this->getCustomers(), static fn (array $customer): bool => in_array((int) $customer['id'], $ids, true)));
        }

        return array_values(array_filter($this->getCustomers(), fn (array $customer): bool => stripos($customer['name'], $query) !== false || stripos($customer['phone'], $query) !== false));
    }

    public function servicesByStaff(int $staffId): array
    {
        if ($this->usingDb()) {
            $serviceIds = array_map(
                static fn (array $row): int => (int) $row['service_id'],
                $this->dbAll("SELECT service_id FROM staff_skills WHERE staff_id = :staff_id", ['staff_id' => $staffId])
            );

            return array_values(array_filter($this->getServices(), static fn (array $service): bool => in_array((int) $service['id'], $serviceIds, true)));
        }

        return array_values(array_filter($this->getServices(), fn (array $service): bool => in_array($staffId, $service['staff_ids'], true)));
    }

    public function findCustomer(int $customerId): ?array
    {
        foreach ($this->getCustomers() as $customer) {
            if ($customer['id'] === $customerId) {
                return $customer;
            }
        }

        return null;
    }

    public function findBooking(int $bookingId): ?array
    {
        foreach ($this->getBookings() as $booking) {
            if ((int) ($booking['id'] ?? 0) === $bookingId) {
                return $booking;
            }
        }

        return null;
    }

    public function findStaff(int $staffId): ?array
    {
        foreach ($this->getStaff() as $staff) {
            if ($staff['id'] === $staffId) {
                return $staff;
            }
        }

        return null;
    }

    public function findService(int $serviceId): ?array
    {
        foreach ($this->getServices() as $service) {
            if ($service['id'] === $serviceId) {
                return $service;
            }
        }

        return null;
    }

    private function inventorySupplierMeta(): array
    {
        if (!$this->inventoryDbEnabled() || !$this->tableExists('suppliers')) {
            return [];
        }

        $hasDescription = $this->columnExists('suppliers', 'description');
        $hasContactName = $this->columnExists('suppliers', 'contact_name');
        $hasWebsite = $this->columnExists('suppliers', 'website');
        $hasAddress = $this->columnExists('suppliers', 'address');
        $hasCity = $this->columnExists('suppliers', 'city');
        $hasCountry = $this->columnExists('suppliers', 'country');
        $hasPostalCode = $this->columnExists('suppliers', 'postal_code');

        $rows = $this->dbAll(
            'SELECT id, name, phone, email'
            . ($hasDescription ? ', description' : '')
            . ($hasContactName ? ', contact_name' : '')
            . ($hasWebsite ? ', website' : '')
            . ($hasAddress ? ', address' : '')
            . ($hasCity ? ', city' : '')
            . ($hasCountry ? ', country' : '')
            . ($hasPostalCode ? ', postal_code' : '')
            . ' FROM suppliers ORDER BY id'
        );

        $meta = [];
        foreach ($rows as $row) {
            $addressParts = array_values(array_filter([
                $hasAddress ? (string) ($row['address'] ?? '') : '',
                $hasCity ? (string) ($row['city'] ?? '') : '',
                $hasCountry ? (string) ($row['country'] ?? '') : '',
                $hasPostalCode ? (string) ($row['postal_code'] ?? '') : '',
            ], static fn (string $value): bool => $value !== ''));

            $meta[(string) $row['name']] = [
                'description' => $hasDescription ? (string) ($row['description'] ?? '') : '',
                'contact' => $hasContactName
                    ? (string) ($row['contact_name'] ?? '')
                    : (string) ($row['email'] ?: ($row['phone'] ?: 'Tim Supplier')),
                'email' => (string) ($row['email'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
                'website' => $hasWebsite ? (string) ($row['website'] ?? '') : '',
                'address' => $addressParts !== [] ? implode(', ', $addressParts) : 'Bangkok',
                'city' => $hasCity ? (string) ($row['city'] ?? '') : 'Bangkok',
                'country' => $hasCountry ? (string) ($row['country'] ?? '') : 'Thailand',
                'postal' => $hasPostalCode ? (string) ($row['postal_code'] ?? '') : '',
                'lead_time' => '3 hari',
                'status' => 'Aktif',
            ];
        }

        return $meta;
    }

    public function getInventoryBrands(): array
    {
        if (!$this->inventoryDbEnabled() || !$this->tableExists('brands')) {
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
            ];
        }, $this->dbAll('SELECT id, name FROM brands ORDER BY name ASC, id ASC'));
    }

    public function getInventoryCategories(): array
    {
        if (!$this->inventoryDbEnabled() || !$this->tableExists('categories')) {
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
            ];
        }, $this->dbAll('SELECT id, name FROM categories ORDER BY name ASC, id ASC'));
    }

    public function getInventorySuppliers(): array
    {
        if (!$this->inventoryDbEnabled() || !$this->tableExists('suppliers')) {
            return [];
        }

        $this->ensureInventoryWorkflowSchema();

        $hasDescription = $this->columnExists('suppliers', 'description');
        $hasContactName = $this->columnExists('suppliers', 'contact_name');
        $hasWebsite = $this->columnExists('suppliers', 'website');
        $hasAddress = $this->columnExists('suppliers', 'address');
        $hasCity = $this->columnExists('suppliers', 'city');
        $hasCountry = $this->columnExists('suppliers', 'country');
        $hasPostalCode = $this->columnExists('suppliers', 'postal_code');

        $rows = $this->dbAll(
            'SELECT id, name, phone, email'
            . ($hasDescription ? ', description' : '')
            . ($hasContactName ? ', contact_name' : '')
            . ($hasWebsite ? ', website' : '')
            . ($hasAddress ? ', address' : '')
            . ($hasCity ? ', city' : '')
            . ($hasCountry ? ', country' : '')
            . ($hasPostalCode ? ', postal_code' : '')
            . ' FROM suppliers ORDER BY name ASC, id ASC'
        );

        return array_map(static function (array $row) use ($hasDescription, $hasContactName, $hasWebsite, $hasAddress, $hasCity, $hasCountry, $hasPostalCode): array {
            return [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'description' => $hasDescription ? (string) ($row['description'] ?? '') : '',
                'contact' => $hasContactName ? (string) ($row['contact_name'] ?? '') : '',
                'email' => (string) ($row['email'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
                'website' => $hasWebsite ? (string) ($row['website'] ?? '') : '',
                'address' => $hasAddress ? (string) ($row['address'] ?? '') : '',
                'city' => $hasCity ? (string) ($row['city'] ?? '') : '',
                'country' => $hasCountry ? (string) ($row['country'] ?? '') : '',
                'postal' => $hasPostalCode ? (string) ($row['postal_code'] ?? '') : '',
            ];
        }, $rows);
    }

    private function inventoryPurchaseRows(): array
    {
        if (!$this->inventoryDbEnabled() || !$this->tableExists('purchase_orders') || !$this->tableExists('suppliers')) {
            return [];
        }

        $hasLocationId = $this->columnExists('purchase_orders', 'location_id');
        $hasType = $this->columnExists('purchase_orders', 'order_type');
        $hasNote = $this->columnExists('purchase_orders', 'note');
        $hasTotal = $this->columnExists('purchase_orders', 'total_amount');
        $hasOrderedAt = $this->columnExists('purchase_orders', 'ordered_at');
        $hasReceivedAt = $this->columnExists('purchase_orders', 'received_at');
        $hasItems = $this->tableExists('purchase_order_items');
        $hasReceivingLogs = $this->tableExists('purchase_order_receiving_logs');

        $rows = $this->dbAll(
            'SELECT po.id, po.reference, po.order_date, po.status, s.name AS supplier_name'
            . ($this->columnExists('suppliers', 'email') ? ', s.email AS supplier_email' : '')
            . ($hasLocationId ? ', l.name AS location_name' : '')
            . ($hasType ? ', po.order_type' : '')
            . ($hasNote ? ', po.note' : '')
            . ($hasTotal ? ', po.total_amount' : '')
            . ($hasOrderedAt ? ', po.ordered_at' : '')
            . ($hasReceivedAt ? ', po.received_at' : '')
            . ' FROM purchase_orders po
                JOIN suppliers s ON s.id = po.supplier_id'
            . ($hasLocationId ? ' LEFT JOIN locations l ON l.id = po.location_id' : '')
            . ' ORDER BY po.order_date DESC, po.id DESC'
        );

        $itemsByOrder = [];
        if ($hasItems && $this->tableExists('products')) {
            $itemRows = $this->dbAll(
                "SELECT poi.purchase_order_id, poi.product_id, poi.quantity, poi.supply_price, p.name AS product_name
                 FROM purchase_order_items poi
                 JOIN products p ON p.id = poi.product_id
                 ORDER BY poi.purchase_order_id, poi.id"
            );

            foreach ($itemRows as $row) {
                $itemsByOrder[(int) $row['purchase_order_id']][] = [
                    'name' => (string) $row['product_name'],
                    'qty' => (int) $row['quantity'],
                    'price' => (float) $row['supply_price'],
                    'total' => (int) ((int) $row['quantity'] * (float) $row['supply_price']),
                ];
            }
        }

        $logsByOrder = [];
        if ($hasReceivingLogs) {
            $logRows = $this->dbAll(
                "SELECT prl.purchase_order_id, prl.product_name, prl.received_qty, prl.received_at, prl.supply_price
                 FROM purchase_order_receiving_logs prl
                 ORDER BY prl.purchase_order_id, prl.received_at DESC, prl.id DESC"
            );

            foreach ($logRows as $row) {
                $logsByOrder[(int) $row['purchase_order_id']][] = [
                    'product' => (string) $row['product_name'],
                    'qty' => (int) $row['received_qty'],
                    'date' => (string) $row['received_at'],
                    'price' => (float) $row['supply_price'],
                    'total' => (int) ((int) $row['received_qty'] * (float) $row['supply_price']),
                ];
            }
        }

        $defaultLocation = $this->getLocations()[0]['name'] ?? 'Star Salon';

        return array_map(function (array $row) use ($itemsByOrder, $logsByOrder, $defaultLocation, $hasType, $hasNote, $hasTotal, $hasOrderedAt, $hasReceivedAt): array {
            $orderId = (int) $row['id'];
            $items = $itemsByOrder[$orderId] ?? [];
            $total = $hasTotal && isset($row['total_amount'])
                ? (float) $row['total_amount']
                : array_reduce($items, static fn (float $carry, array $item): float => $carry + ((float) $item['price'] * (int) $item['qty']), 0.0);

            $createdAt = (string) ($hasOrderedAt && !empty($row['ordered_at']) ? $row['ordered_at'] : ((string) $row['order_date'] . ' 09:00:00'));
            $receivedAt = $hasReceivedAt && !empty($row['received_at']) ? (string) $row['received_at'] : null;
            $status = $this->normalizeInventoryPurchaseStatus((string) $row['status']);

            return [
                'id' => $orderId,
                'document' => (string) $row['reference'],
                'created_at' => $this->humanDate($createdAt),
                'type' => $hasType && !empty($row['order_type']) ? ucfirst((string) $row['order_type']) : 'Order',
                'supplier' => (string) $row['supplier_name'],
                'location' => (string) ($row['location_name'] ?? $defaultLocation),
                'total' => money($total),
                'status' => $status,
                'note' => $hasNote ? (string) ($row['note'] ?? '') : '',
                'ordered_at' => $this->humanDate($createdAt),
                'received_at' => $receivedAt !== null ? $this->humanDateTime($receivedAt) : '',
                'supplier_meta' => (string) ($row['supplier_email'] ?? ''),
                'items' => $items,
                'receiving_logs' => $logsByOrder[$orderId] ?? [],
            ];
        }, $rows);
    }

    private function inventoryOpnameRows(): array
    {
        if (!$this->inventoryDbEnabled()) {
            return [];
        }

        $this->ensureInventoryWorkflowSchema();

        $defaultLocation = $this->getLocations()[0]['name'] ?? 'Star Salon';

        if ($this->tableExists('stock_opname_sessions')) {
            $hasEndedAt = $this->columnExists('stock_opname_sessions', 'ended_at');
            $hasStatus = $this->columnExists('stock_opname_sessions', 'status');
            $hasNote = $this->columnExists('stock_opname_sessions', 'note');
            $hasLocationId = $this->columnExists('stock_opname_sessions', 'location_id');
            $hasStartedBy = $this->columnExists('stock_opname_sessions', 'started_by');
            $hasCancelledBy = $this->columnExists('stock_opname_sessions', 'cancelled_by');
            $hasCancelledNote = $this->columnExists('stock_opname_sessions', 'cancelled_note');

            $rows = $this->dbAll(
                'SELECT sos.id, sos.name, sos.started_at'
                . ($hasEndedAt ? ', sos.ended_at' : '')
                . ($hasStatus ? ', sos.status' : '')
                . ($hasNote ? ', sos.note' : '')
                . ($hasStartedBy ? ', sos.started_by' : '')
                . ($hasCancelledBy ? ', sos.cancelled_by' : '')
                . ($hasCancelledNote ? ', sos.cancelled_note' : '')
                . ($hasLocationId ? ', l.name AS location_name' : '')
                . ' FROM stock_opname_sessions sos'
                . ($hasLocationId ? ' LEFT JOIN locations l ON l.id = sos.location_id' : '')
                . ' ORDER BY sos.started_at DESC, sos.id DESC'
            );

            $itemsBySession = [];
            if ($this->tableExists('stock_opname_session_items') && $this->tableExists('products')) {
                $productSkuColumn = $this->columnExists('products', 'sku')
                    ? 'p.sku'
                    : ($this->columnExists('products', 'code') ? 'p.code' : "''");
                $itemRows = $this->dbAll(
                    "SELECT sosi.session_id, sosi.expected_stock, sosi.counted_stock, p.name AS product_name, {$productSkuColumn} AS product_sku
                     FROM stock_opname_session_items sosi
                     JOIN products p ON p.id = sosi.product_id
                     ORDER BY sosi.session_id, sosi.id"
                );

                foreach ($itemRows as $itemRow) {
                    $expected = (int) $itemRow['expected_stock'];
                    $counted = (int) $itemRow['counted_stock'];
                    $itemsBySession[(int) $itemRow['session_id']][] = [
                        'name' => (string) $itemRow['product_name'],
                        'sku' => (string) (($itemRow['product_sku'] ?? '') ?: '-'),
                        'expected' => $expected,
                        'counted' => $counted,
                        'diff' => $counted - $expected,
                        'cost' => ($counted - $expected) * 25000,
                    ];
                }
            }

            return array_map(function (array $row) use ($defaultLocation, $hasEndedAt, $hasStatus, $hasNote, $hasStartedBy, $hasCancelledBy, $hasCancelledNote, $itemsBySession): array {
                $startedAt = (string) $row['started_at'];
                $status = $hasStatus && !empty($row['status']) ? $this->normalizeInventoryOpnameStatus((string) $row['status']) : 'Meninjau';
                $sessionId = (int) $row['id'];

                return [
                    'id' => $sessionId,
                    'name' => (string) $row['name'],
                    'location' => (string) ($row['location_name'] ?? $defaultLocation),
                    'started_at' => $this->humanDateTime($startedAt),
                    'ended_at' => $hasEndedAt && !empty($row['ended_at']) ? $this->humanDateTime((string) $row['ended_at']) : '-',
                    'status' => $status,
                    'note' => $hasNote ? (string) ($row['note'] ?? '') : '',
                    'started_by' => $hasStartedBy ? (string) ($row['started_by'] ?? '') : '',
                    'cancelled_by' => $hasCancelledBy ? (string) ($row['cancelled_by'] ?? '') : '',
                    'cancelled_note' => $hasCancelledNote ? (string) ($row['cancelled_note'] ?? '') : '',
                    'items' => $itemsBySession[$sessionId] ?? [],
                ];
            }, $rows);
        }

        if (!$this->tableExists('stock_opnames')) {
            return [];
        }

        $rows = $this->dbAll(
            "SELECT so.id, so.expected_stock, so.actual_stock, so.note, so.created_at
             FROM stock_opnames so
             ORDER BY so.created_at DESC, so.id DESC"
        );

        return array_map(function (array $row) use ($defaultLocation): array {
            $difference = (int) $row['actual_stock'] - (int) $row['expected_stock'];

            return [
                'id' => (int) $row['id'],
                'name' => 'Stock Opname #' . (int) $row['id'],
                'location' => $defaultLocation,
                'started_at' => $this->humanDateTime((string) $row['created_at']),
                'ended_at' => $difference === 0 ? $this->humanDateTime((string) $row['created_at']) : '-',
                'status' => $difference === 0 ? 'Completed' : 'Perhitungan',
                'note' => (string) ($row['note'] ?? ''),
            ];
        }, $rows);
    }

    private function inventoryOpnameDetailProducts(array $products): array
    {
        if (!$this->canUsePdo() || !$this->tableExists('products')) {
            return [];
        }

        return array_map(static function (array $product): array {
            return [
                'id' => (int) ($product['id'] ?? 0),
                'name' => (string) $product['name'],
                'code' => (string) ($product['sku'] !== '' ? $product['sku'] : '-'),
                'sku' => (string) ($product['sku'] !== '' ? $product['sku'] : '-'),
                'expected' => (int) $product['stock'],
            ];
        }, $products);
    }

    public function saveInventoryMasterItem(string $type, ?int $id, string $name): array
    {
        $this->ensureInventoryWorkflowSchema();

        $table = match ($type) {
            'brands' => 'brands',
            'categories' => 'categories',
            default => throw new \InvalidArgumentException('Tipe master item tidak valid.'),
        };

        $name = trim($name);
        if ($name === '') {
            throw new \InvalidArgumentException('Nama wajib diisi.');
        }

        if ($id !== null && $id > 0) {
            $this->dbExecute(
                "UPDATE {$table} SET name = :name WHERE id = :id",
                ['name' => $name, 'id' => $id]
            );

            return ['id' => $id, 'name' => $name];
        }

        $existing = $this->dbOne("SELECT id, name FROM {$table} WHERE LOWER(name) = LOWER(:name) LIMIT 1", ['name' => $name]);
        if ($existing !== null) {
            return ['id' => (int) $existing['id'], 'name' => (string) $existing['name']];
        }

        $this->dbExecute("INSERT INTO {$table} (name) VALUES (:name)", ['name' => $name]);

        return [
            'id' => (int) $this->pdo()->lastInsertId(),
            'name' => $name,
        ];
    }

    public function deleteInventoryMasterItem(string $type, int $id): void
    {
        $table = match ($type) {
            'brands' => 'brands',
            'categories' => 'categories',
            default => throw new \InvalidArgumentException('Tipe master item tidak valid.'),
        };

        $this->dbExecute("DELETE FROM {$table} WHERE id = :id", ['id' => $id]);
    }

    public function saveInventorySupplier(?int $id, array $payload): array
    {
        $this->ensureInventoryWorkflowSchema();

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Nama supplier wajib diisi.');
        }

        $params = [
            'name' => $name,
            'description' => trim((string) ($payload['description'] ?? '')),
            'contact_name' => trim((string) ($payload['contact'] ?? '')),
            'email' => trim((string) ($payload['email'] ?? '')),
            'phone' => trim((string) ($payload['phone'] ?? '')),
            'website' => trim((string) ($payload['website'] ?? '')),
            'address' => trim((string) ($payload['address'] ?? '')),
            'city' => trim((string) ($payload['city'] ?? '')),
            'country' => trim((string) ($payload['country'] ?? '')),
            'postal_code' => trim((string) ($payload['postal'] ?? '')),
        ];

        if ($id !== null && $id > 0) {
            $this->dbExecute(
                "UPDATE suppliers
                 SET name = :name,
                     description = :description,
                     contact_name = :contact_name,
                     email = :email,
                     phone = :phone,
                     website = :website,
                     address = :address,
                     city = :city,
                     country = :country,
                     postal_code = :postal_code
                 WHERE id = :id",
                $params + ['id' => $id]
            );

            return $this->inventorySupplierById($id) ?? ['id' => $id] + $payload;
        }

        $this->dbExecute(
            "INSERT INTO suppliers (name, description, contact_name, email, phone, website, address, city, country, postal_code)
             VALUES (:name, :description, :contact_name, :email, :phone, :website, :address, :city, :country, :postal_code)",
            $params
        );

        $supplierId = (int) $this->pdo()->lastInsertId();

        return $this->inventorySupplierById($supplierId) ?? ['id' => $supplierId] + $payload;
    }

    public function deleteInventorySupplier(int $id): void
    {
        $this->dbExecute('DELETE FROM suppliers WHERE id = :id', ['id' => $id]);
    }

    public function saveInventoryProduct(int $id, array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Nama produk wajib diisi.');
        }

        $categoryName = trim((string) ($payload['category'] ?? ''));
        $brandName = trim((string) ($payload['brand'] ?? ''));
        $hasBrandId = $this->columnExists('products', 'brand_id') && $this->tableExists('brands');
        $hasCategoryId = $this->columnExists('products', 'category_id') && $this->tableExists('categories');
        $hasBrandText = $this->columnExists('products', 'brand');
        $hasCategoryText = $this->columnExists('products', 'category');
        $hasSku = $this->columnExists('products', 'sku');
        $hasCode = $this->columnExists('products', 'code');
        $hasSellPrice = $this->columnExists('products', 'sell_price');
        $hasSellingPrice = $this->columnExists('products', 'selling_price');
        $categoryId = $hasCategoryId ? $this->inventoryEnsureNamedRecord('categories', $categoryName) : null;
        $brandId = $hasBrandId ? $this->inventoryEnsureNamedRecord('brands', $brandName) : null;
        $price = (float) ($payload['price'] ?? 0);
        $status = trim((string) ($payload['status'] ?? 'Aktif'));

        if ($id <= 0) {
            $nextCode = 'PRD' . str_pad((string) ((int) ($this->dbOne('SELECT MAX(id) AS max_id FROM products')['max_id'] ?? 0) + 1), 4, '0', STR_PAD_LEFT);
            $columns = ['name', 'stock', 'status'];
            $placeholders = [':name', '0', ':status'];
            $params = [
                'name' => $name,
                'status' => $status,
            ];

            if ($hasBrandId) {
                $columns[] = 'brand_id';
                $placeholders[] = ':brand_id';
                $params['brand_id'] = $brandId;
            } elseif ($hasBrandText) {
                $columns[] = 'brand';
                $placeholders[] = ':brand';
                $params['brand'] = $brandName !== '' ? $brandName : null;
            }

            if ($hasCategoryId) {
                $columns[] = 'category_id';
                $placeholders[] = ':category_id';
                $params['category_id'] = $categoryId;
            } elseif ($hasCategoryText) {
                $columns[] = 'category';
                $placeholders[] = ':category';
                $params['category'] = $categoryName !== '' ? $categoryName : null;
            }

            if ($hasSku) {
                $columns[] = 'sku';
                $placeholders[] = ':sku';
                $params['sku'] = $nextCode;
            } elseif ($hasCode) {
                $columns[] = 'code';
                $placeholders[] = ':code';
                $params['code'] = $nextCode;
            }

            if ($hasSellPrice) {
                $columns[] = 'sell_price';
                $placeholders[] = ':sell_price';
                $params['sell_price'] = $price;
            } elseif ($hasSellingPrice) {
                $columns[] = 'selling_price';
                $placeholders[] = ':selling_price';
                $params['selling_price'] = $price;
            }

            $this->dbExecute(
                sprintf(
                    'INSERT INTO products (%s) VALUES (%s)',
                    implode(', ', $columns),
                    implode(', ', $placeholders)
                ),
                $params
            );

            return $this->inventoryProductById((int) $this->pdo()->lastInsertId()) ?? [];
        }

        $assignments = ['name = :name', 'status = :status'];
        $params = [
            'id' => $id,
            'name' => $name,
            'status' => $status,
        ];

        if ($hasCategoryId) {
            $assignments[] = 'category_id = :category_id';
            $params['category_id'] = $categoryId;
        } elseif ($hasCategoryText) {
            $assignments[] = 'category = :category';
            $params['category'] = $categoryName !== '' ? $categoryName : null;
        }

        if ($hasBrandId) {
            $assignments[] = 'brand_id = :brand_id';
            $params['brand_id'] = $brandId;
        } elseif ($hasBrandText) {
            $assignments[] = 'brand = :brand';
            $params['brand'] = $brandName !== '' ? $brandName : null;
        }

        if ($hasSellPrice) {
            $assignments[] = 'sell_price = :sell_price';
            $params['sell_price'] = $price;
        } elseif ($hasSellingPrice) {
            $assignments[] = 'selling_price = :selling_price';
            $params['selling_price'] = $price;
        }

        $this->dbExecute(
            sprintf(
                'UPDATE products SET %s WHERE id = :id',
                implode(', ', $assignments)
            ),
            $params
        );

        return $this->inventoryProductById($id) ?? [];
    }

    public function adjustInventoryProductStock(int $productId, string $mode, int $quantity, float $supplyPrice, string $reason, string $note, string $actorName): array
    {
        $direction = $mode === 'decrease' ? 'decrease' : 'increase';
        $quantity = max(1, $quantity);
        $this->pdo()->beginTransaction();

        try {
            $product = $this->dbOne('SELECT id, stock FROM products WHERE id = :id LIMIT 1 FOR UPDATE', ['id' => $productId]);
            if ($product === null) {
                throw new \RuntimeException('Produk tidak ditemukan.');
            }

            $currentStock = (int) $product['stock'];
            $delta = $direction === 'decrease' ? -min($quantity, $currentStock) : $quantity;
            $nextStock = max(0, $currentStock + $delta);

            $this->dbExecute(
                'UPDATE products SET stock = :stock, status = :status WHERE id = :id',
                [
                    'id' => $productId,
                    'stock' => $nextStock,
                    'status' => $nextStock > 0 ? 'Aman' : 'Kosong',
                ]
            );

            $movementType = $direction === 'decrease' ? 'stock_out' : 'stock_in';
            $movementNote = trim($reason . ($note !== '' ? ' - ' . $note : ''));
            $this->dbExecute(
                'INSERT INTO stock_movements (product_id, movement_type, quantity, note, created_at)
                 VALUES (:product_id, :movement_type, :quantity, :note, NOW())',
                [
                    'product_id' => $productId,
                    'movement_type' => $movementType,
                    'quantity' => $delta,
                    'note' => $movementNote,
                ]
            );

            $this->dbExecute(
                "INSERT INTO activity_logs (user_id, actor_name, action_text, created_at)
                 VALUES (NULL, :actor_name, :action_text, NOW())",
                [
                    'actor_name' => $actorName,
                    'action_text' => sprintf('Penyesuaian stok produk #%d (%s %d)', $productId, $direction, $quantity),
                ]
            );

            $this->pdo()->commit();

            return [
                'product' => $this->inventoryProductById($productId) ?? [],
                'movement' => [
                    'mode' => $direction,
                    'qty' => abs($delta),
                    'actual_delta' => $delta,
                    'current_qty' => $nextStock,
                    'cost' => $supplyPrice,
                    'reason' => $reason,
                    'note' => $note,
                    'created_at' => date('d F Y, H:i:s'),
                    'staff' => $actorName,
                    'location' => $this->getLocations()[0]['name'] ?? 'Star Salon',
                ],
            ];
        } catch (\Throwable $throwable) {
            $this->pdo()->rollBack();
            throw $throwable;
        }
    }

    public function createInventoryPurchaseOrder(array $payload): array
    {
        $this->ensureInventoryWorkflowSchema();

        $supplierId = (int) ($payload['supplier_id'] ?? 0);
        $locationId = (int) ($payload['location_id'] ?? 0);
        $type = trim((string) ($payload['type'] ?? 'Order'));
        $note = trim((string) ($payload['note'] ?? ''));
        $items = array_values(array_filter($payload['items'] ?? [], static fn ($item): bool => is_array($item)));
        if ($supplierId <= 0 || $locationId <= 0 || $items === []) {
            throw new \InvalidArgumentException('Data pesanan belum lengkap.');
        }

        $reference = $this->nextPurchaseReference();
        $total = array_reduce($items, static fn (float $carry, array $item): float => $carry + (((int) ($item['qty'] ?? 0)) * ((float) ($item['price'] ?? 0))), 0.0);

        $this->pdo()->beginTransaction();
        try {
            $this->dbExecute(
                "INSERT INTO purchase_orders
                 (supplier_id, location_id, reference, order_type, order_date, status, note, total_amount, ordered_at)
                 VALUES (:supplier_id, :location_id, :reference, :order_type, CURDATE(), 'ordered', :note, :total_amount, NOW())",
                [
                    'supplier_id' => $supplierId,
                    'location_id' => $locationId,
                    'reference' => $reference,
                    'order_type' => $type,
                    'note' => $note,
                    'total_amount' => $total,
                ]
            );

            $orderId = (int) $this->pdo()->lastInsertId();
            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                if ($productId <= 0) {
                    $productId = $this->inventoryProductIdByName((string) ($item['name'] ?? ''));
                }
                if ($productId <= 0) {
                    continue;
                }

                $this->dbExecute(
                    'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, supply_price)
                     VALUES (:purchase_order_id, :product_id, :quantity, :supply_price)',
                    [
                        'purchase_order_id' => $orderId,
                        'product_id' => $productId,
                        'quantity' => max(1, (int) ($item['qty'] ?? 1)),
                        'supply_price' => (float) ($item['price'] ?? 0),
                    ]
                );
            }

            $this->pdo()->commit();

            return $this->inventoryPurchaseRowById($orderId) ?? [];
        } catch (\Throwable $throwable) {
            $this->pdo()->rollBack();
            throw $throwable;
        }
    }

    public function receiveInventoryPurchaseOrder(int $orderId, array $items): array
    {
        $this->ensureInventoryWorkflowSchema();
        $this->pdo()->beginTransaction();

        try {
            $orderItems = $this->dbAll(
                "SELECT poi.id, poi.product_id, poi.quantity, poi.supply_price, p.name AS product_name
                 FROM purchase_order_items poi
                 JOIN products p ON p.id = poi.product_id
                 WHERE poi.purchase_order_id = :purchase_order_id
                 ORDER BY poi.id",
                ['purchase_order_id' => $orderId]
            );

            $this->dbExecute('DELETE FROM purchase_order_receiving_logs WHERE purchase_order_id = :purchase_order_id', ['purchase_order_id' => $orderId]);

            foreach ($orderItems as $index => $orderItem) {
                $receivedQty = max(0, (int) (($items[$index]['received_qty'] ?? $orderItem['quantity'])));
                $this->dbExecute(
                    'INSERT INTO purchase_order_receiving_logs (purchase_order_id, product_name, received_qty, supply_price, received_at, note)
                     VALUES (:purchase_order_id, :product_name, :received_qty, :supply_price, NOW(), NULL)',
                    [
                        'purchase_order_id' => $orderId,
                        'product_name' => (string) $orderItem['product_name'],
                        'received_qty' => $receivedQty,
                        'supply_price' => (float) $orderItem['supply_price'],
                    ]
                );

                $this->dbExecute(
                    'UPDATE products SET stock = stock + :received_qty WHERE id = :id',
                    [
                        'received_qty' => $receivedQty,
                        'id' => (int) $orderItem['product_id'],
                    ]
                );

                $this->dbExecute(
                    'INSERT INTO stock_movements (product_id, movement_type, quantity, note, created_at)
                     VALUES (:product_id, :movement_type, :quantity, :note, NOW())',
                    [
                        'product_id' => (int) $orderItem['product_id'],
                        'movement_type' => 'purchase_receive',
                        'quantity' => $receivedQty,
                        'note' => 'Penerimaan order ' . $orderId,
                    ]
                );
            }

            $this->dbExecute(
                "UPDATE purchase_orders
                 SET status = 'received', received_at = NOW()
                 WHERE id = :id",
                ['id' => $orderId]
            );

            $this->pdo()->commit();

            return $this->inventoryPurchaseRowById($orderId) ?? [];
        } catch (\Throwable $throwable) {
            $this->pdo()->rollBack();
            throw $throwable;
        }
    }

    public function cancelInventoryPurchaseOrder(int $orderId): array
    {
        $this->ensureInventoryWorkflowSchema();
        $this->dbExecute(
            "UPDATE purchase_orders
             SET status = 'cancelled'
             WHERE id = :id",
            ['id' => $orderId]
        );

        return $this->inventoryPurchaseRowById($orderId) ?? [];
    }

    public function saveInventoryOpname(array $payload): array
    {
        if (!$this->inventoryDbEnabled()) {
            return [];
        }

        return $this->withInventoryWorkflowRepair(function () use ($payload): array {
            $this->ensureInventoryWorkflowSchema();

            $sessionId = (int) ($payload['id'] ?? 0);
            $name = trim((string) ($payload['name'] ?? 'Stock Opname'));
            $note = trim((string) ($payload['note'] ?? ''));
            $status = trim((string) ($payload['status'] ?? 'Meninjau'));
            $locationId = (int) ($payload['location_id'] ?? 0);
            $startedBy = trim((string) ($payload['started_by'] ?? 'Rayhan Doni Pramana'));
            $items = array_values(array_filter($payload['items'] ?? [], static fn ($item): bool => is_array($item)));

            if ($locationId <= 0) {
                $locationId = (int) ($this->getLocations()[0]['id'] ?? 1);
            }

            $startedAt = (string) ($payload['started_at'] ?? date('Y-m-d H:i:s'));
            $endedAt = (string) ($payload['ended_at'] ?? '');
            $cancelledNote = trim((string) ($payload['cancelled_note'] ?? ''));
            $cancelledBy = trim((string) ($payload['cancelled_by'] ?? ''));

            $this->pdo()->beginTransaction();
            try {
                if ($sessionId > 0) {
                    $this->dbExecute(
                        "UPDATE stock_opname_sessions
                         SET name = :name,
                             note = :note,
                             status = :status,
                             location_id = :location_id,
                             ended_at = :ended_at,
                             cancelled_note = :cancelled_note,
                             cancelled_by = :cancelled_by
                         WHERE id = :id",
                        [
                            'id' => $sessionId,
                            'name' => $name,
                            'note' => $note,
                            'status' => $status,
                            'location_id' => $locationId,
                            'ended_at' => $endedAt !== '' ? $endedAt : null,
                            'cancelled_note' => $cancelledNote !== '' ? $cancelledNote : null,
                            'cancelled_by' => $cancelledBy !== '' ? $cancelledBy : null,
                        ]
                    );
                    $this->dbExecute('DELETE FROM stock_opname_session_items WHERE session_id = :session_id', ['session_id' => $sessionId]);
                } else {
                    $this->dbExecute(
                        "INSERT INTO stock_opname_sessions (location_id, name, note, status, started_at, ended_at, started_by, cancelled_by, cancelled_note)
                         VALUES (:location_id, :name, :note, :status, :started_at, :ended_at, :started_by, :cancelled_by, :cancelled_note)",
                        [
                            'location_id' => $locationId,
                            'name' => $name,
                            'note' => $note,
                            'status' => $status,
                            'started_at' => $startedAt,
                            'ended_at' => $endedAt !== '' ? $endedAt : null,
                            'started_by' => $startedBy,
                            'cancelled_by' => $cancelledBy !== '' ? $cancelledBy : null,
                            'cancelled_note' => $cancelledNote !== '' ? $cancelledNote : null,
                        ]
                    );
                    $sessionId = (int) $this->pdo()->lastInsertId();
                }

                foreach ($items as $item) {
                    $productId = (int) ($item['product_id'] ?? 0);
                    if ($productId <= 0) {
                        $productId = $this->inventoryProductIdByName((string) ($item['name'] ?? ''));
                    }
                    if ($productId <= 0) {
                        continue;
                    }

                    $expected = (int) ($item['expected'] ?? 0);
                    $counted = (int) ($item['counted'] ?? 0);
                    $diff = $counted - $expected;
                    $itemStatus = $diff === 0 ? 'counted' : 'exception';

                    $this->dbExecute(
                        'INSERT INTO stock_opname_session_items (session_id, product_id, expected_stock, counted_stock, item_status, note)
                         VALUES (:session_id, :product_id, :expected_stock, :counted_stock, :item_status, :note)',
                        [
                            'session_id' => $sessionId,
                            'product_id' => $productId,
                            'expected_stock' => $expected,
                            'counted_stock' => $counted,
                            'item_status' => $itemStatus,
                            'note' => trim((string) ($item['note'] ?? '')),
                        ]
                    );
                }

                $this->pdo()->commit();

                return $this->inventoryOpnameRowById($sessionId) ?? [];
            } catch (\Throwable $throwable) {
                if ($this->pdo()->inTransaction()) {
                    $this->pdo()->rollBack();
                }

                throw $throwable;
            }
        });
    }

    public function recountInventoryOpname(int $sessionId): array
    {
        if (!$this->inventoryDbEnabled()) {
            return [];
        }

        return $this->withInventoryWorkflowRepair(function () use ($sessionId): array {
            $this->ensureInventoryWorkflowSchema();
            $this->dbExecute(
                "UPDATE stock_opname_sessions
                 SET status = 'Perhitungan', ended_at = NULL, cancelled_by = NULL, cancelled_note = NULL
                 WHERE id = :id",
                ['id' => $sessionId]
            );

            return $this->inventoryOpnameRowById($sessionId) ?? [];
        });
    }

    public function cancelInventoryOpname(int $sessionId, string $note, string $cancelledBy): array
    {
        if (!$this->inventoryDbEnabled()) {
            return [];
        }

        return $this->withInventoryWorkflowRepair(function () use ($sessionId, $note, $cancelledBy): array {
            $this->ensureInventoryWorkflowSchema();
            $this->dbExecute(
                "UPDATE stock_opname_sessions
             SET status = 'Cancelled',
                     ended_at = NOW(),
                     cancelled_by = :cancelled_by,
                     cancelled_note = :cancelled_note
                 WHERE id = :id",
                [
                    'id' => $sessionId,
                    'cancelled_by' => $cancelledBy,
                    'cancelled_note' => trim($note),
                ]
            );

            return $this->inventoryOpnameRowById($sessionId) ?? [];
        });
    }

    public function completeInventoryOpname(int $sessionId): array
    {
        if (!$this->inventoryDbEnabled()) {
            return [];
        }

        return $this->withInventoryWorkflowRepair(function () use ($sessionId): array {
            $this->ensureInventoryWorkflowSchema();
            $this->pdo()->beginTransaction();

            try {
                $items = $this->dbAll(
                    'SELECT product_id, expected_stock, counted_stock
                     FROM stock_opname_session_items
                     WHERE session_id = :session_id',
                    ['session_id' => $sessionId]
                );

                foreach ($items as $item) {
                    $countedStock = (int) $item['counted_stock'];
                    $expectedStock = (int) $item['expected_stock'];
                    $difference = $countedStock - $expectedStock;

                    if ($this->tableExists('products') && $this->columnExists('products', 'stock')) {
                        $assignments = ['stock = :stock'];
                        $params = [
                            'stock' => $countedStock,
                            'id' => (int) $item['product_id'],
                        ];

                        // Some schemas use status as 'Aman/Kosong', others use 'active'/'inactive'.
                        if ($this->columnExists('products', 'status')) {
                            $assignments[] = 'status = :status';
                            $params['status'] = $countedStock > 0 ? 'Aman' : 'Kosong';
                        }

                        $this->dbExecute(
                            sprintf('UPDATE products SET %s WHERE id = :id', implode(', ', $assignments)),
                            $params
                        );
                    }

                    if ($difference !== 0 && $this->tableExists('stock_movements')) {
                        $this->dbExecute(
                            'INSERT INTO stock_movements (product_id, movement_type, quantity, note, created_at)
                             VALUES (:product_id, :movement_type, :quantity, :note, NOW())',
                            [
                                'product_id' => (int) $item['product_id'],
                                'movement_type' => 'opname_adjustment',
                                'quantity' => $difference,
                                'note' => 'Stok opname #' . $sessionId,
                            ]
                        );
                    }
                }

                $this->dbExecute(
                    "UPDATE stock_opname_sessions
                 SET status = 'Completed', ended_at = NOW()
                     WHERE id = :id",
                    ['id' => $sessionId]
                );

                $this->pdo()->commit();

                return $this->inventoryOpnameRowById($sessionId) ?? [];
            } catch (\Throwable $throwable) {
                if ($this->pdo()->inTransaction()) {
                    $this->pdo()->rollBack();
                }

                throw $throwable;
            }
        });
    }

    public function inventoryProductById(int $productId): ?array
    {
        foreach ($this->getProducts() as $product) {
            if ((int) ($product['id'] ?? 0) === $productId) {
                return $product;
            }
        }

        return null;
    }

    public function getInventoryProductHistory(int $productId): array
    {
        $product = $this->inventoryProductById($productId);
        if ($product === null) {
            return [];
        }

        if (!$this->inventoryDbEnabled() || !$this->tableExists('stock_movements')) {
            return [];
        }

        $rows = $this->dbAll(
            'SELECT movement_type, quantity, note, created_at
             FROM stock_movements
             WHERE product_id = :product_id
             ORDER BY created_at DESC, id DESC',
            ['product_id' => $productId]
        );

        if ($rows === []) {
            return [[
                'date' => '28 April 2026',
                'time' => '15:39:51',
                'staffPrimary' => 'System',
                'staffSecondary' => '-',
                'location' => $this->getLocations()[0]['name'] ?? 'Star Salon',
                'action' => 'New stock',
                'delta' => (int) ($product['stock'] ?? 0),
                'cost' => (float) ($product['price'] ?? 0),
                'realQty' => (int) ($product['stock'] ?? 0),
            ]];
        }

        $runningQty = (int) ($product['stock'] ?? 0);
        $locationName = $this->getLocations()[0]['name'] ?? 'Star Salon';

        return array_map(function (array $row) use (&$runningQty, $locationName, $product): array {
            $delta = (int) $row['quantity'];
            $realQty = $runningQty;
            $runningQty -= $delta;

            $date = new \DateTimeImmutable((string) $row['created_at']);
            $note = trim((string) ($row['note'] ?? ''));

            return [
                'date' => $date->format('d F Y'),
                'time' => $date->format('H:i:s'),
                'staffPrimary' => 'System',
                'staffSecondary' => '-',
                'location' => $locationName,
                'action' => $this->inventoryMovementLabel((string) $row['movement_type'], $note),
                'delta' => $delta,
                'cost' => (float) ($product['price'] ?? 0),
                'realQty' => $realQty,
            ];
        }, $rows);
    }

    private function inventoryPurchaseRowById(int $orderId): ?array
    {
        foreach ($this->inventoryPurchaseRows() as $row) {
            if ((int) ($row['id'] ?? 0) === $orderId) {
                return $row;
            }
        }

        return null;
    }

    private function inventoryOpnameRowById(int $sessionId): ?array
    {
        foreach ($this->inventoryOpnameRows() as $row) {
            if ((int) ($row['id'] ?? 0) === $sessionId) {
                return $row;
            }
        }

        return null;
    }

    private function inventorySupplierById(int $supplierId): ?array
    {
        foreach ($this->getInventorySuppliers() as $supplier) {
            if ((int) ($supplier['id'] ?? 0) === $supplierId) {
                return $supplier;
            }
        }

        return null;
    }

    private function inventoryEnsureNamedRecord(string $table, string $name): ?int
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }

        $existing = $this->dbOne("SELECT id FROM {$table} WHERE LOWER(name) = LOWER(:name) LIMIT 1", ['name' => $name]);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        $this->dbExecute("INSERT INTO {$table} (name) VALUES (:name)", ['name' => $name]);

        return (int) $this->pdo()->lastInsertId();
    }

    private function inventoryLocationIdByName(string $name): int
    {
        $name = trim($name);
        foreach ($this->getLocations() as $location) {
            if (strcasecmp((string) $location['name'], $name) === 0) {
                return (int) $location['id'];
            }
        }

        return (int) ($this->getLocations()[0]['id'] ?? 1);
    }

    private function inventoryProductIdByName(string $name): int
    {
        $row = $this->dbOne('SELECT id FROM products WHERE LOWER(name) = LOWER(:name) LIMIT 1', ['name' => trim($name)]);

        return $row !== null ? (int) $row['id'] : 0;
    }

    private function nextPurchaseReference(): string
    {
        $row = $this->dbOne("SELECT reference FROM purchase_orders ORDER BY id DESC LIMIT 1");
        $current = 0;
        if ($row !== null && preg_match('/^P(\d+)$/i', (string) $row['reference'], $matches) === 1) {
            $current = (int) $matches[1];
        }

        return 'P' . str_pad((string) ($current + 1), 6, '0', STR_PAD_LEFT);
    }

    private function inventoryMovementLabel(string $movementType, string $note): string
    {
        if ($note !== '') {
            $parts = preg_split('/\s+-\s+/', $note, 2);
            if (is_array($parts) && isset($parts[0]) && trim((string) $parts[0]) !== '') {
                return trim((string) $parts[0]);
            }
        }

        return match (strtolower(trim($movementType))) {
            'stock_in' => 'New stock',
            'stock_out' => 'Other',
            'purchase_receive' => 'Penerimaan pesanan',
            'opname_adjustment' => 'Stok opname',
            default => 'Penyesuaian stok',
        };
    }

    private function ensureInventoryWorkflowSchema(): void
    {
        if (!$this->canUsePdo() || $this->inventorySchemaEnsured) {
            return;
        }

        foreach ([
            'stock_opname_session_items',
            'stock_opname_sessions',
            'purchase_order_receiving_logs',
            'purchase_order_items',
        ] as $workflowTable) {
            if ($this->tableListedInSchema($workflowTable) && !$this->tableCanBeQueried($workflowTable)) {
                $this->pdo()->exec(sprintf('DROP TABLE IF EXISTS `%s`', $workflowTable));
            }
        }

        $statements = [
            'CREATE TABLE IF NOT EXISTS locations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100) NULL,
                type VARCHAR(50) DEFAULT \'storage\',
                status VARCHAR(50) DEFAULT \'active\',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT NULL
            )',
            'CREATE TABLE IF NOT EXISTS brands (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL
            )',
            'ALTER TABLE suppliers
                ADD COLUMN IF NOT EXISTS description TEXT NULL,
                ADD COLUMN IF NOT EXISTS contact_name VARCHAR(120) NULL,
                ADD COLUMN IF NOT EXISTS website VARCHAR(160) NULL,
                ADD COLUMN IF NOT EXISTS address TEXT NULL,
                ADD COLUMN IF NOT EXISTS city VARCHAR(120) NULL,
                ADD COLUMN IF NOT EXISTS country VARCHAR(120) NULL,
                ADD COLUMN IF NOT EXISTS postal_code VARCHAR(30) NULL',
            'CREATE TABLE IF NOT EXISTS purchase_orders (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                supplier_id BIGINT UNSIGNED NOT NULL,
                location_id BIGINT UNSIGNED NULL,
                reference VARCHAR(60) NOT NULL UNIQUE,
                order_type VARCHAR(30) NOT NULL DEFAULT \'Order\',
                order_date DATE NOT NULL,
                status VARCHAR(30) NOT NULL,
                note TEXT NULL,
                total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                ordered_at DATETIME NULL,
                received_at DATETIME NULL
            )',
            "ALTER TABLE purchase_orders
                ADD COLUMN IF NOT EXISTS location_id BIGINT UNSIGNED NULL,
                ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NOT NULL DEFAULT 'Order',
                ADD COLUMN IF NOT EXISTS note TEXT NULL,
                ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS ordered_at DATETIME NULL,
                ADD COLUMN IF NOT EXISTS received_at DATETIME NULL",
            'CREATE TABLE IF NOT EXISTS purchase_order_items (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                purchase_order_id BIGINT UNSIGNED NOT NULL,
                product_id BIGINT UNSIGNED NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                supply_price DECIMAL(12,2) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
            'CREATE TABLE IF NOT EXISTS purchase_order_receiving_logs (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                purchase_order_id BIGINT UNSIGNED NOT NULL,
                product_name VARCHAR(160) NOT NULL,
                received_qty INT NOT NULL DEFAULT 0,
                supply_price DECIMAL(12,2) NOT NULL DEFAULT 0,
                received_at DATETIME NOT NULL,
                note VARCHAR(255) NULL
            )',
            'CREATE TABLE IF NOT EXISTS stock_movements (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                product_id BIGINT UNSIGNED NOT NULL,
                movement_type VARCHAR(40) NOT NULL,
                quantity INT NOT NULL,
                note VARCHAR(255) NULL,
                created_at DATETIME NOT NULL
            )',
            'CREATE TABLE IF NOT EXISTS stock_opname_sessions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                location_id BIGINT UNSIGNED NULL,
                name VARCHAR(160) NOT NULL,
                note TEXT NULL,
                status VARCHAR(30) NOT NULL DEFAULT \'Meninjau\',
                started_at DATETIME NOT NULL,
                ended_at DATETIME NULL,
                started_by VARCHAR(120) NULL,
                cancelled_by VARCHAR(120) NULL,
                cancelled_note TEXT NULL
            )',
            'CREATE TABLE IF NOT EXISTS stock_opname_session_items (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                session_id BIGINT UNSIGNED NOT NULL,
                product_id BIGINT UNSIGNED NOT NULL,
                expected_stock INT NOT NULL DEFAULT 0,
                counted_stock INT NOT NULL DEFAULT 0,
                item_status VARCHAR(30) NOT NULL DEFAULT \'counted\',
                note VARCHAR(255) NULL
            )',
            'CREATE TABLE IF NOT EXISTS stock_opnames (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                product_id BIGINT UNSIGNED NOT NULL,
                expected_stock INT NOT NULL,
                actual_stock INT NOT NULL,
                note VARCHAR(255) NULL,
                created_at DATETIME NOT NULL
            )',
        ];

        foreach ($statements as $statement) {
            try {
                $this->pdo()->exec($this->resolveSqlTableAliases($statement));
            } catch (\Throwable $throwable) {
                $trimmed = ltrim($statement);
                if ($this->isMissingOrBrokenTableException($throwable)) {
                    if (str_starts_with($trimmed, 'ALTER TABLE')) {
                        continue;
                    }

                    if (str_contains($trimmed, 'purchase_order_items') || str_contains($trimmed, 'purchase_order_receiving_logs')) {
                        continue;
                    }
                }

                throw $throwable;
            }
        }

        $this->tableExistsCache = [];
        $this->columnExistsCache = [];
        $this->inventorySchemaEnsured = true;
    }

    private function ensureStaffScheduleSchema(): void
    {
        if (!$this->usingDb() || $this->staffScheduleSchemaEnsured) {
            return;
        }

        $statements = [
            'CREATE TABLE IF NOT EXISTS staff_shifts (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                staff_id BIGINT UNSIGNED NOT NULL,
                shift_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                repeat_mode VARCHAR(20) NOT NULL DEFAULT \'none\',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
            'CREATE TABLE IF NOT EXISTS staff_attendance (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                staff_id BIGINT UNSIGNED NOT NULL,
                attendance_date DATE NOT NULL,
                shift_start TIME NOT NULL,
                shift_end TIME NOT NULL,
                clock_in TIME NOT NULL,
                clock_out TIME NOT NULL,
                source VARCHAR(40) NOT NULL DEFAULT \'-\',
                status VARCHAR(30) NOT NULL DEFAULT \'Ontime\',
                selfie_in_score DECIMAL(5,2) NOT NULL DEFAULT 0,
                selfie_out_score DECIMAL(5,2) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )',
        ];

        foreach ($statements as $statement) {
            $this->pdo()->exec($statement);
        }

        $this->tableExistsCache = [];
        $this->columnExistsCache = [];
        $this->staffScheduleSchemaEnsured = true;
    }

    private function ensureStaffScheduleSeedData(): void
    {
        if (!$this->usingDb() || $this->staffScheduleSeedEnsured) {
            return;
        }

        $staffRows = $this->dbAll('SELECT id FROM staff WHERE deleted_at IS NULL ORDER BY id ASC');
        if ($staffRows === []) {
            $this->staffScheduleSeedEnsured = true;

            return;
        }

        $shiftCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM staff_shifts')['total'] ?? 0));
        if ($shiftCount === 0) {
            foreach ($staffRows as $index => $staffRow) {
                $shiftDate = (new \DateTimeImmutable('today'))->modify('-' . $index . ' days')->format('Y-m-d');
                $this->dbExecute(
                    "INSERT INTO staff_shifts (staff_id, shift_date, start_time, end_time, repeat_mode)
                     VALUES (:staff_id, :shift_date, :start_time, :end_time, :repeat_mode)",
                    [
                        'staff_id' => (int) $staffRow['id'],
                        'shift_date' => $shiftDate,
                        'start_time' => '08:00:00',
                        'end_time' => '17:00:00',
                        'repeat_mode' => 'weekly',
                    ]
                );
            }
        }

        $attendanceCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM staff_attendance')['total'] ?? 0));
        if ($attendanceCount === 0) {
            foreach ($staffRows as $index => $staffRow) {
                $attendanceDate = (new \DateTimeImmutable('today'))->modify('-' . $index . ' days')->format('Y-m-d');
                $status = $index === 0 ? 'Ontime' : ($index % 2 === 0 ? 'Late' : 'Overtime');
                $clockIn = $status === 'Late' ? '08:17:00' : '08:00:00';
                $clockOut = $status === 'Overtime' ? '17:48:00' : '17:00:00';

                $this->dbExecute(
                    "INSERT INTO staff_attendance
                     (staff_id, attendance_date, shift_start, shift_end, clock_in, clock_out, source, status, selfie_in_score, selfie_out_score)
                     VALUES
                     (:staff_id, :attendance_date, :shift_start, :shift_end, :clock_in, :clock_out, :source, :status, :selfie_in_score, :selfie_out_score)",
                    [
                        'staff_id' => (int) $staffRow['id'],
                        'attendance_date' => $attendanceDate,
                        'shift_start' => '08:00:00',
                        'shift_end' => '17:00:00',
                        'clock_in' => $clockIn,
                        'clock_out' => $clockOut,
                        'source' => 'Manual',
                        'status' => $status,
                        'selfie_in_score' => 0,
                        'selfie_out_score' => 0,
                    ]
                );
            }
        }

        $this->staffScheduleSeedEnsured = true;
    }

    private function ensureInventoryWorkflowSeedData(): void
    {
        if (!$this->inventoryDbEnabled() || $this->inventorySeedEnsured) {
            return;
        }

        if ($this->tableExists('locations')) {
            $locationCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM locations')['total'] ?? 0));
            if ($locationCount === 0) {
                $hasAddress = $this->columnExists('locations', 'address');
                $hasIsActive = $this->columnExists('locations', 'is_active');
                $columns = ['id', 'name'];
                $placeholders = ['1', ':name'];
                $params = ['name' => 'Star Salon'];

                if ($hasAddress) {
                    $columns[] = 'address';
                    $placeholders[] = ':address';
                    $params['address'] = 'Jl. Raya Inpres No.04, RT.4/RW.10, Kp. Tengah, Kec. Kramat jati, Kota Jakarta Timur';
                }

                if ($hasIsActive) {
                    $columns[] = 'is_active';
                    $placeholders[] = '1';
                }

                $this->dbExecute(
                    sprintf(
                        'INSERT INTO locations (%s) VALUES (%s)',
                        implode(', ', $columns),
                        implode(', ', $placeholders)
                    ),
                    $params
                );
            }
        }

        if ($this->tableExists('suppliers')) {
            $firstSupplier = $this->dbOne('SELECT id FROM suppliers ORDER BY id ASC LIMIT 1');
            if ($firstSupplier !== null && $this->columnExists('suppliers', 'contact_name')) {
                $this->dbExecute(
                    "UPDATE suppliers
                     SET description = COALESCE(NULLIF(description, ''), :description),
                         contact_name = COALESCE(NULLIF(contact_name, ''), :contact_name),
                         website = COALESCE(NULLIF(website, ''), :website),
                         address = COALESCE(NULLIF(address, ''), :address),
                         city = COALESCE(NULLIF(city, ''), :city),
                         country = COALESCE(NULLIF(country, ''), :country),
                         postal_code = COALESCE(NULLIF(postal_code, ''), :postal_code)
                     WHERE id = :id",
                    [
                        'id' => (int) $firstSupplier['id'],
                        'description' => 'Supplier utama produk retail dan konsumsi.',
                        'contact_name' => 'Ayu Permata',
                        'website' => 'https://supplier.local/glow-source',
                        'address' => 'Silom Trade Center',
                        'city' => 'Bangkok',
                        'country' => 'Thailand',
                        'postal_code' => '10500',
                    ]
                );
            }
        }

        if ($this->tableExists('suppliers')) {
            $supplierCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM suppliers')['total'] ?? 0));
            if ($supplierCount === 0) {
                $hasPhone = $this->columnExists('suppliers', 'phone');
                $hasEmail = $this->columnExists('suppliers', 'email');
                $hasAddress = $this->columnExists('suppliers', 'address');
                $columns = ['name'];
                $placeholders = [':name'];
                $params = ['name' => 'Wardah'];

                if ($hasPhone) {
                    $columns[] = 'phone';
                    $placeholders[] = ':phone';
                    $params['phone'] = '+62 812 0000 1111';
                }

                if ($hasEmail) {
                    $columns[] = 'email';
                    $placeholders[] = ':email';
                    $params['email'] = 'wardah@gmail.com';
                }

                if ($hasAddress) {
                    $columns[] = 'address';
                    $placeholders[] = ':address';
                    $params['address'] = 'Jakarta';
                }

                $this->dbExecute(
                    sprintf(
                        'INSERT INTO suppliers (%s) VALUES (%s)',
                        implode(', ', $columns),
                        implode(', ', $placeholders)
                    ),
                    $params
                );
            }
        }

        $supplierId = (int) (($this->dbOne('SELECT id FROM suppliers ORDER BY id ASC LIMIT 1')['id'] ?? 0));

        if ($this->tableExists('products')) {
            $productCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM products')['total'] ?? 0));
            if ($productCount === 0 && $supplierId > 0) {
                $hasSupplierId = $this->columnExists('products', 'supplier_id');
                $hasSku = $this->columnExists('products', 'sku');
                $hasCode = $this->columnExists('products', 'code');
                $hasSellPrice = $this->columnExists('products', 'sell_price');
                $hasSellingPrice = $this->columnExists('products', 'selling_price');

                $insertSeedProduct = function (string $name, string $code, int $stock, float $price) use ($supplierId, $hasSupplierId, $hasSku, $hasCode, $hasSellPrice, $hasSellingPrice): void {
                    $columns = ['name', 'stock', 'status'];
                    $placeholders = [':name', ':stock', ':status'];
                    $params = [
                        'name' => $name,
                        'stock' => $stock,
                        'status' => 'Aman',
                    ];

                    if ($hasSupplierId) {
                        $columns[] = 'supplier_id';
                        $placeholders[] = ':supplier_id';
                        $params['supplier_id'] = $supplierId;
                    }

                    if ($hasSku) {
                        $columns[] = 'sku';
                        $placeholders[] = ':sku';
                        $params['sku'] = $code;
                    } elseif ($hasCode) {
                        $columns[] = 'code';
                        $placeholders[] = ':code';
                        $params['code'] = $code;
                    }

                    if ($hasSellPrice) {
                        $columns[] = 'sell_price';
                        $placeholders[] = ':sell_price';
                        $params['sell_price'] = $price;
                    } elseif ($hasSellingPrice) {
                        $columns[] = 'selling_price';
                        $placeholders[] = ':selling_price';
                        $params['selling_price'] = $price;
                    }

                    $this->dbExecute(
                        sprintf(
                            'INSERT INTO products (%s) VALUES (%s)',
                            implode(', ', $columns),
                            implode(', ', $placeholders)
                        ),
                        $params
                    );
                };

                $insertSeedProduct('Hair Serum Wardah - Per Pump', 'INV-0001', 7, 0);
                $insertSeedProduct('Hair Serum Wardah - 500ml', 'INV-0002', 10, 25000);
            }
        }

        $priceSelect = $this->columnExists('products', 'sell_price')
            ? 'sell_price'
            : ($this->columnExists('products', 'selling_price') ? 'selling_price AS sell_price' : '0 AS sell_price');
        $productRows = $this->dbAll("SELECT id, name, stock, {$priceSelect} FROM products ORDER BY id ASC LIMIT 2");
        $locationId = 1;
        if ($this->tableExists('locations')) {
            $locationId = (int) (($this->dbOne('SELECT id FROM locations ORDER BY id ASC LIMIT 1')['id'] ?? 1));
        }

        if ($supplierId > 0 && count($productRows) >= 2 && $this->tableExists('purchase_orders')) {
            $purchaseCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM purchase_orders')['total'] ?? 0));
            if ($purchaseCount === 0) {
                $this->dbExecute(
                    "INSERT INTO purchase_orders
                     (id, supplier_id, location_id, reference, order_type, order_date, status, note, total_amount, ordered_at, received_at)
                     VALUES
                     (1, :supplier_id, :location_id, :reference, :order_type, :order_date, :status, :note, :total_amount, :ordered_at, :received_at)",
                    [
                        'supplier_id' => $supplierId,
                        'location_id' => $locationId,
                        'reference' => 'P000001',
                        'order_type' => 'Order',
                        'order_date' => '2026-04-28',
                        'status' => 'received',
                        'note' => '',
                        'total_amount' => 250000,
                        'ordered_at' => '2026-04-28 10:00:00',
                        'received_at' => '2026-04-28 18:30:10',
                    ]
                );
                $this->dbExecute(
                    "INSERT INTO purchase_orders
                     (id, supplier_id, location_id, reference, order_type, order_date, status, note, total_amount, ordered_at, received_at)
                     VALUES
                     (2, :supplier_id, :location_id, :reference, :order_type, :order_date, :status, :note, :total_amount, :ordered_at, :received_at)",
                    [
                        'supplier_id' => $supplierId,
                        'location_id' => $locationId,
                        'reference' => 'P000002',
                        'order_type' => 'Order',
                        'order_date' => '2026-04-28',
                        'status' => 'ordered',
                        'note' => 'test',
                        'total_amount' => 125000,
                        'ordered_at' => '2026-04-28 12:00:00',
                        'received_at' => null,
                    ]
                );

                $this->dbExecute(
                    'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, supply_price)
                     VALUES (:purchase_order_id, :product_id, :quantity, :supply_price)',
                    [
                        'purchase_order_id' => 1,
                        'product_id' => (int) $productRows[1]['id'],
                        'quantity' => 10,
                        'supply_price' => 25000,
                    ]
                );
                $this->dbExecute(
                    'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, supply_price)
                     VALUES (:purchase_order_id, :product_id, :quantity, :supply_price)',
                    [
                        'purchase_order_id' => 2,
                        'product_id' => (int) $productRows[1]['id'],
                        'quantity' => 5,
                        'supply_price' => 25000,
                    ]
                );

                $this->dbExecute(
                    "INSERT INTO purchase_order_receiving_logs (purchase_order_id, product_name, received_qty, supply_price, received_at, note)
                     VALUES (1, :product_name, 10, 25000, '2026-04-28 18:30:10', 'Penerimaan penuh')",
                    [
                        'product_name' => (string) $productRows[1]['name'],
                    ]
                );
            }
        }

        if (count($productRows) >= 2 && $this->tableExists('stock_opname_sessions')) {
            $opnameCount = (int) (($this->dbOne('SELECT COUNT(*) AS total FROM stock_opname_sessions')['total'] ?? 0));
            if ($opnameCount === 0) {
                $this->dbExecute(
                    "INSERT INTO stock_opname_sessions
                     (id, location_id, name, note, status, started_at, ended_at, started_by, cancelled_by, cancelled_note)
                     VALUES
                     (1, :location_id, :name, :note, :status, :started_at, :ended_at, :started_by, :cancelled_by, :cancelled_note)",
                    [
                        'location_id' => $locationId,
                        'name' => 'Stock Opname #5',
                        'note' => 'Tidak ada catatan',
                        'status' => 'Meninjau',
                        'started_at' => '2026-05-01 13:11:00',
                        'ended_at' => null,
                        'started_by' => 'Rayhan Doni Pramana',
                        'cancelled_by' => null,
                        'cancelled_note' => null,
                    ]
                );
                $this->dbExecute(
                    "INSERT INTO stock_opname_sessions
                     (id, location_id, name, note, status, started_at, ended_at, started_by, cancelled_by, cancelled_note)
                     VALUES
                     (2, :location_id, :name, :note, :status, :started_at, :ended_at, :started_by, :cancelled_by, :cancelled_note)",
                    [
                        'location_id' => $locationId,
                        'name' => 'Stock Opname #4',
                        'note' => 'ga jadi',
                'status' => 'Cancelled',
                        'started_at' => '2026-05-01 13:10:00',
                        'ended_at' => '2026-05-01 15:21:00',
                        'started_by' => 'Rayhan Doni Pramana',
                        'cancelled_by' => 'Rayhan Doni Pramana',
                        'cancelled_note' => 'ga jadi',
                    ]
                );

                $this->dbExecute(
                    'INSERT INTO stock_opname_session_items (session_id, product_id, expected_stock, counted_stock, item_status, note)
                     VALUES (:session_id, :product_id, :expected_stock, :counted_stock, :item_status, :note)',
                    [
                        'session_id' => 1,
                        'product_id' => (int) $productRows[0]['id'],
                        'expected_stock' => 7,
                        'counted_stock' => 7,
                        'item_status' => 'counted',
                        'note' => null,
                    ]
                );
                $this->dbExecute(
                    'INSERT INTO stock_opname_session_items (session_id, product_id, expected_stock, counted_stock, item_status, note)
                     VALUES (:session_id, :product_id, :expected_stock, :counted_stock, :item_status, :note)',
                    [
                        'session_id' => 1,
                        'product_id' => (int) $productRows[1]['id'],
                        'expected_stock' => 10,
                        'counted_stock' => 8,
                        'item_status' => 'mismatch',
                        'note' => null,
                    ]
                );
                $this->dbExecute(
                    'INSERT INTO stock_opname_session_items (session_id, product_id, expected_stock, counted_stock, item_status, note)
                     VALUES (:session_id, :product_id, :expected_stock, :counted_stock, :item_status, :note)',
                    [
                        'session_id' => 2,
                        'product_id' => (int) $productRows[0]['id'],
                        'expected_stock' => 8,
                        'counted_stock' => 7,
                        'item_status' => 'mismatch',
                        'note' => 'ga jadi',
                    ]
                );
                $this->dbExecute(
                    'INSERT INTO stock_opname_session_items (session_id, product_id, expected_stock, counted_stock, item_status, note)
                     VALUES (:session_id, :product_id, :expected_stock, :counted_stock, :item_status, :note)',
                    [
                        'session_id' => 2,
                        'product_id' => (int) $productRows[1]['id'],
                        'expected_stock' => 10,
                        'counted_stock' => 8,
                        'item_status' => 'mismatch',
                        'note' => 'ga jadi',
                    ]
                );
            }
        }

        $this->inventorySeedEnsured = true;
    }

    private function normalizeInventoryPurchaseStatus(string $status): string
    {
        $normalized = strtolower(trim($status));

        return match ($normalized) {
            'received', 'diterima' => 'Received',
            'cancelled', 'canceled', 'dibatalkan' => 'Cancelled',
            default => 'Ordered',
        };
    }

    private function normalizeInventoryOpnameStatus(string $status): string
    {
        $normalized = strtolower(trim($status));

        return match ($normalized) {
            'completed', 'complete', 'komplit' => 'Completed',
            'cancelled', 'canceled', 'dibatalkan' => 'Cancelled',
            'counting', 'perhitungan' => 'Perhitungan',
            default => 'Meninjau',
        };
    }

    private function humanDate(string $dateTime): string
    {
        return (new \DateTimeImmutable($dateTime))->format('d M Y');
    }

    private function humanDateTime(string $dateTime): string
    {
        return (new \DateTimeImmutable($dateTime))->format('d M Y, H:i');
    }

    private function rankItems(string $type): array
    {
        $bucket = [];

        foreach ($this->getTransactions() as $transaction) {
            foreach ($transaction['items'] as $item) {
                if ($item['type'] !== $type) {
                    continue;
                }

                $bucket[$item['name']] = ($bucket[$item['name']] ?? 0) + $item['qty'];
            }
        }

        arsort($bucket);

        return array_map(fn (string $label, int $value): array => ['label' => $label, 'value' => $value], array_keys($bucket), array_values($bucket));
    }

    private function rankStaff(): array
    {
        $scores = [];

        foreach ($this->getBookings() as $booking) {
            if (!in_array($booking['status'], ['completed', 'confirmed'], true)) {
                continue;
            }

            $staff = $this->findStaff($booking['staff_id']);

            if ($staff !== null) {
                $scores[$staff['name']] = ($scores[$staff['name']] ?? 0) + 1;
            }
        }

        arsort($scores);

        return array_map(fn (string $label, int $value): array => ['label' => $label, 'value' => $value], array_keys($scores), array_values($scores));
    }

    private function sumItemsByType(array $items, string $type): float
    {
        return array_reduce($items, function (float $sum, array $item) use ($type): float {
            return $item['type'] === $type ? $sum + ($item['qty'] * $item['price']) : $sum;
        }, 0.0);
    }

    private function allPermissionKeys(): array
    {
        $permissions = [];

        foreach ($this->permissions['catalog'] as $module) {
            $permissions = array_merge($permissions, array_keys($module['permissions']));
        }

        return $permissions;
    }

    private function bootSessionState(): void
    {
        $_SESSION['starstyle'] ??= [
            'bookings' => [],
            'booking_blocks' => [],
            'transactions' => [],
            'staff_permissions' => [],
            'activity_logs' => [],
        ];
    }

    private function nextId(array $items, int $fallback): int
    {
        if ($items === []) {
            return $fallback;
        }

        $ids = array_column($items, 'id');

        return max($ids) + 1;
    }

    private function hasOverlap(\DateTimeImmutable $start, \DateTimeImmutable $end, array $bookings, array $blocks): bool
    {
        foreach ($bookings as $booking) {
            $existingStart = new \DateTimeImmutable($booking['start_at']);
            $existingEnd = new \DateTimeImmutable($booking['end_at']);

            if ($start < $existingEnd && $end > $existingStart) {
                return true;
            }
        }

        foreach ($blocks as $block) {
            $existingStart = new \DateTimeImmutable($block['start_at']);
            $existingEnd = new \DateTimeImmutable($block['end_at']);

            if ($start < $existingEnd && $end > $existingStart) {
                return true;
            }
        }

        return false;
    }

    private function resolveCustomer(string $name, string $phone): int
    {
        if ($this->usingDb()) {
            $existing = $this->dbOne(
                "SELECT id
                 FROM customers
                 WHERE deleted_at IS NULL
                   AND (
                        LOWER(name) = LOWER(:name_match)
                        OR (:phone_match <> '' AND phone = :phone_value)
                   )
                 ORDER BY id ASC
                 LIMIT 1",
                [
                    'name_match' => $name,
                    'phone_match' => $phone,
                    'phone_value' => $phone,
                ]
            );

            if ($existing !== null) {
                return (int) $existing['id'];
            }

            $memberId = 'MEM-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
            $this->dbExecute(
                "INSERT INTO customers (member_id, name, phone, status)
                 VALUES (:member_id, :name, :phone, 'Aktif')",
                [
                    'member_id' => $memberId,
                    'name' => $name !== '' ? $name : 'Walk In Customer',
                    'phone' => $phone !== '' ? $phone : null,
                ]
            );

            return (int) $this->pdo()->lastInsertId();
        }

        foreach ($this->getCustomers() as $customer) {
            if (strcasecmp($customer['name'], $name) === 0 || $customer['phone'] === $phone) {
                return $customer['id'];
            }
        }

        return 1;
    }
}
