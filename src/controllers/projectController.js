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

// Create a new project for a hackathon
export const createProject = async (req, res) => {
  const { hackathonId } = req.params;
  const {
    name,
    description,
    repoUrl,
    demoUrl,
    presentationUrl,
    videoUrl,
    teamName,
    teamMembers,
    teamLeaderEmail,
    registrationId,
  } = req.body;

  if (!name || !teamName) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: name, teamName",
    });
  }

  try {
    // Verify hackathon exists
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: parseInt(hackathonId) },
    });

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        error: "Hackathon not found",
      });
    }

    // If registrationId is provided, verify it exists and belongs to this hackathon
    if (registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: parseInt(registrationId) },
      });

      if (!registration || registration.hackathonId !== parseInt(hackathonId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid registration for this hackathon",
        });
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        repoUrl: repoUrl || null,
        demoUrl: demoUrl || null,
        presentationUrl: presentationUrl || null,
        videoUrl: videoUrl || null,
        teamName,
        teamMembers: teamMembers || [],
        teamLeaderEmail: teamLeaderEmail || null,
        registrationId: registrationId ? parseInt(registrationId) : null,
        hackathonId: parseInt(hackathonId),
        status: "SUBMITTED",
      },
    });

    res.status(201).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all projects for a hackathon
export const getProjectsByHackathon = async (req, res) => {
  const { hackathonId } = req.params;
  const { status } = req.query;
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

    const whereClause = {
      hackathonId: parseInt(hackathonId),
    };

    if (status) {
      whereClause.status = status;
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { submittedAt: "desc" },
    });

    res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get public projects for a hackathon (limited info)
export const getPublicProjects = async (req, res) => {
  const { hackathonId } = req.params;

  try {
    const projects = await prisma.project.findMany({
      where: {
        hackathonId: parseInt(hackathonId),
        status: { not: "DRAFT" },
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        teamName: true,
        demoUrl: true,
        status: true,
        submittedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Error fetching public projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get project by ID
export const getProjectById = async (req, res) => {
  const { id } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(id) },
      include: {
        hackathon: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: project.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this project",
      });
    }

    res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update project
export const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    repoUrl,
    demoUrl,
    presentationUrl,
    videoUrl,
    teamName,
    teamMembers,
    teamLeaderEmail,
    status,
  } = req.body;

  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        name: name || existingProject.name,
        description: description !== undefined ? description : existingProject.description,
        repoUrl: repoUrl !== undefined ? repoUrl : existingProject.repoUrl,
        demoUrl: demoUrl !== undefined ? demoUrl : existingProject.demoUrl,
        presentationUrl: presentationUrl !== undefined ? presentationUrl : existingProject.presentationUrl,
        videoUrl: videoUrl !== undefined ? videoUrl : existingProject.videoUrl,
        teamName: teamName || existingProject.teamName,
        teamMembers: teamMembers !== undefined ? teamMembers : existingProject.teamMembers,
        teamLeaderEmail: teamLeaderEmail !== undefined ? teamLeaderEmail : existingProject.teamLeaderEmail,
        status: status || existingProject.status,
      },
    });

    res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete project
export const deleteProject = async (req, res) => {
  const { id } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: existingProject.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this project",
      });
    }

    await prisma.project.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update project status
export const updateProjectStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!status) {
    return res.status(400).json({
      success: false,
      error: "Missing required field: status",
    });
  }

  const validStatuses = ["DRAFT", "SUBMITTED"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    // Verify admin has access to this hackathon
    const membership = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: existingProject.hackathonId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this project",
      });
    }

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Error updating project status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};