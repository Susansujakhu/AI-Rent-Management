-- Rent History feature — run ONCE on production MySQL before the new
-- code goes live. Creates the RentHistory table and back-relations.
-- Idempotent: skips work if the table already exists.

CREATE TABLE IF NOT EXISTS `RentHistory` (
  `id`            VARCHAR(191) NOT NULL,
  `userId`        VARCHAR(191) NOT NULL,
  `roomId`        VARCHAR(191) NOT NULL,
  `amount`        DOUBLE       NOT NULL,
  `effectiveFrom` VARCHAR(191) NOT NULL,
  `reason`        TEXT         NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `RentHistory_roomId_effectiveFrom_idx` (`roomId`, `effectiveFrom`),
  INDEX `RentHistory_userId_idx` (`userId`),

  CONSTRAINT `RentHistory_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RentHistory_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
