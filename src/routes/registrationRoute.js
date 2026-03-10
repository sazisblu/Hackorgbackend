import express from "express";
import {
  registerUserToWebsite,
  getUserRegistrations,
  getWebsiteRegistrations,
  getRegistrationsBySlug,
  updateRegistrationStatus,
  getRegistrationById,
} from "../controllers/registrationController.js";

const router = express.Router();

// Register a user to a website
router.post("/register", registerUserToWebsite);

// Get all registrations for a specific user
router.get("/user/:userId", getUserRegistrations);

// Get all registrations for a specific website
router.get("/website/:websiteId", getWebsiteRegistrations);

// Get all registrations for a website by slug
router.get("/slug/:slug", getRegistrationsBySlug);

// Get a single registration by ID
router.get("/:registrationId", getRegistrationById);

// Update registration status
router.patch("/:registrationId/status", updateRegistrationStatus);

export default router;
