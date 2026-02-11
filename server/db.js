import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { nowIso } from "./util.js";

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.resolve("./data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "volynx.sqlite");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','operator')),
      created_at TEXT NOT NULL,
      FOREIGN KEY(org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PERCENT','FIXED','FREE','FREE_ITEM')),
      value REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('active','paused','disabled')),
      starts_at TEXT NULL,
      ends_at TEXT NULL,
      max_redemptions_total INTEGER NOT NULL DEFAULT 0,
      max_redemptions_per_user INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS voucher_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      voucher_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('active','paused','disabled')),
      redeemed_at TEXT NULL,
      redeemed_by_user_id INTEGER NULL,
      signature_path TEXT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(org_id) REFERENCES organizations(id),
      FOREIGN KEY(voucher_id) REFERENCES vouchers(id),
      FOREIGN KEY(redeemed_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      ip TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id INTEGER NOT NULL,
      instance_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      signature_path TEXT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(org_id) REFERENCES organizations(id),
      FOREIGN KEY(instance_id) REFERENCES voucher_instances(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // cria um operador demo se quiser (opcional) — deixado vazio por segurança
}
