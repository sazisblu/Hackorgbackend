import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import bcrypt from "bcrypt";
import { hash } from "crypto";
import generateToken from "../utils/generateToken.js";
import chalk from "chalk";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

export const createUser = async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Request headers:", req.headers);

  const { email, name, image, githubId, githubUsername } = req.body;

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        image,
        githubId,
        githubUsername,
        updatedAt: new Date(),
      },
      create: {
        email,
        name,
        image,
        githubId,
        githubUsername,
      },
    });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMe = async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
