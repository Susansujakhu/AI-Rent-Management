-- Move-out Settlement table — run once on production MySQL (phpMyAdmin)
-- before deploying the settlement feature. Matches what `prisma db push`
-- generates locally; safe to run on a live DB (additive only).

CREATE TABLE `Settlement` (
  `id`             VARCHAR(191) NOT NULL,
  `userId`         VARCHAR(191) NOT NULL,
  `tenantId`       VARCHAR(191) NOT NULL,
  `moveOutDate`    DATETIME(3)  NOT NULL,
  `totalDue`       DOUBLE       NOT NULL,
  `creditApplied`  DOUBLE       NOT NULL DEFAULT 0,
  `depositHeld`    DOUBLE       NOT NULL,
  `depositApplied` DOUBLE       NOT NULL,
  `refundDue`      DOUBLE       NOT NULL,
  `balanceDue`     DOUBLE       NOT NULL,
  `detail`         TEXT         NULL,
  `notes`          TEXT         NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Settlement_tenantId_key` (`tenantId`),
  INDEX `Settlement_userId_idx` (`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Settlement`
  ADD CONSTRAINT `Settlement_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Settlement`
  ADD CONSTRAINT `Settlement_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
