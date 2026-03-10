// /home/dipu/Documents/codes/web project/Hackorgbackend/src/routes/websiteRoute.js

import express from "express";
import {
  saveWebsite,
  getWebsite,
  getWebsiteBySlug,
  getWebsiteByHackathon,
  getAdminWebsites,
  publishWebsite,
  unpublishWebsite,
  deleteWebsite,
} from "../controllers/websiteController.js";

const router = express.Router();

// Save (create or update) website
router.post("/website/save", saveWebsite);

// Get single website by ID
router.get("/website/:id", getWebsite);

// Get website by slug (for public viewing)
router.get("/website/slug/:slug", getWebsiteBySlug);

// Get website by hackathon ID
router.get("/website/hackathon/:hackathonId", getWebsiteByHackathon);

// Get all websites for an admin
router.get("/websites/admin/:adminId", getAdminWebsites);

// Publish website
router.patch("/website/:id/publish", publishWebsite);

// Unpublish website
router.patch("/website/:id/unpublish", unpublishWebsite);

// Delete website
router.delete("/website/:id", deleteWebsite);

export default router;