import express from "express";
import { 
  registerUserToWebsite, 
  getUserRegistrations, 
  getWebsiteRegistrations 
} from "../controllers/registrationController.js";

const router = express.Router();

// Register a user to a website
router.post("/register", registerUserToWebsite);

// Get all registrations for a specific user
router.get("/user/:userId", getUserRegistrations);

// Get all registrations for a specific website
router.get("/website/:websiteId", getWebsiteRegistrations);

export default router;
