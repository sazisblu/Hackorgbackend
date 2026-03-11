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

// Get all hackathons where user is an organizer (AdminHackathon) or judge
export const getUserHackathonsForJudging = async (req, res) => {
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!adminId) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  try {
    // Get hackathons where user is an organizer
    const organizerMemberships = await prisma.adminHackathon.findMany({
      where: { adminId },
      include: {
        hackathon: {
          include: {
            _count: {
              select: {
                projects: { where: { status: { not: "DRAFT" } } },
                judges: true,
              },
            },
            criteria: true,
          },
        },
      },
    });

    // Get hackathons where user is a judge
    const judgeMemberships = await prisma.judge.findMany({
      where: { adminId },
      include: {
        hackathon: {
          include: {
            _count: {
              select: {
                projects: { where: { status: { not: "DRAFT" } } },
                judges: true,
              },
            },
            criteria: true,
          },
        },
      },
    });

    // Combine and deduplicate hackathons
    const hackathonMap = new Map();

    // Add organizer hackathons
    for (const membership of organizerMemberships) {
      const hackathon = membership.hackathon;
      if (!hackathonMap.has(hackathon.id)) {
        hackathonMap.set(hackathon.id, {
          id: hackathon.id,
          name: hackathon.name,
          description: hackathon.description,
          createdAt: hackathon.createdAt,
          isOrganizer: true,
          isJudge: false,
          totalProjects: hackathon._count.projects,
          totalJudges: hackathon._count.judges,
          criteriaCount: hackathon.criteria.length,
        });
      } else {
        hackathonMap.get(hackathon.id).isOrganizer = true;
      }
    }

    // Add judge hackathons
    for (const membership of judgeMemberships) {
      const hackathon = membership.hackathon;
      if (!hackathonMap.has(hackathon.id)) {
        hackathonMap.set(hackathon.id, {
          id: hackathon.id,
          name: hackathon.name,
          description: hackathon.description,
          createdAt: hackathon.createdAt,
          isOrganizer: false,
          isJudge: true,
          totalProjects: hackathon._count.projects,
          totalJudges: hackathon._count.judges,
          criteriaCount: hackathon.criteria.length,
        });
      } else {
        hackathonMap.get(hackathon.id).isJudge = true;
      }
    }

    // For judge hackathons, get assignment stats
    const hackathons = await Promise.all(
      Array.from(hackathonMap.values()).map(async (h) => {
        if (h.isJudge) {
          const judge = await prisma.judge.findUnique({
            where: {
              adminId_hackathonId: {
                adminId,
                hackathonId: h.id,
              },
            },
            include: {
              _count: {
                select: { assignments: true },
              },
              assignments: {
                where: { isCompleted: true },
                select: { id: true },
              },
            },
          });

          if (judge) {
            h.myAssignedProjects = judge._count.assignments;
            h.myCompletedEvaluations = judge.assignments.length;
          }
        }

        // Get evaluated projects count
        const evaluatedProjects = await prisma.project.count({
          where: {
            hackathonId: h.id,
            status: { in: ["JUDGED", "FINALIST", "WINNER"] },
          },
        });
        h.evaluatedProjects = evaluatedProjects;

        return h;
      })
    );

    res.status(200).json({
      success: true,
      hackathons: hackathons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    });
  } catch (error) {
    console.error("Error fetching judging hackathons:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get judging overview for a specific hackathon
export const getJudgingOverview = async (req, res) => {
  const { hackathonId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Check if user is organizer or judge
    const isOrganizer = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    const isJudge = await prisma.judge.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (!isOrganizer && !isJudge) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this hackathon",
      });
    }

    // Get hackathon details
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: parseInt(hackathonId) },
      include: {
        _count: {
          select: {
            projects: { where: { status: { not: "DRAFT" } } },
            judges: true,
            criteria: true,
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

    // Get project stats
    const totalProjects = await prisma.project.count({
      where: {
        hackathonId: parseInt(hackathonId),
        status: { not: "DRAFT" },
      },
    });

    const submittedProjects = await prisma.project.count({
      where: {
        hackathonId: parseInt(hackathonId),
        status: "SUBMITTED",
      },
    });

    const underReviewProjects = await prisma.project.count({
      where: {
        hackathonId: parseInt(hackathonId),
        status: "UNDER_REVIEW",
      },
    });

    const judgedProjects = await prisma.project.count({
      where: {
        hackathonId: parseInt(hackathonId),
        status: { in: ["JUDGED", "FINALIST", "WINNER"] },
      },
    });

    // Get judge stats
    const totalJudges = await prisma.judge.count({
      where: { hackathonId: parseInt(hackathonId) },
    });

    const totalAssignments = await prisma.judgeAssignment.count({
      where: {
        judge: { hackathonId: parseInt(hackathonId) },
      },
    });

    const completedAssignments = await prisma.judgeAssignment.count({
      where: {
        judge: { hackathonId: parseInt(hackathonId) },
        isCompleted: true,
      },
    });

    // Get criteria count
    const criteriaCount = await prisma.judgingCriteria.count({
      where: { hackathonId: parseInt(hackathonId) },
    });

    // For judges, get their personal stats
    let myStats = null;
    if (isJudge) {
      const judge = await prisma.judge.findUnique({
        where: {
          adminId_hackathonId: {
            adminId,
            hackathonId: parseInt(hackathonId),
          },
        },
        include: {
          _count: {
            select: { assignments: true },
          },
          assignments: {
            where: { isCompleted: true },
            select: { id: true },
          },
        },
      });

      if (judge) {
        myStats = {
          totalAssigned: judge._count.assignments,
          completed: judge.assignments.length,
          pending: judge._count.assignments - judge.assignments.length,
        };
      }
    }

    res.status(200).json({
      success: true,
      overview: {
        hackathon: {
          id: hackathon.id,
          name: hackathon.name,
          description: hackathon.description,
        },
        isOrganizer: !!isOrganizer,
        isJudge: !!isJudge,
        projects: {
          total: totalProjects,
          submitted: submittedProjects,
          underReview: underReviewProjects,
          judged: judgedProjects,
        },
        judges: {
          total: totalJudges,
          totalAssignments,
          completedAssignments,
        },
        criteriaCount,
        myStats,
      },
    });
  } catch (error) {
    console.error("Error fetching judging overview:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all assignments for a hackathon (matrix view data)
export const getAssignmentMatrix = async (req, res) => {
  const { hackathonId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Verify user is organizer
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
        error: "Only organizers can view assignment matrix",
      });
    }

    // Get all projects
    const projects = await prisma.project.findMany({
      where: {
        hackathonId: parseInt(hackathonId),
        status: { not: "DRAFT" },
      },
      select: {
        id: true,
        name: true,
        teamName: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    // Get all judges with their assignments
    const judges = await prisma.judge.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      include: {
        admin: {
          select: { id: true, fullname: true, email: true },
        },
        assignments: {
          include: {
            project: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Build assignment matrix
    const assignmentMatrix = judges.map((judge) => ({
      judge: {
        id: judge.id,
        adminId: judge.adminId,
        name: judge.admin.fullname,
        email: judge.admin.email,
      },
      assignments: judge.assignments.map((a) => ({
        projectId: a.projectId,
        assignmentId: a.id,
        isCompleted: a.isCompleted,
      })),
      totalAssigned: judge.assignments.length,
      completed: judge.assignments.filter((a) => a.isCompleted).length,
    }));

    // Project assignment counts
    const projectAssignmentCounts = {};
    for (const judge of judges) {
      for (const assignment of judge.assignments) {
        if (!projectAssignmentCounts[assignment.projectId]) {
          projectAssignmentCounts[assignment.projectId] = 0;
        }
        projectAssignmentCounts[assignment.projectId]++;
      }
    }

    res.status(200).json({
      success: true,
      matrix: {
        projects,
        judges: assignmentMatrix,
        projectAssignmentCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching assignment matrix:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Bulk assign projects to judges
export const bulkAssignProjects = async (req, res) => {
  const { hackathonId } = req.params;
  const { judgeIds, projectIds } = req.body;
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!Array.isArray(judgeIds) || !Array.isArray(projectIds)) {
    return res.status(400).json({
      success: false,
      error: "judgeIds and projectIds must be arrays",
    });
  }

  try {
    // Verify user is organizer
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
        error: "Only organizers can assign projects",
      });
    }

    // Create assignments
    const assignmentsToCreate = [];
    for (const judgeId of judgeIds) {
      for (const projectId of projectIds) {
        assignmentsToCreate.push({
          judgeId: parseInt(judgeId),
          projectId: parseInt(projectId),
        });
      }
    }

    // Check for existing assignments
    const existingAssignments = await prisma.judgeAssignment.findMany({
      where: {
        judgeId: { in: judgeIds.map((id) => parseInt(id)) },
        projectId: { in: projectIds.map((id) => parseInt(id)) },
      },
    });

    const existingKeys = new Set(
      existingAssignments.map((a) => `${a.judgeId}-${a.projectId}`)
    );

    const newAssignments = assignmentsToCreate.filter(
      (a) => !existingKeys.has(`${a.judgeId}-${a.projectId}`)
    );

    if (newAssignments.length > 0) {
      await prisma.judgeAssignment.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
    }

    res.status(200).json({
      success: true,
      message: `Created ${newAssignments.length} new assignments`,
      skipped: existingAssignments.length,
    });
  } catch (error) {
    console.error("Error bulk assigning projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Random assignment - distribute projects evenly among judges
export const randomAssignProjects = async (req, res) => {
  const { hackathonId } = req.params;
  const { projectsPerJudge, onlyUnassigned } = req.body;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    // Verify user is organizer
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
        error: "Only organizers can assign projects",
      });
    }

    // Get all judges
    const judges = await prisma.judge.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      select: { id: true },
    });

    if (judges.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No judges found for this hackathon",
      });
    }

    // Get projects
    let projectsQuery = {
      hackathonId: parseInt(hackathonId),
      status: { not: "DRAFT" },
    };

    // If onlyUnassigned, filter projects that have no assignments
    let projects;
    if (onlyUnassigned) {
      const assignedProjectIds = await prisma.judgeAssignment.findMany({
        where: {
          judge: { hackathonId: parseInt(hackathonId) },
        },
        select: { projectId: true },
      });
      const assignedIds = [...new Set(assignedProjectIds.map((a) => a.projectId))];

      projects = await prisma.project.findMany({
        where: {
          ...projectsQuery,
          id: { notIn: assignedIds },
        },
        select: { id: true },
      });
    } else {
      projects = await prisma.project.findMany({
        where: projectsQuery,
        select: { id: true },
      });
    }

    if (projects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No projects available for assignment",
      });
    }

    // Shuffle projects
    const shuffledProjects = projects.sort(() => Math.random() - 0.5);

    // Distribute projects to judges
    const assignmentsToCreate = [];
    const projectsCount = projectsPerJudge || Math.ceil(projects.length / judges.length);

    for (let i = 0; i < shuffledProjects.length; i++) {
      const judgeIndex = i % judges.length;
      const project = shuffledProjects[i];
      const judge = judges[judgeIndex];

      // Limit assignments per judge if specified
      if (projectsPerJudge) {
        const currentJudgeAssignments = assignmentsToCreate.filter(
          (a) => a.judgeId === judge.id
        ).length;
        if (currentJudgeAssignments >= projectsPerJudge) {
          continue;
        }
      }

      assignmentsToCreate.push({
        judgeId: judge.id,
        projectId: project.id,
      });
    }

    // Check for existing assignments
    const existingAssignments = await prisma.judgeAssignment.findMany({
      where: {
        judgeId: { in: judges.map((j) => j.id) },
        projectId: { in: projects.map((p) => p.id) },
      },
    });

    const existingKeys = new Set(
      existingAssignments.map((a) => `${a.judgeId}-${a.projectId}`)
    );

    const newAssignments = assignmentsToCreate.filter(
      (a) => !existingKeys.has(`${a.judgeId}-${a.projectId}`)
    );

    if (newAssignments.length > 0) {
      await prisma.judgeAssignment.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
    }

    res.status(200).json({
      success: true,
      message: `Created ${newAssignments.length} new assignments`,
      skipped: existingAssignments.length,
    });
  } catch (error) {
    console.error("Error randomly assigning projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};