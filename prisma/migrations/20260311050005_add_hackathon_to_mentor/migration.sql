-- AlterTable
ALTER TABLE "Mentor" ADD COLUMN     "hackathonId" INTEGER;

-- CreateIndex
CREATE INDEX "Mentor_hackathonId_idx" ON "Mentor"("hackathonId");

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
