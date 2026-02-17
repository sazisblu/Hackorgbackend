import { Router } from "express";
const router = Router();
import resend from "../config/resend.js";

router.post("/send", async (req, res) => {
  const { recipients, subject, message } = req.body;
  console.log("recipients:", recipients);

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No recipients provided" });
  }

  console.log(
    "Received recipients:",
    JSON.stringify(recipients.slice(0, 3), null, 2),
  );

  if (!subject || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Subject and message are required" });
  }

  const results = {
    success: [],
    failed: [],
  };

  try {
    // Send emails using Resend
    for (const recipient of recipients) {
      try {
        const { data, error } = await resend.emails.send({
          from: "Team Hack Org <team@hackorg.manee.com.np>", // Use your verified domain or Resend's test domain
          to: [recipient.email],
          subject: subject,
          html: message,
        });

        if (error) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          results.failed.push({ email: recipient.email, error: error.message });
        } else {
          results.success.push(recipient.email);
        }
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
