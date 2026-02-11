import express from "express";
import QRCode from "qrcode";

const app = express();
const PORT = 3001; // different port

app.use(express.static("public"));
app.use(express.json());

app.get("/generate", async (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: "Text required" });
  try {
    const qr = await QRCode.toDataURL(text);
    res.json({ qr });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

app.listen(PORT, () => {
  console.log(`Simple QR Generator running on http://localhost:${PORT}`);
});
