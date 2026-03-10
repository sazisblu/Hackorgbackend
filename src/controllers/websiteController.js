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

// Helper: Check if admin has access to hackathon
const checkHackathonAccess = async (adminId, hackathonId) => {
  const membership = await prisma.adminHackathon.findUnique({
    where: {
      adminId_hackathonId: {
        adminId: parseInt(adminId),
        hackathonId: parseInt(hackathonId),
      },
    },
  });
  return membership !== null;
};

// Create or Update Website (new hackathon-based system)
export const saveWebsite = async (req, res) => {
  try {
    const { websiteData, adminId, websiteId, hackathonId } = req.body;

    // Validate required fields
    if (!websiteData) {
      return res.status(400).json({
        error: "Missing required field: websiteData",
      });
    }

    // Validate websiteData structure
    if (!websiteData.eventName) {
      return res.status(400).json({
        error: "websiteData must include eventName",
      });
    }

    // New system: hackathonId is primary key
    if (hackathonId) {
      // Verify admin has access to this hackathon
      const hasAccess = await checkHackathonAccess(adminId, hackathonId);
      if (!hasAccess) {
        return res.status(403).json({
          error: "Forbidden: You don't have access to this hackathon",
        });
      }

      // Check if hackathon already has a website
      const hackathon = await prisma.hackathon.findUnique({
        where: { id: parseInt(hackathonId) },
        include: { website: true },
      });

      if (!hackathon) {
        return res.status(404).json({
          error: "Hackathon not found",
        });
      }

      // Generate slug from eventName (use hackathon name as fallback)
      const eventName = websiteData.eventName || hackathon.name;
      const slug = generateSlug(eventName);

      if (hackathon.website) {
        // Update existing website
        const website = await prisma.website.update({
          where: { id: hackathon.website.id },
          data: {
            title: eventName,
            description: websiteData.description || null,
            websiteData: websiteData,
            slug: slug,
            updatedAt: new Date(),
          },
        });

        console.log(chalk.green(`Website updated for hackathon ${hackathonId}: ${website.id}`));
        return res.status(200).json({
          success: true,
          message: "Website updated successfully",
          website: website,
          hackathon: {
            id: hackathon.id,
            name: hackathon.name,
          },
        });
      } else {
        // Create new website linked to hackathon
        let uniqueSlug = slug;
        let counter = 1;

        while (await prisma.website.findUnique({ where: { slug: uniqueSlug } })) {
          uniqueSlug = `${slug}-${counter}`;
          counter++;
        }

        const website = await prisma.website.create({
          data: {
            slug: uniqueSlug,
            title: eventName,
            description: websiteData.description || null,
            websiteData: websiteData,
            status: "DRAFT",
          },
        });

        // Link website to hackathon
        await prisma.hackathon.update({
          where: { id: parseInt(hackathonId) },
          data: { websiteId: website.id },
        });

        console.log(chalk.green(`Website created for hackathon ${hackathonId}: ${website.id}`));
        return res.status(201).json({
          success: true,
          message: "Website created successfully",
          website: website,
          hackathon: {
            id: hackathon.id,
            name: hackathon.name,
          },
        });
      }
    }

    // Legacy system: adminId + websiteId
    if (!adminId) {
      return res.status(400).json({
        error: "Missing required field: adminId or hackathonId",
      });
    }

    // Generate slug from eventName
    const slug = generateSlug(websiteData.eventName);

    // Check if updating existing website
    if (websiteId) {
      // First, verify that the website belongs to this admin (legacy check)
      const existingWebsite = await prisma.website.findUnique({
        where: { id: parseInt(websiteId) },
        include: { hackathon: true },
      });

      if (!existingWebsite) {
        return res.status(404).json({
          error: "Website not found",
        });
      }

      // Check access via hackathon membership or direct admin ownership
      let hasAccess = false;
      if (existingWebsite.adminId === parseInt(adminId)) {
        hasAccess = true;
      } else if (existingWebsite.hackathon) {
        hasAccess = await checkHackathonAccess(adminId, existingWebsite.hackathon.id);
      }

      if (!hasAccess) {
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
      // Create new website (legacy)
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
    const { adminId } = req.query;

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
        hackathon: {
          select: {
            id: true,
            name: true,
            joinCode: true,
          },
        },
      },
    });

    if (!website) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // If adminId is provided, verify access
    if (adminId) {
      let hasAccess = false;

      // Check direct ownership (legacy)
      if (website.adminId === parseInt(adminId)) {
        hasAccess = true;
      }
      // Check hackathon membership
      else if (website.hackathon) {
        hasAccess = await checkHackathonAccess(adminId, website.hackathon.id);
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: "Forbidden: You don't have permission to access this website",
        });
      }
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
      include: {
        hackathon: {
          select: {
            id: true,
            name: true,
            joinCode: true,
          },
        },
      },
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

