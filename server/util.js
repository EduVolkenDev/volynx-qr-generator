import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(projectRoot, "data");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "signatures"), { recursive: true });

export function randomToken() {
  // 24 bytes => 192 bits; base64url sem padding (token não-adivinhável)
  return crypto.randomBytes(24).toString("base64url");
}

export function nowIso() {
  return new Date().toISOString();
}

export function computeValidity(inst, me = null) {
  // Instância e voucher ativos?
  if (inst.instance_status !== "active")
    return { valid: false, reason: `instance_${inst.instance_status}` };
  if (inst.voucher_status !== "active")
    return { valid: false, reason: `voucher_${inst.voucher_status}` };
  if (inst.redeemed_at) return { valid: false, reason: "already_redeemed" };

  const now = new Date();
  if (inst.starts_at) {
    const s = new Date(inst.starts_at);
    if (now < s) return { valid: false, reason: "not_started" };
  }
  if (inst.ends_at) {
    const e = new Date(inst.ends_at);
    if (now > e) return { valid: false, reason: "expired" };
  }

  // Limites globais / por usuário (se configurados)
  if (Number(inst.max_redemptions_total || 0) > 0) {
    const c = db
      .prepare(
        `
      SELECT COUNT(*) as c
      FROM voucher_instances
      WHERE voucher_id = ? AND redeemed_at IS NOT NULL
    `,
      )
      .get(inst.voucher_id).c;
    if (c >= Number(inst.max_redemptions_total))
      return { valid: false, reason: "limit_total_reached" };
  }

  if (me && Number(inst.max_redemptions_per_user || 0) > 0) {
    const c = db
      .prepare(
        `
      SELECT COUNT(*) as c
      FROM redemptions r
      JOIN voucher_instances vi ON vi.id = r.instance_id
      WHERE r.user_id = ? AND vi.voucher_id = ?
    `,
      )
      .get(me.id, inst.voucher_id).c;
    if (c >= Number(inst.max_redemptions_per_user))
      return { valid: false, reason: "limit_user_reached" };
  }

  return { valid: true, reason: "ok" };
}

export function sanitizePublic(inst) {
  return {
    name: inst.name,
    type: inst.type,
    value: inst.value,
    voucher_status: inst.voucher_status,
    instance_status: inst.instance_status,
    redeemed_at: inst.redeemed_at,
    starts_at: inst.starts_at,
    ends_at: inst.ends_at,
  };
}

export function sanitizeOperator(inst) {
  return {
    voucher_id: inst.voucher_id,
    name: inst.name,
    type: inst.type,
    value: inst.value,
    starts_at: inst.starts_at,
    ends_at: inst.ends_at,
  };
}

export function saveSignature(dataUrl, instanceId) {
  // esperado: data:image/png;base64,....
  const m = String(dataUrl).match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : "png";
  const buf = Buffer.from(m[2], "base64");
  const filename = `sig_${instanceId}_${Date.now()}.${ext}`;
  const abs = path.join(DATA_DIR, "signatures", filename);
  fs.writeFileSync(abs, buf);
  return `/data/signatures/${filename}`;
}
