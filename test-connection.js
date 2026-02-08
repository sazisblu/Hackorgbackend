require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Database connection successful!");

    // Test query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log("PostgreSQL version:", result[0].version);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
