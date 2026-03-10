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
              include: {
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
        },
      },
    });

    // Extract websites from hackathons
    const websites = adminHackathons
      .map(ah => ah.hackathon.website)
      .filter(w => w !== null);

    // Calculate summary stats
    const totalHackathons = adminHackathons.length;
    const publishedHackathons = websites.filter(w => w.status === 'PUBLISHED').length;
    const draftHackathons = websites.filter(w => w.status === 'DRAFT').length;

    const allRegistrations = websites.flatMap(w => w.registrations);
    const totalParticipants = allRegistrations.length;
    const pendingRegistrations = allRegistrations.filter(r => r.status === 'PENDING').length;
    const approvedRegistrations = allRegistrations.filter(r => r.status === 'APPROVED').length;
    const rejectedRegistrations = allRegistrations.filter(r => r.status === 'REJECTED').length;

    // Try to get mentors count, default to 0 if table doesn't exist
    let totalMentors = 0;
    let activeMentors = 0;
    try {
      const mentors = await prisma.mentor.findMany({
        where: {
          websiteId: { in: websites.map(w => w.id) }
        },
        select: { id: true, status: true }
      });
      totalMentors = mentors.length;
      activeMentors = mentors.filter(m => m.status === 'ACTIVE').length;
    } catch (mentorError) {
      console.log("Mentor table not found, skipping mentor stats");
    }

    // Format hackathons list
    const hackathonsList = adminHackathons.map(ah => {
      const website = ah.hackathon.website;
      return {
        id: ah.hackathon.id,
        name: ah.hackathon.name,
        title: website?.title || ah.hackathon.name,
        slug: website?.slug || '',
        status: website?.status || 'DRAFT',
        viewCount: website?.viewCount || 0,
        participantCount: website?.registrations?.length || 0,
        mentorCount: 0, // Will be updated if mentor table exists
        pendingCount: website?.registrations?.filter(r => r.status === 'PENDING').length || 0,
        role: ah.role,
        createdAt: ah.hackathon.createdAt,
        updatedAt: ah.hackathon.updatedAt,
        publishedAt: website?.publishedAt || null,
      };
    });

    // Get recent registrations (last 10 across all hackathons)
    const recentRegistrations = allRegistrations
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 10)
      .map(r => {
        const website = websites.find(w => w.registrations.some(reg => reg.id === r.id));
        return {
          id: r.id,
          userName: r.user?.name || 'Unknown',
          userEmail: r.user?.email || '',
          status: r.status,
          registeredAt: r.registeredAt,
          hackathonTitle: website?.title || 'Unknown',
          hackathonSlug: website?.slug || '',
        };
      });

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