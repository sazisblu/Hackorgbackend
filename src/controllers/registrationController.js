import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Register a user to a website
export const registerUserToWebsite = async (req, res) => {
  console.log("Registration request body:", req.body);

  const { userId, websiteId, slug } = req.body;

  try {
    // If slug is provided instead of websiteId, fetch the website first
    let finalWebsiteId = websiteId;
    
    if (!finalWebsiteId && slug) {
      const website = await prisma.website.findUnique({
        where: { slug },
        select: { id: true },
      });
      
      if (!website) {
        return res.status(404).json({ 
          success: false, 
          error: "Website not found" 
        });
      }
      
      finalWebsiteId = website.id;
    }

    if (!userId || !finalWebsiteId) {
      return res.status(400).json({ 
        success: false, 
        error: "userId and websiteId (or slug) are required" 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: "User not found" 
      });
    }

    // Check if website exists
    const website = await prisma.website.findUnique({
      where: { id: parseInt(finalWebsiteId) },
    });

    if (!website) {
      return res.status(404).json({ 
        success: false, 
        error: "Website not found" 
      });
    }

    // Create or update registration
    const registration = await prisma.registration.upsert({
      where: {
        userId_websiteId: {
          userId: parseInt(userId),
          websiteId: parseInt(finalWebsiteId),
        },
      },
      update: {
        // Update timestamp if already exists
        registeredAt: new Date(),
      },
      create: {
        userId: parseInt(userId),
        websiteId: parseInt(finalWebsiteId),
        status: "PENDING",
      },
    });

    console.log("Registration created/updated:", registration);

    res.status(200).json({ 
      success: true, 
      registration,
      message: "User registered to website successfully" 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get all registrations for a user
export const getUserRegistrations = async (req, res) => {
  const { userId } = req.params;

  try {
    const registrations = await prisma.registration.findMany({
      where: { userId: parseInt(userId) },
      include: {
        website: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
          },
        },
      },
    });

    res.status(200).json({ 
      success: true, 
      registrations 
    });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get all registrations for a website
export const getWebsiteRegistrations = async (req, res) => {
  const { websiteId } = req.params;

  try {
    const registrations = await prisma.registration.findMany({
      where: { websiteId: parseInt(websiteId) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            githubUsername: true,
          },
        },
      },
    });

    res.status(200).json({ 
      success: true, 
      registrations 
    });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
