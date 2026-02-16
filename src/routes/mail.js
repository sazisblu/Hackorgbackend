import { Router } from "express";
const router = Router();
import transporter from "../config/nodemailer.js";

import { join } from "path";
import { existsSync } from "fs";

router.post("/send", async (req, res) => {
  const { recipients, subject, message } = req.body;
  console.log("recipients:", recipients);
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No recipients provided" });
  }

  // Debugging: Check what data is being received
  console.log(
    "Received recipients:",
    JSON.stringify(recipients.slice(0, 3), null, 2),
  ); // Log first 3

  if (!subject || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Subject and message are required" });
  }

  const results = {
    success: [],
    failed: [],
  };

  // Check for "It Circle" logo usage to embed it
  let emailHtml = message;
  const attachments = [];
  const logoUrl =
    "https://preview.redd.it/the-original-image-of-the-monkey-thinking-meme-v0-ea1hkdjnx9af1.jpeg?width=1080&crop=smart&auto=webp&s=5fb2b05369bfbffd94d6009a679a9a5fe5e4223f";

  if (emailHtml.includes(logoUrl)) {
    emailHtml = emailHtml.replace(logoUrl, "cid:it-circle-logo");
    const logoPath = join(__dirname, "../../client/public/it-circle-logo.png");

    // Only attach if file exists
    if (existsSync(logoPath)) {
      attachments.push({
        filename: "it-circle-logo.png",
        path: logoPath,
        cid: "it-circle-logo",
      });
    }
  }

  // Basic helper to strip HTML for the text version
  const stripHtml = (html) => {
    return html
      .replace(/<[^>]*>?/gm, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  try {
    // Iterate and send emails
    for (const recipient of recipients) {
      const mailOptions = {
        from: `"Khwopa IT Circle" <${process.env.EMAIL_USER}>`, // Add a nice display name
        to: recipient.email,
        subject: subject,
        text: stripHtml(emailHtml), // Plain text fallback
        html: emailHtml,
        attachments: attachments,
      };

      try {
        await transporter.sendMail(mailOptions);
        results.success.push(recipient.email);
      } catch (error) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        results.failed.push({ email: recipient.email, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: "Email sending process completed",
      results,
    });
  } catch (error) {
    console.error("Global error in sending emails:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
