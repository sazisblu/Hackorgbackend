import * as client from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import crypto from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new client.PrismaClient({ adapter });

// Generate a unique QR identifier
const generateQRIdentifier = (websiteId, userId) => {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `HO-${websiteId}-${userId}-${random}`;
};

// Create a new entitlement for a hackathon
export const createEntitlement = async (req, res) => {
  const { websiteId, name, description } = req.body;

  if (!websiteId || !name) {
    return res.status(400).json({
      success: false,
      error: "websiteId and name are required",
    });
  }

  try {
    // Check if website exists
    const website = await prisma.website.findUnique({
      where: { id: parseInt(websiteId) },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: "Hackathon not found",
      });
    }

    const entitlement = await prisma.entitlement.create({
      data: {
        name,
        description,
        websiteId: parseInt(websiteId),
      },
    });

    res.status(201).json({
      success: true,
      entitlement,
      message: "Entitlement created successfully",
    });
  } catch (error) {
    console.error("Error creating entitlement:", error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: "An entitlement with this name already exists for this hackathon",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all entitlements for a hackathon
export const getEntitlementsByWebsite = async (req, res) => {
  const { websiteId } = req.params;

  try {
    const entitlements = await prisma.entitlement.findMany({
      where: { websiteId: parseInt(websiteId) },
      include: {
        _count: {
          select: { claims: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      entitlements,
    });
  } catch (error) {
    console.error("Error fetching entitlements:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get a single entitlement by ID
export const getEntitlementById = async (req, res) => {
  const { id } = req.params;

  try {
    const entitlement = await prisma.entitlement.findUnique({
      where: { id: parseInt(id) },
      include: {
        website: {
          select: { id: true, title: true, slug: true },
        },
        _count: {
          select: { claims: true },
        },
      },
    });

    if (!entitlement) {
      return res.status(404).json({
        success: false,
        error: "Entitlement not found",
      });
    }

    res.status(200).json({
      success: true,
      entitlement,
    });
  } catch (error) {
    console.error("Error fetching entitlement:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update an entitlement
export const updateEntitlement = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const entitlement = await prisma.entitlement.update({
      where: { id: parseInt(id) },
      data: { name, description },
    });

    res.status(200).json({
      success: true,
      entitlement,
      message: "Entitlement updated successfully",
    });
  } catch (error) {
    console.error("Error updating entitlement:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: "An entitlement with this name already exists for this hackathon",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete an entitlement
export const deleteEntitlement = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.entitlement.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "Entitlement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting entitlement:", error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: "Entitlement not found",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Claim an entitlement (verify via QR scan)
export const claimEntitlement = async (req, res) => {
  const { qrIdentifier, entitlementId, adminId } = req.body;

  if (!qrIdentifier || !entitlementId || !adminId) {
    return res.status(400).json({
      success: false,
      error: "qrIdentifier, entitlementId, and adminId are required",
    });
  }

  try {
    // Find the registration by QR identifier
    const registration = await prisma.registration.findUnique({
      where: { qrIdentifier },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            githubUsername: true,
          },
        },
        website: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Invalid QR code. Participant not found.",
      });
    }

    // Check if registration is approved
    if (registration.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: `Participant registration is ${registration.status.toLowerCase()}. Only approved participants can claim entitlements.`,
        participant: registration.user,
      });
    }

    // Check if entitlement exists and belongs to the same hackathon
    const entitlement = await prisma.entitlement.findUnique({
      where: { id: parseInt(entitlementId) },
    });

    if (!entitlement) {
      return res.status(404).json({
        success: false,
        error: "Entitlement not found",
      });
    }

    if (entitlement.websiteId !== registration.websiteId) {
      return res.status(400).json({
        success: false,
        error: "This entitlement does not belong to the participant's hackathon",
      });
    }

    // Check if already claimed
    const existingClaim = await prisma.participantEntitlement.findUnique({
      where: {
        registrationId_entitlementId: {
          registrationId: registration.id,
          entitlementId: parseInt(entitlementId),
        },
      },
      include: {
        admin: {
          select: { fullname: true },
        },
      },
    });

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        alreadyClaimed: true,
        error: `${entitlement.name} has already been claimed by this participant`,
        claimedAt: existingClaim.claimedAt,
        claimedBy: existingClaim.admin.fullname,
        participant: registration.user,
      });
    }

    // Create the claim
    const claim = await prisma.participantEntitlement.create({
      data: {
        registrationId: registration.id,
        entitlementId: parseInt(entitlementId),
        claimedBy: parseInt(adminId),
      },
      include: {
        entitlement: {
          select: { name: true },
        },
      },
    });

    // Get all claimed entitlements for this participant
    const allClaims = await prisma.participantEntitlement.findMany({
      where: { registrationId: registration.id },
      include: {
        entitlement: {
          select: { name: true },
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: `${entitlement.name} successfully claimed by ${registration.user.name || registration.user.email}`,
      claim,
      participant: registration.user,
      hackathon: registration.website,
      allClaimedEntitlements: allClaims.map(c => ({
        name: c.entitlement.name,
        claimedAt: c.claimedAt,
      })),
    });
  } catch (error) {
    console.error("Error claiming entitlement:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get participant by QR identifier
export const getParticipantByQR = async (req, res) => {
  const { qrIdentifier } = req.params;

  try {
    const registration = await prisma.registration.findUnique({
      where: { qrIdentifier },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            githubUsername: true,
          },
        },
        website: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Participant not found",
      });
    }

    // Get all claimed entitlements
    const claims = await prisma.participantEntitlement.findMany({
      where: { registrationId: registration.id },
      include: {
        entitlement: {
          select: { name: true },
        },
        admin: {
          select: { fullname: true },
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      participant: {
        ...registration.user,
        registrationId: registration.id,
        status: registration.status,
        registeredAt: registration.registeredAt,
      },
      hackathon: registration.website,
      claimedEntitlements: claims.map(c => ({
        name: c.entitlement.name,
        claimedAt: c.claimedAt,
        claimedBy: c.admin.fullname,
      })),
    });
  } catch (error) {
    console.error("Error fetching participant by QR:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get all claims for an entitlement
export const getEntitlementClaims = async (req, res) => {
  const { entitlementId } = req.params;

  try {
    const claims = await prisma.participantEntitlement.findMany({
      where: { entitlementId: parseInt(entitlementId) },
      include: {
        registration: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        admin: {
          select: { fullname: true },
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      claims: claims.map(c => ({
        id: c.id,
        participant: c.registration.user,
        claimedAt: c.claimedAt,
        claimedBy: c.admin.fullname,
      })),
    });
  } catch (error) {
    console.error("Error fetching entitlement claims:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Generate QR identifier for existing approved registrations
export const generateQRForRegistration = async (req, res) => {
  const { registrationId } = req.params;

  try {
    const registration = await prisma.registration.findUnique({
      where: { id: parseInt(registrationId) },
      include: {
        user: { select: { id: true, name: true } },
        website: { select: { id: true, title: true } },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: "Registration not found",
      });
    }

    if (registration.qrIdentifier) {
      return res.status(200).json({
        success: true,
        qrIdentifier: registration.qrIdentifier,
        message: "QR identifier already exists",
      });
    }

    const qrIdentifier = generateQRIdentifier(registration.websiteId, registration.userId);

    const updated = await prisma.registration.update({
      where: { id: parseInt(registrationId) },
      data: { qrIdentifier },
    });

    res.status(200).json({
      success: true,
      qrIdentifier: updated.qrIdentifier,
      message: "QR identifier generated successfully",
    });
  } catch (error) {
    console.error("Error generating QR identifier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};