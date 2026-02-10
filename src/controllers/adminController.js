import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

const createAdmin = async (req, res) => {
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
  try {
    console.log("About to create admin with:", { email, fullname });
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);

    const admin = await prisma.admin.create({
      data: { email, password, fullname },
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

export default { createAdmin };
