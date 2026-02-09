import express from "express";
import adminroute from "./routes/adminRoute.js";

const app = express();

app.use(express.json());
app.use("/api", adminroute);


app.get("/test", (req, res) => {
  res.status(200).json({
    status: 200,
    message: "gog",
  });
});

app.listen(3000, () => {
  console.log("app is running ");
});
