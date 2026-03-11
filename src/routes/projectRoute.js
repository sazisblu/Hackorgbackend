import express from "express";
import {
  createProject,
  getProjectsByHackathon,
  getPublicProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectStatus,
} from "../controllers/projectController.js";

const router = express.Router();

// Create a new project for a hackathon
router.post("/hackathon/:hackathonId/projects", createProject);

// Get all projects for a hackathon (authenticated)
router.get("/hackathon/:hackathonId/projects", getProjectsByHackathon);

// Get public projects for a hackathon
router.get("/hackathon/:hackathonId/projects/public", getPublicProjects);

// Get project by ID
router.get("/projects/:id", getProjectById);

// Update project
router.put("/projects/:id", updateProject);

// Delete project
router.delete("/projects/:id", deleteProject);

// Update project status
router.patch("/projects/:id/status", updateProjectStatus);

export default router;