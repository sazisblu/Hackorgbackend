import express from "express";
import {
  createEntitlement,
  getEntitlementsByWebsite,
  getEntitlementById,
  updateEntitlement,
  deleteEntitlement,
  claimEntitlement,
  getParticipantByQR,
  getEntitlementClaims,
  generateQRForRegistration,
} from "../controllers/entitlementController.js";

const router = express.Router();

// Entitlement CRUD
router.post("/entitlement", createEntitlement);
router.get("/entitlement/website/:websiteId", getEntitlementsByWebsite);
router.get("/entitlement/:id", getEntitlementById);
router.put("/entitlement/:id", updateEntitlement);
router.delete("/entitlement/:id", deleteEntitlement);

// Entitlement claims
router.post("/entitlement/claim", claimEntitlement);
router.get("/entitlement/:entitlementId/claims", getEntitlementClaims);

// QR code related
router.get("/registration/qr/:qrIdentifier", getParticipantByQR);
router.post("/registration/:registrationId/generate-qr", generateQRForRegistration);

export default router;