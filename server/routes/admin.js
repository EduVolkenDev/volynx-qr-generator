import express from "express";
import {
  authRequired,
  roleRequired,
  subscriptionRequired,
} from "../security.js";
import { db } from "../db.js";
import { nowIso, randomToken } from "../util.js";

const router = express.Router();

router.use(authRequired);
router.use(subscriptionRequired);
router.use(roleRequired("admin"));

router.get("/stats", (req, res) => {
  const me = req.user;
  const org_id = me.org_id;

  const vouchers = db
    .prepare("SELECT COUNT(*) as c FROM vouchers WHERE org_id = ?")
    .get(org_id).c;
  const instances = db
    .prepare("SELECT COUNT(*) as c FROM voucher_instances WHERE org_id = ?")
    .get(org_id).c;
  const redeemed = db
    .prepare(
      "SELECT COUNT(*) as c FROM voucher_instances WHERE org_id = ? AND redeemed_at IS NOT NULL",
    )
    .get(org_id).c;

  return res.json({ ok: true, stats: { vouchers, instances, redeemed } });
});

router.get("/vouchers", (req, res) => {
  const me = req.user;
  const rows = db
    .prepare("SELECT * FROM vouchers WHERE org_id = ? ORDER BY id DESC")
    .all(me.org_id);
  return res.json({ ok: true, vouchers: rows });
});

router.post("/vouchers", (req, res) => {
  const me = req.user;
  const {
    name,
    type,
    value,
    status = "active",
    starts_at = null,
    ends_at = null,
    max_redemptions_total = 0,
    max_redemptions_per_user = 0,
  } = req.body || {};

  if (!name || !type)
    return res
      .status(400)
      .json({ ok: false, message: "name e type são obrigatórios" });
  if (!["PERCENT", "FIXED", "FREE", "FREE_ITEM"].includes(type))
    return res.status(400).json({ ok: false, message: "type inválido" });

  const r = db
    .prepare(
      `
    INSERT INTO vouchers
    (org_id, name, type, value, status, starts_at, ends_at, max_redemptions_total, max_redemptions_per_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      me.org_id,
      name,
      type,
      Number(value || 0),
      status,
      starts_at,
      ends_at,
      Number(max_redemptions_total || 0),
      Number(max_redemptions_per_user || 0),
      nowIso(),
    );

  const created = db
    .prepare("SELECT * FROM vouchers WHERE id = ?")
    .get(r.lastInsertRowid);
  return res.json({ ok: true, voucher: created });
});

router.post("/vouchers/:id/instances", (req, res) => {
  const me = req.user;
  const voucher_id = Number(req.params.id);
  const count = Math.min(5000, Math.max(1, Number(req.body?.count || 1)));
  const expiry_days = Number(req.body?.expiry_days || 30); // padrão 30 dias

  const voucher = db
    .prepare("SELECT * FROM vouchers WHERE id = ? AND org_id = ?")
    .get(voucher_id, me.org_id);
  if (!voucher)
    return res
      .status(404)
      .json({ ok: false, message: "voucher não encontrado" });

  const expiry_date = new Date(
    Date.now() + expiry_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const insert = db.prepare(`
    INSERT INTO voucher_instances (org_id, voucher_id, token, status, expiry_date, created_at)
    VALUES (?, ?, ?, 'active', ?, ?)
  `);

  const tokens = [];
  const tx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const token = randomToken();
      insert.run(me.org_id, voucher_id, token, expiry_date, nowIso());
      tokens.push(token);
    }
  });
  tx();

  return res.json({
    ok: true,
    created: tokens.length,
    tokens_preview: tokens.slice(0, 10),
    expiry_date,
  });
});

router.get("/vouchers/:id/instances", (req, res) => {
  const me = req.user;
  const voucher_id = Number(req.params.id);

  const rows = db
    .prepare(
      `
    SELECT vi.*, v.name as voucher_name, v.type, v.value
    FROM voucher_instances vi
    JOIN vouchers v ON v.id = vi.voucher_id
    WHERE vi.org_id = ? AND vi.voucher_id = ?
    ORDER BY vi.id DESC
    LIMIT 500
  `,
    )
    .all(me.org_id, voucher_id);

  return res.json({ ok: true, instances: rows });
});

router.patch("/instances/:token", (req, res) => {
  const me = req.user;
  const { token } = req.params;
  const { status } = req.body || {};
  if (!["active", "paused", "disabled"].includes(status))
    return res.status(400).json({ ok: false, message: "status inválido" });

  const r = db
    .prepare(
      `
    UPDATE voucher_instances
    SET status = ?
    WHERE org_id = ? AND token = ?
  `,
    )
    .run(status, me.org_id, token);

  if (r.changes === 0)
    return res
      .status(404)
      .json({ ok: false, message: "instance não encontrada" });
  return res.json({ ok: true, token, status });
});

router.post("/subscription/renew", (req, res) => {
  const me = req.user;
  const { months = 1 } = req.body || {};
  if (months < 1 || months > 12)
    return res.status(400).json({ ok: false, message: "months deve ser 1-12" });

  const org = db
    .prepare("SELECT subscription_expiry FROM organizations WHERE id = ?")
    .get(me.org_id);
  if (!org)
    return res
      .status(404)
      .json({ ok: false, message: "organization not found" });

  const currentExpiry = org.subscription_expiry
    ? new Date(org.subscription_expiry)
    : new Date();
  currentExpiry.setMonth(currentExpiry.getMonth() + months);

  db.prepare(
    "UPDATE organizations SET subscription_expiry = ? WHERE id = ?",
  ).run(currentExpiry.toISOString(), me.org_id);

  return res.json({ ok: true, new_expiry: currentExpiry.toISOString() });
});

export default router;
