CREATE TABLE `AIConnection` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` ENUM('OPENAI', 'OPENAI_COMPATIBLE') NOT NULL DEFAULT 'OPENAI',
    `baseUrl` VARCHAR(500) NULL,
    `model` VARCHAR(200) NOT NULL,
    `encryptedApiKey` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AIConnection_userId_key`(`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `AIConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
