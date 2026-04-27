-- Run this in phpMyAdmin on your production database
-- All statements use IF NOT EXISTS so it's safe to run multiple times

-- ── MaintenanceRequest ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `MaintenanceRequest` (
  `id`          varchar(191) NOT NULL,
  `userId`      varchar(191) NOT NULL,
  `tenantId`    varchar(191) NOT NULL,
  `title`       varchar(191) NOT NULL,
  `description` longtext,
  `category`    varchar(191) NOT NULL DEFAULT 'OTHER',
  `priority`    varchar(191) NOT NULL DEFAULT 'MEDIUM',
  `status`      varchar(191) NOT NULL DEFAULT 'OPEN',
  `notes`       longtext,
  `resolvedAt`  datetime(3)  DEFAULT NULL,
  `createdAt`   datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `MaintenanceRequest_userId_status_idx` (`userId`, `status`),
  KEY `MaintenanceRequest_tenantId_idx` (`tenantId`),
  CONSTRAINT `MaintenanceRequest_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `User`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MaintenanceRequest_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── TenantDocument ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `TenantDocument` (
  `id`        varchar(191) NOT NULL,
  `userId`    varchar(191) NOT NULL,
  `tenantId`  varchar(191) NOT NULL,
  `name`      varchar(191) NOT NULL,
  `fileName`  varchar(191) NOT NULL,
  `mimeType`  varchar(191) NOT NULL,
  `size`      int          NOT NULL,
  `createdAt` datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `TenantDocument_tenantId_idx` (`tenantId`),
  KEY `TenantDocument_userId_idx`   (`userId`),
  CONSTRAINT `TenantDocument_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `User`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TenantDocument_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── MeterReading ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `MeterReading` (
  `id`          varchar(191) NOT NULL,
  `userId`      varchar(191) NOT NULL,
  `tenantId`    varchar(191) NOT NULL,
  `month`       varchar(191) NOT NULL,
  `previous`    double       NOT NULL,
  `current`     double       NOT NULL,
  `ratePerUnit` double       NOT NULL,
  `unitsUsed`   double       NOT NULL,
  `amount`      double       NOT NULL,
  `chargeId`    varchar(191) DEFAULT NULL,
  `photoPath`   varchar(191) DEFAULT NULL,
  `notes`       longtext,
  `createdAt`   datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MeterReading_chargeId_key`        (`chargeId`),
  UNIQUE KEY `MeterReading_tenantId_month_key`  (`tenantId`, `month`),
  KEY          `MeterReading_userId_month_idx`  (`userId`, `month`),
  CONSTRAINT `MeterReading_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `User`         (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `MeterReading_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`       (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `MeterReading_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `OneTimeCharge`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── TenantSession (tenant portal logins) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `TenantSession` (
  `id`        varchar(191) NOT NULL,
  `tenantId`  varchar(191) NOT NULL,
  `token`     varchar(191) NOT NULL,
  `expiresAt` datetime(3)  NOT NULL,
  `createdAt` datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantSession_token_key` (`token`),
  CONSTRAINT `TenantSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── GlobalSetting (app-wide config) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `GlobalSetting` (
  `key`   varchar(191) NOT NULL,
  `value` longtext     NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tenant portal columns (add only if missing) ───────────────────────────────
-- Run each ALTER separately if you get "Duplicate column" errors, just skip it.
ALTER TABLE `Tenant`
  ADD COLUMN IF NOT EXISTS `portalEnabled` tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `portalToken`   varchar(191) DEFAULT NULL;

-- Unique index for portalToken (ignore error if already exists)
ALTER TABLE `Tenant` ADD UNIQUE INDEX `Tenant_portalToken_key` (`portalToken`);
