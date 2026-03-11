import express from "express";
import {
  createCriteria,
  getCriteriaByHackathon,
  getPublicCriteria,
  updateCriteria,
  deleteCriteria,
  reorderCriteria,
} from "../controllers/criteriaController.js";

const router = express.Router();

// Create a new criteria for a hackathon
router.post("/hackathon/:hackathonId/criteria", createCriteria);

// Get all criteria for a hackathon (authenticated)
router.get("/hackathon/:hackathonId/criteria", getCriteriaByHackathon);

// Get public criteria for a hackathon (no auth required)
router.get("/hackathon/:hackathonId/criteria/public", getPublicCriteria);

// Update a criteria
router.put("/criteria/:id", updateCriteria);

// Delete a criteria
router.delete("/criteria/:id", deleteCriteria);

// Reorder criteria
router.patch("/hackathon/:hackathonId/criteria/reorder", reorderCriteria);

export default router;