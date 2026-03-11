-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'JUDGED', 'FINALIST', 'WINNER');

-- CreateTable
CREATE TABLE "JudgingCriteria" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hackathonId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "hackathonId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "presentationUrl" TEXT,
    "videoUrl" TEXT,
    "teamName" TEXT NOT NULL,
    "teamMembers" TEXT[],
    "teamLeaderEmail" TEXT,
    "hackathonId" INTEGER NOT NULL,
    "registrationId" INTEGER,
    "status" "ProjectStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeAssignment" (
    "id" SERIAL NOT NULL,
    "judgeId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" SERIAL NOT NULL,
    "judgeAssignmentId" INTEGER NOT NULL,
    "criteriaId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JudgingCriteria_hackathonId_idx" ON "JudgingCriteria"("hackathonId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgingCriteria_name_hackathonId_key" ON "JudgingCriteria"("name", "hackathonId");

-- CreateIndex
CREATE INDEX "Judge_hackathonId_idx" ON "Judge"("hackathonId");

-- CreateIndex
CREATE INDEX "Judge_adminId_idx" ON "Judge"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Judge_adminId_hackathonId_key" ON "Judge"("adminId", "hackathonId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_registrationId_key" ON "Project"("registrationId");

-- CreateIndex
CREATE INDEX "Project_hackathonId_idx" ON "Project"("hackathonId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_teamName_idx" ON "Project"("teamName");

-- CreateIndex
CREATE INDEX "JudgeAssignment_judgeId_idx" ON "JudgeAssignment"("judgeId");

-- CreateIndex
CREATE INDEX "JudgeAssignment_projectId_idx" ON "JudgeAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeAssignment_judgeId_projectId_key" ON "JudgeAssignment"("judgeId", "projectId");

-- CreateIndex
CREATE INDEX "Score_judgeAssignmentId_idx" ON "Score"("judgeAssignmentId");

-- CreateIndex
CREATE INDEX "Score_criteriaId_idx" ON "Score"("criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_judgeAssignmentId_criteriaId_key" ON "Score"("judgeAssignmentId", "criteriaId");

-- AddForeignKey
ALTER TABLE "JudgingCriteria" ADD CONSTRAINT "JudgingCriteria_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judge" ADD CONSTRAINT "Judge_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_judgeAssignmentId_fkey" FOREIGN KEY ("judgeAssignmentId") REFERENCES "JudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "JudgingCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
