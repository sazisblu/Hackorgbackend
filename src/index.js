import express from "express";
import cors from "cors";
import adminroute from "./routes/adminRoute.js";
import chalk from "chalk";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Adjust to your frontend URL
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use("/api", adminroute);

app.get("/test", (req, res) => {
  res.status(200).json({
    status: 200,
    message: "gog",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
  console.log(chalk.red("http://localhost:4000"));
});
