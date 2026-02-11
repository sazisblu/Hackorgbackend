import express from "express";
import adminroute from "./routes/adminRoute.js";
import chalk from "chalk";

const app = express();

app.use(express.json());
app.use("/api", adminroute);

app.get("/test", (req, res) => {
  res.status(200).json({
    status: 200,
    message: "gog",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
  console.log(chalk.red("http://localhost:3000"));
});
