import express from "express";
import adminController from "../controllers/adminController.js";

// routes directory contain router files which are basically way to organize and group related api endpoints/ routers together

const router = express.Router();

router.post("/createadmin", adminController.createAdmin);
// when i use the express.router , it lets me create new routes that can be imported in my main file

export default router;
