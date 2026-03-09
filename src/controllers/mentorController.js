import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Create a new mentor
export const createMentor = async (req, res) => {
  const { name, email, image, title, bio, expertise, linkedin, github, websiteId, status } = req.body;

  try {
    if (!name || !websiteId) {
      return res.status(400).json({
        success: false,
        error: "Name and websiteId are required",
      });
    }

    // Verify website exists
    const website = await prisma.website.findUnique({
      where: { id: parseInt(websiteId) },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: "Website not found",
      });
    }

    const mentor = await prisma.mentor.create({
      data: {
        name,
        email: email || null,
        image: image || null,
        title: title || null,
        bio: bio || null,
        expertise: expertise || [],
        linkedin: linkedin || null,
        github: github || null,
        websiteId: parseInt(websiteId),
        status: status || "ACTIVE",
      },
    });

    console.log("Mentor created:", mentor);

    res.status(201).json({
      success: true,
      mentor,
      message: "Mentor created successfully",
    });
  } catch (error) {
    console.error("Error creating mentor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get mentor by ID
export const getMentor = async (req, res) => {
  const { id } = req.params;

  try {
    const mentor = await prisma.mentor.findUnique({
      where: { id: parseInt(id) },
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

    if (!mentor) {
      return res.status(404).json({
        success: false,
        error: "Mentor not found",
      });
    }

    res.status(200).json({
      success: true,
      mentor,
    });
  } catch (error) {
    console.error("Error fetching mentor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update mentor
export const updateMentor = async (req, res) => {
  const { id } = req.params;
  const { name, email, image, title, bio, expertise, linkedin, github, status } = req.body;

  try {
    const existingMentor = await prisma.mentor.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingMentor) {
      return res.status(404).json({
        success: false,
        error: "Mentor not found",
      });
    }

    const mentor = await prisma.mentor.update({
      where: { id: parseInt(id) },
      data: {
        name: name || existingMentor.name,
        email: email !== undefined ? email : existingMentor.email,
        image: image !== undefined ? image : existingMentor.image,
        title: title !== undefined ? title : existingMentor.title,
        bio: bio !== undefined ? bio : existingMentor.bio,
        expertise: expertise || existingMentor.expertise,
        linkedin: linkedin !== undefined ? linkedin : existingMentor.linkedin,
        github: github !== undefined ? github : existingMentor.github,
        status: status || existingMentor.status,
      },
    });

    console.log("Mentor updated:", mentor);

    res.status(200).json({
      success: true,
      mentor,
      message: "Mentor updated successfully",
    });
  } catch (error) {
    console.error("Error updating mentor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete mentor
export const deleteMentor = async (req, res) => {
  const { id } = req.params;

  try {
    const existingMentor = await prisma.mentor.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingMentor) {
      return res.status(404).json({
        success: false,
        error: "Mentor not found",
      });
    }

    await prisma.mentor.delete({
      where: { id: parseInt(id) },
    });

    console.log("Mentor deleted:", id);

    res.status(200).json({
      success: true,
      message: "Mentor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting mentor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all mentors for a website
export const getWebsiteMentors = async (req, res) => {
  const { websiteId } = req.params;

  try {
    const mentors = await prisma.mentor.findMany({
      where: { websiteId: parseInt(websiteId) },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      mentors,
    });
  } catch (error) {
    console.error("Error fetching mentors:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};