import express from "express";
import { getAdminStats } from "../controllers/statsController.js";

const router = express.Router();

// Get dashboard statistics for an admin
router.get("/stats/admin/:adminId", getAdminStats);

export default router;