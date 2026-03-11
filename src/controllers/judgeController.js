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

// Add a judge to a hackathon
export const addJudge = async (req, res) => {
  const { hackathonId } = req.params;
  const { adminId: judgeAdminId } = req.body;
  const requestingAdminId = parseInt(req.headers["x-admin-id"]);

  if (!judgeAdminId) {
    return res.status(400).json({
      success: false,
      error: "Missing required field: adminId",
    });
  }

  try {
    // Verify requesting admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId: requestingAdminId,
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

    // Verify the judge admin exists
    const judgeAdmin = await prisma.admin.findUnique({
      where: { id: parseInt(judgeAdminId) },
    });

    if (!judgeAdmin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found",
      });
    }

    // Check if already a judge
    const existingJudge = await prisma.judge.findUnique({
      where: {
        adminId_hackathonId: {
          adminId: parseInt(judgeAdminId),
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (existingJudge) {
      return res.status(400).json({
        success: false,
        error: "This admin is already a judge for this hackathon",
      });
    }

    const judge = await prisma.judge.create({
      data: {
        adminId: parseInt(judgeAdminId),
        hackathonId: parseInt(hackathonId),
      },
      include: {
        admin: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      judge,
    });
  } catch (error) {
    console.error("Error adding judge:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all judges for a hackathon
export const getJudgesByHackathon = async (req, res) => {
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

    const judges = await prisma.judge.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      include: {
        admin: {
          select: { id: true, fullname: true, email: true, image: true },
        },
        _count: {
          select: { assignments: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      judges,
    });
  } catch (error) {
    console.error("Error fetching judges:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Remove a judge from a hackathon
export const removeJudge = async (req, res) => {
  const { id } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const judge = await prisma.judge.findUnique({
      where: { id: parseInt(id) },
      include: { hackathon: true },
    });

    if (!judge) {
      return res.status(404).json({
        success: false,
        error: "Judge not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: judge.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    await prisma.judge.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "Judge removed successfully",
    });
  } catch (error) {
    console.error("Error removing judge:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Assign projects to a judge
export const assignProjectsToJudge = async (req, res) => {
  const { judgeId } = req.params;
  const { projectIds } = req.body; // Array of project IDs
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!Array.isArray(projectIds)) {
    return res.status(400).json({
      success: false,
      error: "projectIds must be an array",
    });
  }

  try {
    const judge = await prisma.judge.findUnique({
      where: { id: parseInt(judgeId) },
      include: { hackathon: true },
    });

    if (!judge) {
      return res.status(404).json({
        success: false,
        error: "Judge not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: judge.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Verify all projects belong to the same hackathon
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds.map((id) => parseInt(id)) },
        hackathonId: judge.hackathonId,
      },
    });

    if (projects.length !== projectIds.length) {
      return res.status(400).json({
        success: false,
        error: "Some projects not found or don't belong to this hackathon",
      });
    }

    // Create assignments (skip duplicates)
    const existingAssignments = await prisma.judgeAssignment.findMany({
      where: {
        judgeId: parseInt(judgeId),
        projectId: { in: projectIds.map((id) => parseInt(id)) },
      },
    });

    const existingProjectIds = existingAssignments.map((a) => a.projectId);
    const newProjectIds = projectIds
      .map((id) => parseInt(id))
      .filter((id) => !existingProjectIds.includes(id));

    if (newProjectIds.length > 0) {
      await prisma.judgeAssignment.createMany({
        data: newProjectIds.map((projectId) => ({
          judgeId: parseInt(judgeId),
          projectId,
        })),
      });
    }

    res.status(200).json({
      success: true,
      message: `Assigned ${newProjectIds.length} new projects to judge`,
      skipped: existingProjectIds.length,
    });
  } catch (error) {
    console.error("Error assigning projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Remove project assignment from judge
export const removeAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        judge: { include: { hackathon: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: assignment.judge.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    await prisma.judgeAssignment.delete({
      where: { id: parseInt(assignmentId) },
    });

    res.status(200).json({
      success: true,
      message: "Assignment removed successfully",
    });
  } catch (error) {
    console.error("Error removing assignment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get judge's assigned projects
export const getJudgeAssignments = async (req, res) => {
  const { judgeId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const judge = await prisma.judge.findUnique({
      where: { id: parseInt(judgeId) },
    });

    if (!judge) {
      return res.status(404).json({
        success: false,
        error: "Judge not found",
      });
    }

    // Verify this is the judge's own data or admin has access
    const isAdmin = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: judge.hackathonId,
        },
      },
    });

    if (judge.adminId !== adminId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this data",
      });
    }

    const assignments = await prisma.judgeAssignment.findMany({
      where: { judgeId: parseInt(judgeId) },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            teamName: true,
            demoUrl: true,
            repoUrl: true,
            presentationUrl: true,
            videoUrl: true,
            status: true,
          },
        },
        scores: {
          include: {
            criteria: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get my judge profile and assignments (for logged-in judge)
export const getMyJudgeProfile = async (req, res) => {
  const { hackathonId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const judge = await prisma.judge.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
      include: {
        hackathon: {
          select: { id: true, name: true },
        },
        admin: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    if (!judge) {
      return res.status(404).json({
        success: false,
        error: "You are not a judge for this hackathon",
      });
    }

    const assignments = await prisma.judgeAssignment.findMany({
      where: { judgeId: judge.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            teamName: true,
            demoUrl: true,
            repoUrl: true,
            presentationUrl: true,
            videoUrl: true,
            status: true,
          },
        },
        scores: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      judge,
      assignments,
      stats: {
        total: assignments.length,
        completed: assignments.filter((a) => a.isCompleted).length,
        pending: assignments.filter((a) => !a.isCompleted).length,
      },
    });
  } catch (error) {
    console.error("Error fetching judge profile:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};