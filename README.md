# Volynx QR-Generator (PWA + API) — pronto pra rodar

## O que entrega (MVP sólido e seguro)

- QR dinâmico (revogável): o QR só carrega um token/URL; validade e regras vivem no backend.
- Vouchers **únicos** (single-use) com status (active/paused/disabled).
- Acesso restrito (RBAC): **admin** cria vouchers/instâncias; **operator** valida e resgata.
- Resgate com **assinatura** (canvas) opcional, com trilha de auditoria.
- Mobile-first PWA (funciona em navegador e pode ser “instalado” no celular).
- **Modelo de assinatura**: trial de 30 dias; QR expiram após período configurável (padrão 30 dias) para incentivar renovações mensais.

## Rodar local

1. `cp .env.example .env` e edite `JWT_SECRET`.
2. `npm install`
3. `npm run dev`
4. Abra: `http://localhost:3000`

## Primeiro setup

- No app, vá em **/setup** (menu “Setup”) e crie o usuário admin inicial.
- Depois faça login.

## Personalização sem mexer nos arquivos principais

- **Edite somente:**
  - `public/custom/overrides.js` (HTML + textos + hooks)
  - `public/custom/overrides.css` (CSS extra / overrides)
- O app carrega esses arquivos automaticamente. Se você apagar, roda com o tema padrão.

## Endpoints principais

- `POST /api/setup` (apenas se não existir usuário)
- `POST /api/auth/login` | `POST /api/auth/logout` | `GET /api/auth/me`
- Admin: `POST/GET /api/admin/vouchers`, `POST /api/admin/vouchers/:id/instances`, `POST /api/admin/subscription/renew`
- Operator: `POST /api/operator/validate`, `POST /api/operator/redeem`
- QR SVG: `GET /api/qr/:token.svg`

## Produção (nota)

- Use HTTPS, configure `APP_BASE_URL` com seu domínio e marque cookie como `secure`.
- Troque o SQLite por Postgres se precisar de escala (o modelo já separa bem as camadas).
