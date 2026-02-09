import express from "express";

app = express();

app.get("/test", (req, res) => {
  res.status(200).json({
    status: 200,
    message: gog,
  });
});

app.listen("3000", () => {
  console.log("app is running ");
});
