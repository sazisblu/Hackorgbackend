-- DropIndex
DROP INDEX "Registration_userId_websiteId_key";

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "hackathonId" INTEGER,
ALTER COLUMN "websiteId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Registration_hackathonId_idx" ON "Registration"("hackathonId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
