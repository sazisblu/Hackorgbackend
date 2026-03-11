import express from "express";
import {
  createMentor,
  getMentor,
  updateMentor,
  deleteMentor,
  getWebsiteMentors,
  getHackathonMentors,
} from "../controllers/mentorController.js";

const router = express.Router();

// Create a new mentor
router.post("/", createMentor);

// Get all mentors for a hackathon
router.get("/hackathon/:hackathonId", getHackathonMentors);

// Get all mentors for a website
router.get("/website/:websiteId", getWebsiteMentors);

// Get mentor by ID
router.get("/:id", getMentor);

// Update mentor
router.patch("/:id", updateMentor);

// Delete mentor
router.delete("/:id", deleteMentor);

export default router;