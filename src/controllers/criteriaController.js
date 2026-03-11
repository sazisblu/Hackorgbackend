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

// Create a new judging criteria for a hackathon
export const createCriteria = async (req, res) => {
  const { hackathonId } = req.params;
  const { name, description, maxScore, weight, order } = req.body;
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!name) {
    return res.status(400).json({
      success: false,
      error: "Missing required field: name",
    });
  }

  try {
    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Check if criteria with same name already exists
    const existing = await prisma.judgingCriteria.findUnique({
      where: {
        name_hackathonId: {
          name,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Criteria with this name already exists for this hackathon",
      });
    }

    // Get max order if not provided
    let criteriaOrder = order;
    if (criteriaOrder === undefined || criteriaOrder === null) {
      const maxOrderCriteria = await prisma.judgingCriteria.findFirst({
        where: { hackathonId: parseInt(hackathonId) },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      criteriaOrder = maxOrderCriteria ? maxOrderCriteria.order + 1 : 0;
    }

    const criteria = await prisma.judgingCriteria.create({
      data: {
        name,
        description: description || null,
        maxScore: maxScore || 10,
        weight: weight || 1.0,
        order: criteriaOrder,
        hackathonId: parseInt(hackathonId),
      },
    });

    res.status(201).json({
      success: true,
      criteria,
    });
  } catch (error) {
    console.error("Error creating criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all criteria for a hackathon
export const getCriteriaByHackathon = async (req, res) => {
  const { hackathonId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    const criteria = await prisma.judgingCriteria.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      orderBy: { order: "asc" },
    });

    res.status(200).json({
      success: true,
      criteria,
    });
  } catch (error) {
    console.error("Error fetching criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get public criteria for a hackathon (for judges/participants)
export const getPublicCriteria = async (req, res) => {
  const { hackathonId } = req.params;

  try {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: parseInt(hackathonId) },
    });

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        error: "Hackathon not found",
      });
    }

    const criteria = await prisma.judgingCriteria.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        maxScore: true,
        weight: true,
        order: true,
      },
    });

    res.status(200).json({
      success: true,
      criteria,
    });
  } catch (error) {
    console.error("Error fetching public criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update a criteria
export const updateCriteria = async (req, res) => {
  const { id } = req.params;
  const { name, description, maxScore, weight, order } = req.body;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Get the criteria and verify access
    const existingCriteria = await prisma.judgingCriteria.findUnique({
      where: { id: parseInt(id) },
      include: { hackathon: true },
    });

    if (!existingCriteria) {
      return res.status(404).json({
        success: false,
        error: "Criteria not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: existingCriteria.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Check if new name conflicts with existing criteria
    if (name && name !== existingCriteria.name) {
      const nameConflict = await prisma.judgingCriteria.findUnique({
        where: {
          name_hackathonId: {
            name,
            hackathonId: existingCriteria.hackathonId,
          },
        },
      });

      if (nameConflict) {
        return res.status(400).json({
          success: false,
          error: "Criteria with this name already exists for this hackathon",
        });
      }
    }

    const criteria = await prisma.judgingCriteria.update({
      where: { id: parseInt(id) },
      data: {
        name: name || existingCriteria.name,
        description: description !== undefined ? description : existingCriteria.description,
        maxScore: maxScore !== undefined ? maxScore : existingCriteria.maxScore,
        weight: weight !== undefined ? weight : existingCriteria.weight,
        order: order !== undefined ? order : existingCriteria.order,
      },
    });

    res.status(200).json({
      success: true,
      criteria,
    });
  } catch (error) {
    console.error("Error updating criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete a criteria
export const deleteCriteria = async (req, res) => {
  const { id } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Get the criteria and verify access
    const existingCriteria = await prisma.judgingCriteria.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingCriteria) {
      return res.status(404).json({
        success: false,
        error: "Criteria not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: existingCriteria.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Delete the criteria (this will cascade delete associated scores)
    await prisma.judgingCriteria.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "Criteria deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Reorder criteria
export const reorderCriteria = async (req, res) => {
  const { hackathonId } = req.params;
  const { criteriaOrder } = req.body; // Array of { id, order }
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!Array.isArray(criteriaOrder)) {
    return res.status(400).json({
      success: false,
      error: "criteriaOrder must be an array of { id, order }",
    });
  }

  try {
    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Update all criteria orders in a transaction
    await prisma.$transaction(
      criteriaOrder.map((item) =>
        prisma.judgingCriteria.update({
          where: { id: parseInt(item.id) },
          data: { order: item.order },
        })
      )
    );

    res.status(200).json({
      success: true,
      message: "Criteria reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering criteria:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};