-- CreateEnum
CREATE TYPE "CareInviteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

-- CreateTable
CREATE TABLE "care_invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "status" "CareInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_invites_code_key" ON "care_invites"("code");

-- AddForeignKey
ALTER TABLE "care_invites" ADD CONSTRAINT "care_invites_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
