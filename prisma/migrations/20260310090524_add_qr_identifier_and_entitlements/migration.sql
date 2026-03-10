/*
  Warnings:

  - A unique constraint covering the columns `[qrIdentifier]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "qrIdentifier" TEXT;

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "websiteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantEntitlement" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "entitlementId" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBy" INTEGER NOT NULL,

    CONSTRAINT "ParticipantEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entitlement_websiteId_idx" ON "Entitlement"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_name_websiteId_key" ON "Entitlement"("name", "websiteId");

-- CreateIndex
CREATE INDEX "ParticipantEntitlement_registrationId_idx" ON "ParticipantEntitlement"("registrationId");

-- CreateIndex
CREATE INDEX "ParticipantEntitlement_entitlementId_idx" ON "ParticipantEntitlement"("entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantEntitlement_registrationId_entitlementId_key" ON "ParticipantEntitlement"("registrationId", "entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_qrIdentifier_key" ON "Registration"("qrIdentifier");

-- CreateIndex
CREATE INDEX "Registration_qrIdentifier_idx" ON "Registration"("qrIdentifier");

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEntitlement" ADD CONSTRAINT "ParticipantEntitlement_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEntitlement" ADD CONSTRAINT "ParticipantEntitlement_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEntitlement" ADD CONSTRAINT "ParticipantEntitlement_claimedBy_fkey" FOREIGN KEY ("claimedBy") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
