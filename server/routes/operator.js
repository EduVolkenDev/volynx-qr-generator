import express from "express";
import { authRequired, roleRequired } from "../security.js";
import { db } from "../db.js";
import {
  computeValidity,
  sanitizeOperator,
  saveSignature,
  nowIso,
} from "../util.js";

const router = express.Router();

router.use(authRequired);
router.use(roleRequired(["admin", "operator"]));

router.post("/validate", (req, res) => {
  const me = req.user;
  const { token } = req.body || {};
  if (!token)
    return res.status(400).json({ ok: false, message: "token obrigatório" });

  const inst = db
    .prepare(
      `
    SELECT vi.token, vi.status as instance_status, vi.redeemed_at,
           v.id as voucher_id, v.name, v.type, v.value, v.status as voucher_status, v.starts_at, v.ends_at,
           v.max_redemptions_total, v.max_redemptions_per_user
    FROM voucher_instances vi
    JOIN vouchers v ON v.id = vi.voucher_id
    WHERE vi.org_id = ? AND vi.token = ?
  `,
    )
    .get(me.org_id, token);

  db.prepare(
    `INSERT INTO scans (org_id, token, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    me.org_id,
    token,
    req.ip || "",
    req.headers["user-agent"] || "",
    nowIso(),
  );

  if (!inst) return res.status(404).json({ ok: false, message: "not_found" });
  const validity = computeValidity(inst, me);
  return res.json({
    ok: true,
    token,
    ...validity,
    voucher: sanitizeOperator(inst),
  });
});

router.post("/redeem", (req, res) => {
  const me = req.user;
  const { token, signature_data_url = null } = req.body || {};
  if (!token)
    return res.status(400).json({ ok: false, message: "token obrigatório" });

  const inst = db
    .prepare(
      `
    SELECT vi.id as instance_id, vi.token, vi.status as instance_status, vi.redeemed_at,
           v.id as voucher_id, v.name, v.type, v.value, v.status as voucher_status, v.starts_at, v.ends_at,
           v.max_redemptions_total, v.max_redemptions_per_user
    FROM voucher_instances vi
    JOIN vouchers v ON v.id = vi.voucher_id
    WHERE vi.org_id = ? AND vi.token = ?
  `,
    )
    .get(me.org_id, token);

  if (!inst) return res.status(404).json({ ok: false, message: "not_found" });

  const validity = computeValidity(inst, me);
  if (!validity.valid)
    return res
      .status(409)
      .json({ ok: false, message: "invalid", reason: validity.reason });

  let sigPath = null;
  if (signature_data_url) {
    sigPath = saveSignature(signature_data_url, inst.instance_id);
  }

  const tx = db.transaction(() => {
    // marca como usado (single-use)
    db.prepare(
      `
      UPDATE voucher_instances
      SET redeemed_at = ?, redeemed_by_user_id = ?, signature_path = ?
      WHERE id = ? AND redeemed_at IS NULL
    `,
    ).run(nowIso(), me.id, sigPath, inst.instance_id);

    db.prepare(
      `
      INSERT INTO redemptions (org_id, instance_id, user_id, signature_path, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(me.org_id, inst.instance_id, me.id, sigPath, nowIso());
  });

  try {
    tx();
  } catch (e) {
    return res.status(409).json({ ok: false, message: "already_redeemed" });
  }

  return res.json({ ok: true, redeemed: true, token, signature_path: sigPath });
});

router.get("/redemptions", (req, res) => {
  const me = req.user;
  const rows = db
    .prepare(
      `
    SELECT r.*, vi.token, v.name as voucher_name, v.type, v.value, u.email as redeemed_by
    FROM redemptions r
    JOIN voucher_instances vi ON vi.id = r.instance_id
    JOIN vouchers v ON v.id = vi.voucher_id
    JOIN users u ON u.id = r.user_id
    WHERE r.org_id = ?
    ORDER BY r.id DESC
    LIMIT 200
  `,
    )
    .all(me.org_id);

  return res.json({ ok: true, redemptions: rows });
});

export default router;
