import express from "express";
import {
  submitScores,
  getScoresForAssignment,
  getAssignmentForEvaluation,
  getLeaderboard,
  getProjectScores,
} from "../controllers/scoringController.js";

const router = express.Router();

// Submit scores for an assignment
router.post("/assignments/:assignmentId/scores", submitScores);

// Get scores for an assignment
router.get("/assignments/:assignmentId/scores", getScoresForAssignment);

// Get assignment details for evaluation
router.get("/assignments/:assignmentId/evaluate", getAssignmentForEvaluation);

// Get leaderboard for a hackathon
router.get("/hackathon/:hackathonId/leaderboard", getLeaderboard);

// Get detailed project scores (for organizers)
router.get("/projects/:projectId/scores", getProjectScores);

export default router;