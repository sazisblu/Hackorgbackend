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

// Helper: Get or create a Judge record for an admin in a hackathon
async function getOrCreateJudge(adminId, hackathonId) {
  let judge = await prisma.judge.findUnique({
    where: {
      adminId_hackathonId: {
        adminId,
        hackathonId,
      },
    },
  });

  if (!judge) {
    judge = await prisma.judge.create({
      data: {
        adminId,
        hackathonId,
      },
    });
  }

  return judge;
}

// Get all hackathons where user is an organizer (AdminHackathon) - they are automatically judges
export const getUserHackathonsForJudging = async (req, res) => {
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!adminId) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  try {
    // Get hackathons where user is an organizer (automatically a judge too)
    const organizerMemberships = await prisma.adminHackathon.findMany({
      where: { adminId },
      include: {
        hackathon: {
          include: {
            _count: {
              select: {
                projects: { where: { status: { not: "DRAFT" } } },
                admins: true, // All admins are potential judges
              },
            },
            judgingCriteria: true,
          },
        },
      },
    });

    // Combine into hackathons list - all organizers are automatically judges
    const hackathons = await Promise.all(
      organizerMemberships.map(async (membership) => {
        const hackathon = membership.hackathon;

        // Get or create judge record to check assignments
        const judge = await getOrCreateJudge(adminId, hackathon.id);

        // Get assignment stats for this judge
        const assignmentStats = await prisma.judgeAssignment.count({
          where: { judgeId: judge.id },
        });

        const completedStats = await prisma.judgeAssignment.count({
          where: {
            judgeId: judge.id,
            isCompleted: true,
          },
        });

        // Get evaluated projects count
        const evaluatedProjects = await prisma.project.count({
          where: {
            hackathonId: hackathon.id,
            status: { in: ["JUDGED", "FINALIST", "WINNER"] },
          },
        });

        return {
          id: hackathon.id,
          name: hackathon.name,
          description: hackathon.description,
          createdAt: hackathon.createdAt,
          isOrganizer: true,
          isJudge: true, // All organizers are automatically judges
          totalProjects: hackathon._count.projects,
          totalJudges: hackathon._count.admins, // All admins are judges
          criteriaCount: hackathon.judgingCriteria.length,
          evaluatedProjects,
          myAssignedProjects: assignmentStats,
          myCompletedEvaluations: completedStats,
        };
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
    // Check if user is organizer (AdminHackathon member)
    const isOrganizer = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: parseInt(hackathonId),
        },
      },
    });

    if (!isOrganizer) {
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
            admins: true, // All admins are judges
            judgingCriteria: true,
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

    // Get all judges (all admins in hackathon)
    const totalJudges = hackathon._count.admins;

    // Get assignment stats
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
    const criteriaCount = hackathon._count.judgingCriteria;

    // Get personal stats - ensure judge record exists
    const judge = await getOrCreateJudge(adminId, parseInt(hackathonId));

    const myStats = {
      totalAssigned: await prisma.judgeAssignment.count({
        where: { judgeId: judge.id },
      }),
      completed: await prisma.judgeAssignment.count({
        where: { judgeId: judge.id, isCompleted: true },
      }),
    };
    myStats.pending = myStats.totalAssigned - myStats.completed;

    res.status(200).json({
      success: true,
      overview: {
        hackathon: {
          id: hackathon.id,
          name: hackathon.name,
          description: hackathon.description,
        },
        isOrganizer: true,
        isJudge: true, // All organizers are automatically judges
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

    // Get all admins (potential judges) for this hackathon
    const hackathonAdmins = await prisma.adminHackathon.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      include: {
        admin: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    // Build assignment matrix - ensure judge records exist for all admins
    const judgesMatrix = await Promise.all(
      hackathonAdmins.map(async (membership) => {
        // Get or create judge record
        const judge = await getOrCreateJudge(membership.adminId, parseInt(hackathonId));

        // Get assignments for this judge
        const assignments = await prisma.judgeAssignment.findMany({
          where: { judgeId: judge.id },
          include: {
            project: { select: { id: true } },
          },
        });

        return {
          judge: {
            id: judge.id,
            adminId: membership.adminId,
            name: membership.admin.fullname,
            email: membership.admin.email,
          },
          assignments: assignments.map((a) => ({
            projectId: a.projectId,
            assignmentId: a.id,
            isCompleted: a.isCompleted,
          })),
          totalAssigned: assignments.length,
          completed: assignments.filter((a) => a.isCompleted).length,
        };
      })
    );

    // Project assignment counts
    const projectAssignmentCounts = {};
    for (const judge of judgesMatrix) {
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
        judges: judgesMatrix,
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

// Bulk assign projects to judges (by adminId)
export const bulkAssignProjects = async (req, res) => {
  const { hackathonId } = req.params;
  const { adminIds, projectIds } = req.body; // Changed from judgeIds to adminIds
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!Array.isArray(adminIds) || !Array.isArray(projectIds)) {
    return res.status(400).json({
      success: false,
      error: "adminIds and projectIds must be arrays",
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

    // Verify all admins are members of this hackathon
    const validAdmins = await prisma.adminHackathon.findMany({
      where: {
        adminId: { in: adminIds.map((id) => parseInt(id)) },
        hackathonId: parseInt(hackathonId),
      },
    });

    if (validAdmins.length !== adminIds.length) {
      return res.status(400).json({
        success: false,
        error: "Some admins are not members of this hackathon",
      });
    }

    // Create assignments
    const newAssignments = [];
    const existingCount = { count: 0 };

    for (const adminIdToAssign of adminIds) {
      // Get or create judge record
      const judge = await getOrCreateJudge(parseInt(adminIdToAssign), parseInt(hackathonId));

      for (const projectId of projectIds) {
        // Check if assignment already exists
        const existing = await prisma.judgeAssignment.findUnique({
          where: {
            judgeId_projectId: {
              judgeId: judge.id,
              projectId: parseInt(projectId),
            },
          },
        });

        if (!existing) {
          await prisma.judgeAssignment.create({
            data: {
              judgeId: judge.id,
              projectId: parseInt(projectId),
            },
          });
          newAssignments.push({ judgeId: judge.id, projectId });
        } else {
          existingCount.count++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Created ${newAssignments.length} new assignments`,
      skipped: existingCount.count,
    });
  } catch (error) {
    console.error("Error bulk assigning projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Random assignment - distribute projects evenly among all admins
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

    // Get all admins (potential judges) for this hackathon
    const hackathonAdmins = await prisma.adminHackathon.findMany({
      where: { hackathonId: parseInt(hackathonId) },
      select: { adminId: true },
    });

    if (hackathonAdmins.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No admins found for this hackathon",
      });
    }

    // Get projects
    let projects;
    if (onlyUnassigned) {
      // Get all assigned project IDs
      const allAssignments = await prisma.judgeAssignment.findMany({
        where: {
          judge: { hackathonId: parseInt(hackathonId) },
        },
        select: { projectId: true },
      });
      const assignedIds = [...new Set(allAssignments.map((a) => a.projectId))];

      projects = await prisma.project.findMany({
        where: {
          hackathonId: parseInt(hackathonId),
          status: { not: "DRAFT" },
          id: { notIn: assignedIds },
        },
        select: { id: true },
      });
    } else {
      projects = await prisma.project.findMany({
        where: {
          hackathonId: parseInt(hackathonId),
          status: { not: "DRAFT" },
        },
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

    // Distribute projects to admins
    const newAssignments = [];
    const assignmentCounts = {}; // Track assignments per admin

    for (let i = 0; i < shuffledProjects.length; i++) {
      const adminIndex = i % hackathonAdmins.length;
      const adminToAssign = hackathonAdmins[adminIndex];
      const project = shuffledProjects[i];

      // Limit assignments per judge if specified
      if (projectsPerJudge) {
        const key = adminToAssign.adminId;
        if (!assignmentCounts[key]) assignmentCounts[key] = 0;
        if (assignmentCounts[key] >= projectsPerJudge) {
          continue;
        }
        assignmentCounts[key]++;
      }

      // Get or create judge record
      const judge = await getOrCreateJudge(adminToAssign.adminId, parseInt(hackathonId));

      // Check if assignment already exists
      const existing = await prisma.judgeAssignment.findUnique({
        where: {
          judgeId_projectId: {
            judgeId: judge.id,
            projectId: project.id,
          },
        },
      });

      if (!existing) {
        await prisma.judgeAssignment.create({
          data: {
            judgeId: judge.id,
            projectId: project.id,
          },
        });
        newAssignments.push({ adminId: adminToAssign.adminId, projectId: project.id });
      }
    }

    res.status(200).json({
      success: true,
      message: `Created ${newAssignments.length} new assignments`,
      totalProjects: projects.length,
      totalJudges: hackathonAdmins.length,
    });
  } catch (error) {
    console.error("Error randomly assigning projects:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};