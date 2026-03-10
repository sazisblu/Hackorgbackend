-- CreateEnum
CREATE TYPE "MentorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Mentor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "image" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "expertise" TEXT[],
    "linkedin" TEXT,
    "github" TEXT,
    "websiteId" INTEGER NOT NULL,
    "status" "MentorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mentor_websiteId_idx" ON "Mentor"("websiteId");

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
