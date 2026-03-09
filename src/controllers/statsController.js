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
    // Get all websites for the admin with related data
    const websites = await prisma.website.findMany({
      where: { adminId: parseInt(adminId) },
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
        mentors: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate summary stats
    const totalHackathons = websites.length;
    const publishedHackathons = websites.filter(w => w.status === 'PUBLISHED').length;
    const draftHackathons = websites.filter(w => w.status === 'DRAFT').length;

    const allRegistrations = websites.flatMap(w => w.registrations);
    const totalParticipants = allRegistrations.length;
    const pendingRegistrations = allRegistrations.filter(r => r.status === 'PENDING').length;
    const approvedRegistrations = allRegistrations.filter(r => r.status === 'APPROVED').length;
    const rejectedRegistrations = allRegistrations.filter(r => r.status === 'REJECTED').length;

    const totalMentors = websites.flatMap(w => w.mentors).length;
    const activeMentors = websites.flatMap(w => w.mentors).filter(m => m.status === 'ACTIVE').length;

    // Format hackathons list
    const hackathonsList = websites.map(w => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      status: w.status,
      viewCount: w.viewCount,
      participantCount: w.registrations.length,
      mentorCount: w.mentors.length,
      pendingCount: w.registrations.filter(r => r.status === 'PENDING').length,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      publishedAt: w.publishedAt,
    }));

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