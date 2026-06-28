-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "bookedByAgentId" TEXT,
ADD COLUMN     "paymentMode" TEXT NOT NULL DEFAULT 'ONLINE';

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookedByAgentId_fkey" FOREIGN KEY ("bookedByAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
