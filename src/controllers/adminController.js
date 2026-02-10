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
  
  if (!req.body || !req.body.email || !req.body.password || !req.body.fullname) {
    return res.status(400).json({ 
      error: "Missing required fields: email, password, fullname",
      receivedBody: req.body 
    });
  }
  
  const { email, password, fullname } = req.body;
  try {
    const admin = await prisma.admin.create({
      data: { email, password, fullname },
    });
    res.status(201).json(admin);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default { createAdmin };
