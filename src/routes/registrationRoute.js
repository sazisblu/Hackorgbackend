import express from "express";
import {
  registerUserToWebsite,
  registerUserToHackathon,
  getUserRegistrations,
  getWebsiteRegistrations,
  getHackathonRegistrations,
  getRegistrationsBySlug,
  updateRegistrationStatus,
  getRegistrationById,
} from "../controllers/registrationController.js";

const router = express.Router();

// Register a user to a hackathon (primary method)
router.post("/register/hackathon", registerUserToHackathon);

// Register a user to a website (legacy, backward compatible)
router.post("/register", registerUserToWebsite);

// Get all registrations for a specific user
router.get("/user/:userId", getUserRegistrations);

// Get all registrations for a specific hackathon
router.get("/hackathon/:hackathonId", getHackathonRegistrations);

// Get all registrations for a specific website (legacy)
router.get("/website/:websiteId", getWebsiteRegistrations);

// Get all registrations for a website by slug
router.get("/slug/:slug", getRegistrationsBySlug);

// Get a single registration by ID
router.get("/:registrationId", getRegistrationById);

// Update registration status
router.patch("/:registrationId/status", updateRegistrationStatus);

export default router;
