// /home/dipu/Documents/codes/web project/Hackorgbackend/src/controllers/websiteController.js

import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import chalk from "chalk";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Generate unique slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Create or Update Website
export const saveWebsite = async (req, res) => {
  try {
    const { websiteData, adminId, websiteId } = req.body;

    // Validate required fields
    if (!websiteData || !adminId) {
      return res.status(400).json({
        error: "Missing required fields: websiteData and adminId",
      });
    }

    // Validate websiteData structure
    if (!websiteData.eventName) {
      return res.status(400).json({
        error: "websiteData must include eventName",
      });
    }

    // Generate slug from eventName
    const slug = generateSlug(websiteData.eventName);

    // Check if updating existing website
    if (websiteId) {
      // First, verify that the website belongs to this admin
      const existingWebsite = await prisma.website.findUnique({
        where: { id: parseInt(websiteId) },
      });

      if (!existingWebsite) {
        return res.status(404).json({
          error: "Website not found",
        });
      }

      if (existingWebsite.adminId !== parseInt(adminId)) {
        return res.status(403).json({
          error: "Forbidden: You don't have permission to update this website",
        });
      }

      // Update existing website
      const website = await prisma.website.update({
        where: { id: parseInt(websiteId) },
        data: {
          title: websiteData.eventName,
          description: websiteData.description || null,
          websiteData: websiteData,
          slug: slug,
          updatedAt: new Date(),
        },
      });

      console.log(chalk.green(`Website updated: ${website.id}`));
      return res.status(200).json({
        success: true,
        message: "Website updated successfully",
        website: website,
      });
    } else {
      // Create new website
      let uniqueSlug = slug;
      let counter = 1;

      // Ensure slug is unique
      while (await prisma.website.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      const website = await prisma.website.create({
        data: {
          slug: uniqueSlug,
          title: websiteData.eventName,
          description: websiteData.description || null,
          websiteData: websiteData,
          adminId: parseInt(adminId),
          status: "DRAFT",
        },
      });

      console.log(chalk.green(`Website created: ${website.id}`));
      return res.status(201).json({
        success: true,
        message: "Website created successfully",
        website: website,
      });
    }
  } catch (error) {
    console.error(chalk.red("Error saving website:"), error);
    return res.status(500).json({
      error: "Failed to save website",
      details: error.message,
    });
  }
};

// Get Website by ID
export const getWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.query; // Optional: pass adminId to verify ownership

    const website = await prisma.website.findUnique({
      where: { id: parseInt(id) },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            fullname: true,
          },
        },
      },
    });

    if (!website) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // If adminId is provided, verify ownership (for private requests)
    if (adminId && website.adminId !== parseInt(adminId)) {
      return res.status(403).json({
        error: "Forbidden: You don't have permission to access this website",
      });
    }

    res.status(200).json({
      success: true,
      website: website,
    });
  } catch (error) {
    console.error(chalk.red("Error fetching website:"), error);
    res.status(500).json({
      error: "Failed to fetch website",
      details: error.message,
    });
  }
};

// DEPRECATED: Use getWebsiteWithOwnershipCheck for admin operations
const getWebsiteOld = async (req, res) => {
  try {
    const { id } = req.params;

    const website = await prisma.website.findUnique({
      where: { id: parseInt(id) },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            fullname: true,
          },
        },
      },
    });

    if (!website) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    res.status(200).json({
      success: true,
      website: website,
    });
  } catch (error) {
    console.error(chalk.red("Error fetching website:"), error);
    res.status(500).json({
      error: "Failed to fetch website",
      details: error.message,
    });
  }
};

// Get Website by Slug (for public viewing)
export const getWebsiteBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const website = await prisma.website.findUnique({
      where: { slug: slug },
    });

    if (!website) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // Increment view count
    await prisma.website.update({
      where: { id: website.id },
      data: { viewCount: { increment: 1 } },
    });

    res.status(200).json({
      success: true,
      website: website,
    });
  } catch (error) {
    console.error(chalk.red("Error fetching website by slug:"), error);
    res.status(500).json({
      error: "Failed to fetch website",
      details: error.message,
    });
  }
};

// Get all websites for an admin
export const getAdminWebsites = async (req, res) => {
  try {
    const { adminId } = req.params;

    const websites = await prisma.website.findMany({
      where: { adminId: parseInt(adminId) },
      orderBy: { updatedAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: websites.length,
      websites: websites,
    });
  } catch (error) {
    console.error(chalk.red("Error fetching admin websites:"), error);
    res.status(500).json({
      error: "Failed to fetch websites",
      details: error.message,
    });
  }
};

// Publish Website
export const publishWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body; // Get adminId from request body

    // Verify website exists and belongs to this admin
    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    if (adminId && existingWebsite.adminId !== parseInt(adminId)) {
      return res.status(403).json({
        error: "Forbidden: You don't have permission to publish this website",
      });
    }

    const website = await prisma.website.update({
      where: { id: parseInt(id) },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    console.log(chalk.green(`Website published: ${website.id}`));
    res.status(200).json({
      success: true,
      message: "Website published successfully",
      website: website,
    });
  } catch (error) {
    console.error(chalk.red("Error publishing website:"), error);
    res.status(500).json({
      error: "Failed to publish website",
      details: error.message,
    });
  }
};

// Unpublish Website
export const unpublishWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body; // Get adminId from request body

    // Verify website exists and belongs to this admin
    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    if (adminId && existingWebsite.adminId !== parseInt(adminId)) {
      return res.status(403).json({
        error: "Forbidden: You don't have permission to unpublish this website",
      });
    }

    const website = await prisma.website.update({
      where: { id: parseInt(id) },
      data: {
        status: "DRAFT",
      },
    });

    console.log(chalk.green(`Website unpublished: ${website.id}`));
    res.status(200).json({
      success: true,
      message: "Website unpublished successfully",
      website: website,
    });
  } catch (error) {
    console.error(chalk.red("Error unpublishing website:"), error);
    res.status(500).json({
      error: "Failed to unpublish website",
      details: error.message,
    });
  }
};

// Delete Website
export const deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body; // Get adminId from request body

    // Verify website exists and belongs to this admin
    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    if (adminId && existingWebsite.adminId !== parseInt(adminId)) {
      return res.status(403).json({
        error: "Forbidden: You don't have permission to delete this website",
      });
    }

    await prisma.website.delete({
      where: { id: parseInt(id) },
    });

    console.log(chalk.green(`Website deleted: ${id}`));
    res.status(200).json({
      success: true,
      message: "Website deleted successfully",
    });
  } catch (error) {
    console.error(chalk.red("Error deleting website:"), error);
    res.status(500).json({
      error: "Failed to delete website",
      details: error.message,
    });
  }
};