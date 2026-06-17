-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "orientation" "Orientation" NOT NULL DEFAULT 'LANDSCAPE';
