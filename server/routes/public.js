import express from "express";
import { db } from "../db.js";
import { computeValidity, sanitizePublic } from "../util.js";

const PUBLIC_TOKEN_STATUS =
  String(process.env.PUBLIC_TOKEN_STATUS || "false").toLowerCase() === "true";

const router = express.Router();

router.get("/status/:token", (req, res) => {
  if (!PUBLIC_TOKEN_STATUS)
    return res.status(403).json({ ok: false, message: "restricted" });
  const { token } = req.params;

  const inst = db
    .prepare(
      `
    SELECT vi.token, vi.status as instance_status, vi.redeemed_at, vi.expiry_date, v.name, v.type, v.value, v.status as voucher_status, v.starts_at, v.ends_at
    FROM voucher_instances vi
    JOIN vouchers v ON v.id = vi.voucher_id
    WHERE vi.token = ?
  `,
    )
    .get(token);

  if (!inst) return res.status(404).json({ ok: false, message: "not_found" });
  const valid = computeValidity(inst);
  return res.json({ ok: true, token, valid, details: sanitizePublic(inst) });
});

export default router;
