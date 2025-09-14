import express from "express";
import cors from "cors";

const app = express();

// Parse JSON body (needed for req.body!)
app.use(express.json());

// Allow requests from your frontend
app.use(cors({
  origin: "*",  // restrict for dev
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.post("/api/submit-location", (req, res) => {
  const { crate_int_id, location } = req.body;

  if (!crate_int_id) {
    return res.status(400).json({ error: "missing crate_int_id" });
  }
  if (
    !location ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    return res.status(400).json({ error: "invalid location" });
  }

  console.log("✅ received location", { crate_int_id, location });

  return res.status(200).json({ ok: true });
});

app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));