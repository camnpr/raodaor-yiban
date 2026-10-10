-- AlterTable
ALTER TABLE "users" ADD COLUMN     "timedBroadcastEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timedBroadcastLastSent" TIMESTAMP(3),
ADD COLUMN     "timedBroadcastTime" TEXT;
