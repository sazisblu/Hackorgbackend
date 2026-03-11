import express from "express";
import {
  addJudge,
  getJudgesByHackathon,
  removeJudge,
  assignProjectsToJudge,
  removeAssignment,
  getJudgeAssignments,
  getMyJudgeProfile,
} from "../controllers/judgeController.js";

const router = express.Router();

// Add a judge to a hackathon
router.post("/hackathon/:hackathonId/judges", addJudge);

// Get all judges for a hackathon
router.get("/hackathon/:hackathonId/judges", getJudgesByHackathon);

// Remove a judge from a hackathon
router.delete("/judges/:id", removeJudge);

// Assign projects to a judge
router.post("/judges/:judgeId/assign", assignProjectsToJudge);

// Remove project assignment from judge
router.delete("/assignments/:assignmentId", removeAssignment);

// Get judge's assigned projects
router.get("/judges/:judgeId/assignments", getJudgeAssignments);

// Get my judge profile for a hackathon
router.get("/hackathon/:hackathonId/my-judge-profile", getMyJudgeProfile);

export default router;