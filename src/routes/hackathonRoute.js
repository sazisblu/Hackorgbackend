import express from "express";
import {
  createHackathon,
  joinHackathon,
  getMyHackathons,
  getHackathonById,
  completeOnboarding,
  checkOnboardingStatus,
} from "../controllers/hackathonController.js";

const router = express.Router();

// Create a new hackathon
router.post("/hackathon/create", createHackathon);

// Join a hackathon by join code
router.post("/hackathon/join", joinHackathon);

// Get all hackathons for current admin
router.get("/hackathon/my/:adminId", getMyHackathons);

// Get hackathon details by ID
router.get("/hackathon/:id", getHackathonById);

// Complete onboarding for admin
router.patch("/admin/onboarding-complete", completeOnboarding);

// Check onboarding status
router.get("/admin/onboarding-status/:adminId", checkOnboardingStatus);

export default router;