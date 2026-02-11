import express from "express";
import { createAdmin, loginAdmin } from "../controllers/adminController.js";

// routes directory contain router files which are basically way to organize and group related api endpoints/ routers together

const router = express.Router();

router.post("/createadmin", createAdmin);
// when i use the express.router , it lets me create new routes that can be imported in my main file

router.post("/loginadmin", loginAdmin);

export default router;
