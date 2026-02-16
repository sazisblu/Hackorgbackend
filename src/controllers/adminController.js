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

export const createAdmin = async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Request headers:", req.headers);

  if (
    !req.body ||
    !req.body.email ||
    !req.body.password ||
    !req.body.fullname
  ) {
    return res.status(400).json({
      error: "Missing required fields: email, password, fullname",
      receivedBody: req.body,
    });
  }

  const { email, password, fullname } = req.body;
  const saltrounds = 10;
  // this is the cost factor of encrypoting
  const hashedpass = await bcrypt.hash(password, saltrounds);
  console.log("password:", password);
  console.log("hashedpass:", hashedpass);

  try {
    console.log("About to create admin with:", { email, fullname });
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);

    const admin = await prisma.admin.create({
      data: { email, password: hashedpass, fullname },
    });

    console.log("Admin created successfully:", admin.id);
    res.status(201).json(admin);
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(400).json({
      error: error.message,
      details: error.toString(),
    });
  }
};

export const loginAdmin = async (req, res) => {
  // here lies the logic for chekcing if the admin exists in the admin table in the database

  const { email, password } = req.body;
  try {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return res.status(401).json({
        status: 401,
        message: "user not found",
      });
    }
    console.log(admin.password);
    const passvalid = await bcrypt.compare(password, admin.password);
    if (admin && passvalid) {
      console.log(chalk.green("Admin with the given email exists"));
      console.log(chalk.green("The entered password matches."));
      console.log("entered pass:", password);
      console.log("hashed password:", admin.password);
      console.log("Password valid:", passvalid);
      res.status(200).json({
        status: 200,
        Message: `Admin with the given email exists ${email}`,
        id: admin.id,
        email: admin.email,
        token: generateToken(admin.id),
      });
    } else {
      res.status(401).json({
        status: 401,
        Message: "Invalid Credentials",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: 500,
      message: "Server error during login",
    });
  }
};
