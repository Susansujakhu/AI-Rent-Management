-- Run this in phpMyAdmin on your production database
-- All CREATE TABLE / ADD COLUMN statements use IF NOT EXISTS — safe to run multiple times
-- If any statement shows an error, skip it and run the rest manually

-- ── 1. Tenant — add missing columns ──────────────────────────────────────────
ALTER TABLE `Tenant`
  ADD COLUMN IF NOT EXISTS `portalEnabled`          tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `portalToken`            varchar(191) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `creditBalance`          double       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `canSubmitMeterReading`  tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `meterReadingAutoAccept` tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `electricityRate`        double       DEFAULT NULL;

-- ── 2. Unique index for portalToken ──────────────────────────────────────────
-- Skip this statement if you get "Duplicate key name" — the index already exists
ALTER TABLE `Tenant` ADD UNIQUE INDEX `Tenant_portalToken_key` (`portalToken`);

-- ── 3. MaintenanceRequest ────────────────────────────────────────────────────
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

-- ── 4. TenantDocument ────────────────────────────────────────────────────────
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

-- ── 5. MeterReading ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `MeterReading` (
  `id`                varchar(191) NOT NULL,
  `userId`            varchar(191) NOT NULL,
  `tenantId`          varchar(191) NOT NULL,
  `month`             varchar(191) NOT NULL,
  `previous`          double       NOT NULL,
  `current`           double       NOT NULL,
  `ratePerUnit`       double       NOT NULL,
  `unitsUsed`         double       NOT NULL,
  `amount`            double       NOT NULL,
  `chargeId`          varchar(191) DEFAULT NULL,
  `photoPath`         varchar(191) DEFAULT NULL,
  `notes`             longtext,
  `submittedByTenant` tinyint(1)   NOT NULL DEFAULT 0,
  `status`            varchar(191) NOT NULL DEFAULT 'confirmed',
  `createdAt`         datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MeterReading_chargeId_key`        (`chargeId`),
  UNIQUE KEY `MeterReading_tenantId_month_key`  (`tenantId`, `month`),
  KEY          `MeterReading_userId_month_idx`  (`userId`, `month`),
  CONSTRAINT `MeterReading_userId_fkey`   FOREIGN KEY (`userId`)   REFERENCES `User`          (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `MeterReading_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`        (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `MeterReading_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `OneTimeCharge` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If MeterReading table already existed without these columns, add them:
ALTER TABLE `MeterReading`
  ADD COLUMN IF NOT EXISTS `submittedByTenant` tinyint(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `status`            varchar(191) NOT NULL DEFAULT 'confirmed';

-- ── 6. TenantSession ─────────────────────────────────────────────────────────
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

-- ── 7. GlobalSetting ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `GlobalSetting` (
  `key`   varchar(191) NOT NULL,
  `value` longtext     NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. Notification ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `Notification` (
  `id`        varchar(191) NOT NULL,
  `userId`    varchar(191) NOT NULL,
  `type`      varchar(191) NOT NULL,
  `title`     varchar(191) NOT NULL,
  `body`      longtext     NOT NULL,
  `data`      longtext,
  `read`      tinyint(1)   NOT NULL DEFAULT 0,
  `createdAt` datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Notification_userId_read_idx` (`userId`, `read`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 9. PaymentClaim — tenant-reported "I paid X" awaiting owner confirmation ──
CREATE TABLE IF NOT EXISTS `PaymentClaim` (
  `id`         varchar(191) NOT NULL,
  `userId`     varchar(191) NOT NULL,
  `tenantId`   varchar(191) NOT NULL,
  `paymentId`  varchar(191) DEFAULT NULL,
  `amount`     double       NOT NULL,
  `method`     varchar(191) NOT NULL,
  `reference`      varchar(191) DEFAULT NULL,
  `paidDate`       datetime(3)  NOT NULL,
  `note`           longtext,
  `screenshotPath` varchar(191) DEFAULT NULL,
  `status`         varchar(191) NOT NULL DEFAULT 'pending',
  `reviewedAt` datetime(3)  DEFAULT NULL,
  `createdAt`  datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `PaymentClaim_userId_status_idx`   (`userId`, `status`),
  KEY `PaymentClaim_tenantId_status_idx` (`tenantId`, `status`),
  CONSTRAINT `PaymentClaim_userId_fkey`    FOREIGN KEY (`userId`)    REFERENCES `User`    (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `PaymentClaim_tenantId_fkey`  FOREIGN KEY (`tenantId`)  REFERENCES `Tenant`  (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT `PaymentClaim_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If PaymentClaim already existed without the screenshot column, add it:
ALTER TABLE `PaymentClaim`
  ADD COLUMN IF NOT EXISTS `screenshotPath` varchar(191) DEFAULT NULL;
