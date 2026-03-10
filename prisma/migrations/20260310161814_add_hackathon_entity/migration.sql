-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Website" ALTER COLUMN "adminId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "websiteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminHackathon" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "hackathonId" INTEGER NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OWNER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminHackathon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hackathon_joinCode_key" ON "Hackathon"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Hackathon_websiteId_key" ON "Hackathon"("websiteId");

-- CreateIndex
CREATE INDEX "Hackathon_joinCode_idx" ON "Hackathon"("joinCode");

-- CreateIndex
CREATE INDEX "AdminHackathon_adminId_idx" ON "AdminHackathon"("adminId");

-- CreateIndex
CREATE INDEX "AdminHackathon_hackathonId_idx" ON "AdminHackathon"("hackathonId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminHackathon_adminId_hackathonId_key" ON "AdminHackathon"("adminId", "hackathonId");

-- AddForeignKey
ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminHackathon" ADD CONSTRAINT "AdminHackathon_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminHackathon" ADD CONSTRAINT "AdminHackathon_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
