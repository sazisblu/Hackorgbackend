import express from "express";
import {
  getUserHackathonsForJudging,
  getJudgingOverview,
  getAssignmentMatrix,
  bulkAssignProjects,
  randomAssignProjects,
} from "../controllers/judgingController.js";

const router = express.Router();

// Get all hackathons for judging (organizer or judge)
router.get("/judging/hackathons", getUserHackathonsForJudging);

// Get judging overview for a hackathon
router.get("/judging/hackathon/:hackathonId/overview", getJudgingOverview);

// Get assignment matrix (organizers only)
router.get("/judging/hackathon/:hackathonId/assignments/matrix", getAssignmentMatrix);

// Bulk assign projects to judges
router.post("/judging/hackathon/:hackathonId/assignments/bulk", bulkAssignProjects);

// Random assignment
router.post("/judging/hackathon/:hackathonId/assignments/random", randomAssignProjects);

export default router;