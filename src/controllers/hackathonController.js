import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Generate unique slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Generate a unique 8-character alphanumeric join code
const generateUniqueJoinCode = async () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars like I, O, 0, 1
  let joinCode = "";
  let isUnique = false;

  while (!isUnique) {
    joinCode = "";
    for (let i = 0; i < 8; i++) {
      joinCode += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    // Check if code already exists
    const existing = await prisma.hackathon.findUnique({
      where: { joinCode },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return joinCode;
};

// Create a new hackathon with website
export const createHackathon = async (req, res) => {
  const { adminId, name, description } = req.body;

  if (!adminId || !name) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: adminId, name",
    });
  }

  try {
    // Generate unique join code
    const joinCode = await generateUniqueJoinCode();

    // Generate unique slug for website
    let slug = generateSlug(name);
    let counter = 1;
    while (await prisma.website.findUnique({ where: { slug } })) {
      slug = `${generateSlug(name)}-${counter}`;
      counter++;
    }

    // Create hackathon, website, and add admin as owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the website with hackathon name as default
      const website = await tx.website.create({
        data: {
          slug,
          title: name, // Default website name is hackathon name
          description: description || null,
          websiteData: {
            eventName: name,
            description: description || "",
          },
          status: "DRAFT",
        },
      });

      // Create the hackathon linked to the website
      const newHackathon = await tx.hackathon.create({
        data: {
          name,
          description: description || null,
          joinCode,
          websiteId: website.id,
        },
      });

      // Add the admin as owner
      await tx.adminHackathon.create({
        data: {
          adminId: parseInt(adminId),
          hackathonId: newHackathon.id,
          role: "OWNER",
        },
      });

      return { hackathon: newHackathon, website };
    });

    res.status(201).json({
      success: true,
      hackathon: {
        id: result.hackathon.id,
        name: result.hackathon.name,
        description: result.hackathon.description,
        joinCode: result.hackathon.joinCode,
        website: {
          id: result.website.id,
          title: result.website.title,
          slug: result.website.slug,
        },
        createdAt: result.hackathon.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating hackathon:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Join a hackathon by join code
export const joinHackathon = async (req, res) => {
  const { adminId, joinCode } = req.body;

  if (!adminId || !joinCode) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: adminId, joinCode",
    });
  }

  try {
    // Find hackathon by join code with website
    const hackathon = await prisma.hackathon.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
      include: {
        website: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        error: "Invalid join code. No hackathon found.",
      });
    }

    // Check if admin is already a member
    const existingMembership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId: parseInt(adminId),
          hackathonId: hackathon.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: "You are already a member of this hackathon.",
      });
    }

    // Add admin as member
    await prisma.adminHackathon.create({
      data: {
        adminId: parseInt(adminId),
        hackathonId: hackathon.id,
        role: "MEMBER",
      },
    });

    res.status(200).json({
      success: true,
      hackathon: {
        id: hackathon.id,
        name: hackathon.name,
        description: hackathon.description,
        joinCode: hackathon.joinCode,
        website: hackathon.website,
      },
    });
  } catch (error) {
    console.error("Error joining hackathon:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all hackathons for the current admin
export const getMyHackathons = async (req, res) => {
  const { adminId } = req.params;

  try {
    const adminHackathons = await prisma.adminHackathon.findMany({
      where: { adminId: parseInt(adminId) },
      include: {
        hackathon: {
          include: {
            website: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                mentors: { select: { id: true } },
              },
            },
            registrations: { select: { id: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const hackathons = adminHackathons.map((ah) => ({
      id: ah.hackathon.id,
      name: ah.hackathon.name,
      description: ah.hackathon.description,
      joinCode: ah.hackathon.joinCode,
      role: ah.role,
      joinedAt: ah.joinedAt,
      website: ah.hackathon.website ? {
        id: ah.hackathon.website.id,
        title: ah.hackathon.website.title,
        slug: ah.hackathon.website.slug,
        status: ah.hackathon.website.status,
      } : null,
      participantCount: ah.hackathon.registrations?.length || 0,
      mentorCount: ah.hackathon.website?.mentors?.length || 0,
    }));

    res.status(200).json({
      success: true,
      hackathons,
    });
  } catch (error) {
    console.error("Error fetching hackathons:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get hackathon details by ID
export const getHackathonById = async (req, res) => {
  const { id } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: parseInt(id) },
      include: {
        website: true,
        admins: {
          include: {
            admin: {
              select: {
                id: true,
                fullname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        error: "Hackathon not found",
      });
    }

    // Check if the requesting admin is a member
    const membership = hackathon.admins.find((ah) => ah.adminId === adminId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    res.status(200).json({
      success: true,
      hackathon: {
        id: hackathon.id,
        name: hackathon.name,
        description: hackathon.description,
        joinCode: hackathon.joinCode,
        website: hackathon.website,
        admins: hackathon.admins.map((ah) => ({
          id: ah.admin.id,
          fullname: ah.admin.fullname,
          email: ah.admin.email,
          role: ah.role,
          joinedAt: ah.joinedAt,
        })),
        createdAt: hackathon.createdAt,
        updatedAt: hackathon.updatedAt,
      },
      userRole: membership.role,
    });
  } catch (error) {
    console.error("Error fetching hackathon:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Complete onboarding for an admin
export const completeOnboarding = async (req, res) => {
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({
      success: false,
      error: "Missing required field: adminId",
    });
  }

  try {
    const admin = await prisma.admin.update({
      where: { id: parseInt(adminId) },
      data: { onboardingCompleted: true },
      select: {
        id: true,
        email: true,
        fullname: true,
        onboardingCompleted: true,
      },
    });

    res.status(200).json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Check if admin has completed onboarding
export const checkOnboardingStatus = async (req, res) => {
  const { adminId } = req.params;

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: parseInt(adminId) },
      select: {
        id: true,
        onboardingCompleted: true,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      onboardingCompleted: admin.onboardingCompleted,
    });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
