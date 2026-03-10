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

// Get admin dashboard statistics
export const getAdminStats = async (req, res) => {
  const { adminId } = req.params;

  try {
    // Get all hackathons the admin is part of
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
                viewCount: true,
                publishedAt: true,
              },
            },
            registrations: {
              select: {
                id: true,
                status: true,
                registeredAt: true,
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: { registeredAt: 'desc' },
            },
          },
        },
      },
    });

    // Calculate summary stats
    const totalHackathons = adminHackathons.length;
    const hackathonsWithWebsite = adminHackathons.filter(ah => ah.hackathon.website);
    const publishedHackathons = hackathonsWithWebsite.filter(ah => ah.hackathon.website?.status === 'PUBLISHED').length;
    const draftHackathons = totalHackathons - publishedHackathons;

    // Get all registrations from hackathons (primary source)
    const allRegistrations = adminHackathons.flatMap(ah =>
      (ah.hackathon.registrations || []).map(r => ({
        ...r,
        hackathonName: ah.hackathon.name,
        hackathonId: ah.hackathon.id,
        website: ah.hackathon.website,
      }))
    );

    const totalParticipants = allRegistrations.length;
    const pendingRegistrations = allRegistrations.filter(r => r.status === 'PENDING').length;
    const approvedRegistrations = allRegistrations.filter(r => r.status === 'APPROVED').length;
    const rejectedRegistrations = allRegistrations.filter(r => r.status === 'REJECTED').length;

    // Try to get mentors count
    let totalMentors = 0;
    let activeMentors = 0;
    try {
      const websiteIds = hackathonsWithWebsite
        .map(ah => ah.hackathon.website?.id)
        .filter(id => id !== undefined);

      if (websiteIds.length > 0) {
        const mentors = await prisma.mentor.findMany({
          where: { websiteId: { in: websiteIds } },
          select: { id: true, status: true }
        });
        totalMentors = mentors.length;
        activeMentors = mentors.filter(m => m.status === 'ACTIVE').length;
      }
    } catch (mentorError) {
      console.log("Mentor table not found, skipping mentor stats");
    }

    // Format hackathons list
    const hackathonsList = adminHackathons.map(ah => {
      const hackathon = ah.hackathon;
      const website = hackathon.website;
      const registrations = hackathon.registrations || [];

      return {
        id: hackathon.id,
        name: hackathon.name,
        title: website?.title || hackathon.name,
        slug: website?.slug || '',
        status: website?.status || 'DRAFT',
        viewCount: website?.viewCount || 0,
        participantCount: registrations.length,
        pendingCount: registrations.filter(r => r.status === 'PENDING').length,
        approvedCount: registrations.filter(r => r.status === 'APPROVED').length,
        role: ah.role,
        joinCode: hackathon.joinCode,
        createdAt: hackathon.createdAt,
        updatedAt: hackathon.updatedAt,
        publishedAt: website?.publishedAt || null,
      };
    });

    // Get recent registrations (last 10 across all hackathons)
    const recentRegistrations = allRegistrations
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        userName: r.user?.name || 'Unknown',
        userEmail: r.user?.email || '',
        status: r.status,
        registeredAt: r.registeredAt,
        hackathonTitle: r.hackathonName,
        hackathonSlug: r.website?.slug || '',
      }));

    // Calculate registration trends (by month for current year)
    const currentYear = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const registrationsByMonth = Array(12).fill(0);
    allRegistrations.forEach(r => {
      const date = new Date(r.registeredAt);
      if (date.getFullYear() === currentYear) {
        registrationsByMonth[date.getMonth()]++;
      }
    });

    const registrationTrends = monthNames.map((month, index) => ({
      month,
      count: registrationsByMonth[index],
    }));

    const stats = {
      summary: {
        totalHackathons,
        publishedHackathons,
        draftHackathons,
        totalParticipants,
        pendingRegistrations,
        approvedRegistrations,
        rejectedRegistrations,
        totalMentors,
        activeMentors,
      },
      hackathons: hackathonsList,
      recentRegistrations,
      registrationTrends,
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};