// Get website by hackathon ID
export const getWebsiteByHackathon = async (req, res) => {
  try {
    const { hackathonId } = req.params;
    const { adminId } = req.query;

    // Verify admin has access to this hackathon
    if (adminId) {
      const hasAccess = await checkHackathonAccess(adminId, hackathonId);
      if (!hasAccess) {
        return res.status(403).json({
          error: "Forbidden: You don't have access to this hackathon",
        });
      }
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: parseInt(hackathonId) },
      include: {
        website: true,
      },
    });

    if (!hackathon) {
      return res.status(404).json({
        error: "Hackathon not found",
      });
    }

    res.status(200).json({
      success: true,
      hackathon: {
        id: hackathon.id,
        name: hackathon.name,
        joinCode: hackathon.joinCode,
      },
      website: hackathon.website,
    });
  } catch (error) {
    console.error(chalk.red("Error fetching website by hackathon:"), error);
    res.status(500).json({
      error: "Failed to fetch website",
      details: error.message,
    });
  }
};

// Get all websites for an admin (legacy)
export const getAdminWebsites = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Get websites through hackathon membership
    const adminHackathons = await prisma.adminHackathon.findMany({
      where: { adminId: parseInt(adminId) },
      include: {
        hackathon: {
          include: {
            website: true,
          },
        },
      },
    });

    // Also get legacy websites directly owned by admin
    const legacyWebsites = await prisma.website.findMany({
      where: {
        adminId: parseInt(adminId),
        hackathon: null, // Not linked to a hackathon
      },
      orderBy: { updatedAt: "desc" },
    });

    // Combine and format results
    const hackathonWebsites = adminHackathons
      .filter((ah) => ah.hackathon.website)
      .map((ah) => ({
        ...ah.hackathon.website,
        hackathon: {
          id: ah.hackathon.id,
          name: ah.hackathon.name,
          role: ah.role,
        },
      }));

    const allWebsites = [...hackathonWebsites, ...legacyWebsites];

    res.status(200).json({
      success: true,
      count: allWebsites.length,
      websites: allWebsites,
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
    const { adminId, hackathonId } = req.body;

    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
      include: { hackathon: true },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // Check access
    let hasAccess = false;
    if (hackathonId && existingWebsite.hackathon?.id === parseInt(hackathonId)) {
      hasAccess = await checkHackathonAccess(adminId, hackathonId);
    } else if (adminId && existingWebsite.adminId === parseInt(adminId)) {
      hasAccess = true;
    }

    if (!hasAccess) {
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
    const { adminId, hackathonId } = req.body;

    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
      include: { hackathon: true },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // Check access
    let hasAccess = false;
    if (hackathonId && existingWebsite.hackathon?.id === parseInt(hackathonId)) {
      hasAccess = await checkHackathonAccess(adminId, hackathonId);
    } else if (adminId && existingWebsite.adminId === parseInt(adminId)) {
      hasAccess = true;
    }

    if (!hasAccess) {
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
    const { adminId, hackathonId } = req.body;

    const existingWebsite = await prisma.website.findUnique({
      where: { id: parseInt(id) },
      include: { hackathon: true },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        error: "Website not found",
      });
    }

    // Check access
    let hasAccess = false;
    if (hackathonId && existingWebsite.hackathon?.id === parseInt(hackathonId)) {
      hasAccess = await checkHackathonAccess(adminId, hackathonId);
    } else if (adminId && existingWebsite.adminId === parseInt(adminId)) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: "Forbidden: You don't have permission to delete this website",
      });
    }

    // If linked to hackathon, unlink first
    if (existingWebsite.hackathon) {
      await prisma.hackathon.update({
        where: { id: existingWebsite.hackathon.id },
        data: { websiteId: null },
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