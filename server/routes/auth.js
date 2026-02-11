import express from "express";
import { clearSession, getUserFromReq, issueSession } from "../security.js";
import { db } from "../db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res
      .status(400)
      .json({ ok: false, message: "email e password são obrigatórios" });

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(String(email).toLowerCase());
  if (!user)
    return res
      .status(401)
      .json({ ok: false, message: "Credenciais inválidas" });

  const bcrypt = (await import("bcryptjs")).default;
  const okPw = bcrypt.compareSync(password, user.password_hash);
  if (!okPw)
    return res
      .status(401)
      .json({ ok: false, message: "Credenciais inválidas" });

  issueSession(res, {
    id: user.id,
    org_id: user.org_id,
    role: user.role,
    email: user.email,
  });
  return res.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.post("/logout", (req, res) => {
  clearSession(res);
  return res.json({ ok: true, message: "Logout ok" });
});

router.get("/me", (req, res) => {
  const me = getUserFromReq(req);
  if (!me) return res.status(401).json({ ok: false, message: "Sem sessão" });
  return res.json({ ok: true, user: me });
});

export default router;
