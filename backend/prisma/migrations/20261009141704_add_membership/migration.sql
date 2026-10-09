-- AlterTable
ALTER TABLE "users" ADD COLUMN     "membershipExpiresAt" TIMESTAMP(3),
ADD COLUMN     "membershipTier" TEXT;
