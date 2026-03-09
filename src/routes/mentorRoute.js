import express from "express";
import {
  createMentor,
  getMentor,
  updateMentor,
  deleteMentor,
  getWebsiteMentors,
} from "../controllers/mentorController.js";

const router = express.Router();

// Create a new mentor
router.post("/", createMentor);

// Get mentor by ID
router.get("/:id", getMentor);

// Update mentor
router.patch("/:id", updateMentor);

// Delete mentor
router.delete("/:id", deleteMentor);

// Get all mentors for a website
router.get("/website/:websiteId", getWebsiteMentors);

export default router;