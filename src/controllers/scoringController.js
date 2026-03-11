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

// Submit scores for an assignment (judge evaluating a project)
export const submitScores = async (req, res) => {
  const { assignmentId } = req.params;
  const { scores } = req.body; // Array of { criteriaId, score, feedback }
  const adminId = parseInt(req.headers["x-admin-id"]);

  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({
      success: false,
      error: "scores must be a non-empty array of { criteriaId, score, feedback }",
    });
  }

  try {
    // Get the assignment and verify the judge
    const assignment = await prisma.judgeAssignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        judge: true,
        project: {
          include: { hackathon: true },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found",
      });
    }

    // Verify the requesting admin is the judge
    if (assignment.judge.adminId !== adminId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to submit scores for this assignment",
      });
    }

    // Get all criteria for this hackathon
    const allCriteria = await prisma.judgingCriteria.findMany({
      where: { hackathonId: assignment.project.hackathonId },
    });

    // Validate scores
    for (const scoreItem of scores) {
      const criteria = allCriteria.find((c) => c.id === parseInt(scoreItem.criteriaId));
      if (!criteria) {
        return res.status(400).json({
          success: false,
          error: `Invalid criteriaId: ${scoreItem.criteriaId}`,
        });
      }
      if (scoreItem.score < 0 || scoreItem.score > criteria.maxScore) {
        return res.status(400).json({
          success: false,
          error: `Score for "${criteria.name}" must be between 0 and ${criteria.maxScore}`,
        });
      }
    }

    // Submit scores in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing scores for this assignment
      await tx.score.deleteMany({
        where: { judgeAssignmentId: parseInt(assignmentId) },
      });

      // Create new scores
      const createdScores = await tx.score.createMany({
        data: scores.map((s) => ({
          judgeAssignmentId: parseInt(assignmentId),
          criteriaId: parseInt(s.criteriaId),
          score: parseInt(s.score),
          feedback: s.feedback || null,
        })),
      });

      // Mark assignment as completed
      const updatedAssignment = await tx.judgeAssignment.update({
        where: { id: parseInt(assignmentId) },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });

      // Update project status if needed
      const allAssignments = await tx.judgeAssignment.findMany({
        where: { projectId: assignment.projectId },
        select: { isCompleted: true },
      });

      // If all assignments are completed, update project status
      if (allAssignments.every((a) => a.isCompleted)) {
        await tx.project.update({
          where: { id: assignment.projectId },
          data: { status: "JUDGED" },
        });
      } else if (assignment.project.status === "SUBMITTED") {
        await tx.project.update({
          where: { id: assignment.projectId },
          data: { status: "UNDER_REVIEW" },
        });
      }

      return updatedAssignment;
    });

    res.status(200).json({
      success: true,
      message: "Scores submitted successfully",
      assignment: result,
    });
  } catch (error) {
    console.error("Error submitting scores:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get scores for an assignment
export const getScoresForAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        judge: true,
        project: {
          include: { hackathon: true },
        },
        scores: {
          include: {
            criteria: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found",
      });
    }

    // Verify access - either the judge or an admin of the hackathon
    const isJudge = assignment.judge.adminId === adminId;
    const isAdmin = await prisma.adminHackathon.findUnique({
      where: {
        adminId_hackathonId: {
          adminId,
          hackathonId: assignment.project.hackathonId,
        },
      },
    });

    if (!isJudge && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this assignment",
      });
    }

    res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error("Error fetching scores:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get assignment details with criteria for evaluation
export const getAssignmentForEvaluation = async (req, res) => {
  const { assignmentId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        judge: true,
        project: true,
        scores: {
          include: { criteria: true },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found",
      });
    }

    // Verify the requesting admin is the judge
    if (assignment.judge.adminId !== adminId) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to evaluate this assignment",
      });
    }

    // Get all criteria for the hackathon
    const criteria = await prisma.judgingCriteria.findMany({
      where: { hackathonId: assignment.project.hackathonId },
      orderBy: { order: "asc" },
    });

    res.status(200).json({
      success: true,
      assignment: {
        id: assignment.id,
        isCompleted: assignment.isCompleted,
        completedAt: assignment.completedAt,
        project: assignment.project,
        existingScores: assignment.scores,
      },
      criteria,
    });
  } catch (error) {
    console.error("Error fetching assignment for evaluation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Calculate project scores helper
const calculateProjectScore = async (projectId, hackathonId) => {
  // Get all criteria with weights
  const criteria = await prisma.judgingCriteria.findMany({
    where: { hackathonId },
  });

  // Get all completed assignments for this project
  const assignments = await prisma.judgeAssignment.findMany({
    where: {
      projectId,
      isCompleted: true,
    },
    include: {
      scores: true,
    },
  });

  if (assignments.length === 0) {
    return null;
  }

  // Calculate weighted scores for each assignment
  const assignmentScores = assignments.map((assignment) => {
    let totalWeightedScore = 0;
    let totalMaxWeightedScore = 0;

    for (const c of criteria) {
      const score = assignment.scores.find((s) => s.criteriaId === c.id);
      const earnedScore = score ? score.score : 0;
      totalWeightedScore += earnedScore * c.weight;
      totalMaxWeightedScore += c.maxScore * c.weight;
    }

    const normalizedScore = totalMaxWeightedScore > 0
      ? (totalWeightedScore / totalMaxWeightedScore) * 100
      : 0;

    return normalizedScore;
  });

  // Calculate average score across all judges
  const avgScore = assignmentScores.reduce((sum, s) => sum + s, 0) / assignmentScores.length;

  return {
    avgScore: Math.round(avgScore * 100) / 100, // Round to 2 decimal places
    judgeCount: assignments.length,
    individualScores: assignmentScores,
  };
};

// Get leaderboard for a hackathon
export const getLeaderboard = async (req, res) => {
  const { hackathonId } = req.params;
  const { limit } = req.query;

  try {
    // Get all judged projects for this hackathon
    const projects = await prisma.project.findMany({
      where: {
        hackathonId: parseInt(hackathonId),
        status: { in: ["JUDGED", "FINALIST", "WINNER"] },
      },
      include: {
        assignments: {
          where: { isCompleted: true },
          include: {
            scores: true,
          },
        },
      },
    });

    // Calculate scores for each project
    const leaderboardData = await Promise.all(
      projects.map(async (project) => {
        const scoreData = await calculateProjectScore(project.id, parseInt(hackathonId));
        return {
          id: project.id,
          name: project.name,
          teamName: project.teamName,
          description: project.description,
          demoUrl: project.demoUrl,
          status: project.status,
          ...scoreData,
        };
      })
    );

    // Filter out projects without scores and sort by average score
    const rankedProjects = leaderboardData
      .filter((p) => p.avgScore !== null)
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((project, index) => ({
        rank: index + 1,
        ...project,
      }));

    // Apply limit if provided
    const result = limit
      ? rankedProjects.slice(0, parseInt(limit))
      : rankedProjects;

    res.status(200).json({
      success: true,
      leaderboard: result,
      totalProjects: rankedProjects.length,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get detailed project scores (for organizers)
export const getProjectScores = async (req, res) => {
  const { projectId } = req.params;
  const adminId = parseInt(req.headers["x-admin-id"]);

  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(projectId) },
      include: {
        hackathon: true,
        assignments: {
          include: {
            judge: {
              include: {
                admin: {
                  select: { id: true, fullname: true, email: true },
                },
              },
            },
            scores: {
              include: {
                criteria: true,
              },
            },
          },
        },
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

    // Get criteria for score calculation
    const criteria = await prisma.judgingCriteria.findMany({
      where: { hackathonId: project.hackathonId },
      orderBy: { order: "asc" },
    });

    // Calculate overall score
    const scoreData = await calculateProjectScore(project.id, project.hackathonId);

    res.status(200).json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        teamName: project.teamName,
        status: project.status,
      },
      criteria,
      judgeScores: project.assignments.map((assignment) => ({
        judge: assignment.judge.admin,
        isCompleted: assignment.isCompleted,
        completedAt: assignment.completedAt,
        scores: assignment.scores,
      })),
      overallScore: scoreData,
    });
  } catch (error) {
    console.error("Error fetching project scores:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};