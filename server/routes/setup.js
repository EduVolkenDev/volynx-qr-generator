import express from "express";
import { db } from "../db.js";
import { issueSession } from "../security.js";
import { nowIso } from "../util.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { org_name, email, password } = req.body || {};
  if (!org_name || !email || !password)
    return res.status(400).json({
      ok: false,
      message: "org_name, email, password são obrigatórios",
    });

  const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (usersCount > 0)
    return res.status(409).json({
      ok: false,
      message: "Setup já foi executado (já existe usuário)",
    });

  const subscription_expiry = new Date();
  subscription_expiry.setDate(subscription_expiry.getDate() + 30); // 30 dias trial

  const org = db
    .prepare(
      "INSERT INTO organizations (name, subscription_expiry, created_at) VALUES (?, ?, ?)",
    )
    .run(org_name, subscription_expiry.toISOString(), nowIso());
  const org_id = org.lastInsertRowid;

  // lazy import para reduzir superfície
  const bcrypt = (await import("bcryptjs")).default;
  const password_hash = bcrypt.hashSync(password, 12);

  const user = db
    .prepare(
      `
    INSERT INTO users (org_id, email, password_hash, role, created_at)
    VALUES (?, ?, ?, 'admin', ?)
  `,
    )
    .run(org_id, String(email).toLowerCase(), password_hash, nowIso());

  issueSession(res, {
    id: user.lastInsertRowid,
    org_id,
    role: "admin",
    email: String(email).toLowerCase(),
  });
  return res.json({
    ok: true,
    message: "Setup concluído",
    user: { id: user.lastInsertRowid, email, role: "admin" },
  });
});

export default router;
