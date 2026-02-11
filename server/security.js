import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "volynx_session";
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME";

export function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, org_id: user.org_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function getUserFromReq(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export function authRequired(req, res, next) {
  const me = getUserFromReq(req);
  if (!me) return res.status(401).json({ ok: false, message: "unauthorized" });
  req.user = me;
  next();
}

export function roleRequired(roleOrRoles) {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return (req, res, next) => {
    const me = req.user || getUserFromReq(req);
    if (!me) return res.status(401).json({ ok: false, message: "unauthorized" });
    if (!roles.includes(me.role)) return res.status(403).json({ ok: false, message: "forbidden" });
    next();
  };
}
