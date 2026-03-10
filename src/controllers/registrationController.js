import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import crypto from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Generate a unique QR identifier
const generateQRIdentifier = (websiteId, userId) => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `HO-${websiteId}-${userId}-${random}`;
};

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
      orderBy: {
        registeredAt: 'desc',
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

// Get all registrations for a website by slug
export const getRegistrationsBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    // First find the website by slug
    const website = await prisma.website.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: "Website not found",
      });
    }

    // Get registrations with user data
    const registrations = await prisma.registration.findMany({
      where: { websiteId: website.id },
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
      orderBy: {
        registeredAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      registrations,
    });
  } catch (error) {
    console.error("Error fetching registrations by slug:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update registration status
export const updateRegistrationStatus = async (req, res) => {
  const { registrationId } = req.params;
  const { status } = req.body;

  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({
      success: false,
      error: "Invalid status. Must be PENDING, APPROVED, or REJECTED",
    });
  }

  try {
    // First get the current registration to check if we need to generate QR
    const currentRegistration = await prisma.registration.findUnique({
      where: { id: parseInt(registrationId) },
      select: { status: true, qrIdentifier: true, websiteId: true, userId: true },
    });

    if (!currentRegistration) {
      return res.status(404).json({
        success: false,
        error: "Registration not found",
      });
    }

    // Prepare update data
    const updateData = { status };

    // Generate QR identifier if approving and doesn't have one
    if (status === 'APPROVED' && !currentRegistration.qrIdentifier) {
      updateData.qrIdentifier = generateQRIdentifier(
        currentRegistration.websiteId,
        currentRegistration.userId
      );
    }

    const registration = await prisma.registration.update({
      where: { id: parseInt(registrationId) },
      data: updateData,
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
      registration,
      qrIdentifier: registration.qrIdentifier,
      message: "Registration status updated successfully",
    });
  } catch (error) {
    console.error("Error updating registration status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get a single registration by ID
export const getRegistrationById = async (req, res) => {
  const { registrationId } = req.params;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id: parseInt(registrationId) },
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
        website: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      registration,
    });
  } catch (error) {
    console.error("Error fetching registration:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
