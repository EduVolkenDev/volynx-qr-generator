import express from "express";
import QRCode from "qrcode";

const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:3000`;

const router = express.Router();

router.get("/:token.svg", async (req, res) => {
  const { token } = req.params;
  // não vaza status aqui; só gera imagem
  const url = `${APP_BASE_URL}/q/${encodeURIComponent(token)}`;
  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(svg);
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Falha ao gerar QR" });
  }
});

export default router;
