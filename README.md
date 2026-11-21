# NovaEdge — Demo Website (Leads + Razorpay)

Animated website (HTML/CSS/JS) with a Node.js + Express backend for **lead capture** and **Razorpay payments**.

## What's inside

```
novaedge-demo/
├── server.js            # Express server: static site + APIs
├── package.json
├── .env.example         # copy to .env and add Razorpay test keys
├── data/                # leads.json + payments.json (auto-created)
└── public/
    ├── index.html       # animated website
    ├── admin.html       # leads & payments dashboard
    ├── css/style.css
    └── js/main.js
```

## Run it (needs Node.js 18+)

```bash
npm install
cp .env.example .env        # then edit .env and paste Razorpay TEST keys
npm start
```

Open `http://SERVER_IP:3000` (website) and `http://SERVER_IP:3000/admin.html` (dashboard, login with `ADMIN_TOKEN`).

To keep it running after logout: `npm i -g pm2 && pm2 start server.js --name novaedge`.

## Razorpay test keys

Razorpay Dashboard → switch to **Test Mode** → Settings → API Keys → Generate. Put them in `.env`:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

Restart the server after editing `.env`. The console prints `Razorpay: configured` when keys are loaded.

**Test payment details:** card `4111 1111 1111 1111`, any future expiry, any CVV, any OTP — or UPI ID `success@razorpay`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Server status + whether Razorpay is configured |
| GET | `/api/config` | Public key ID and plans |
| POST | `/api/leads` | Save a lead `{name, email, phone, company?, interest?, message?}` |
| POST | `/api/payment/create-order` | Create Razorpay order `{planId, name, email, phone}` |
| POST | `/api/payment/verify` | Verify `razorpay_signature` (HMAC SHA256) |
| POST | `/api/payment/webhook` | Optional Razorpay webhook (set `RAZORPAY_WEBHOOK_SECRET`) |
| GET | `/api/admin/leads` · `/api/admin/payments` | Admin data (header `x-admin-token`) |
| GET | `/api/admin/leads.csv?token=...` | Download leads as CSV |

Plan prices live in `server.js` (`PLANS`, in paise) so customers can't tamper with the amount from the browser.

## Notes for production

- Data is stored in JSON files in `data/` — fine for a demo; swap for MySQL/Postgres/MongoDB for real traffic.
- Put the app behind Nginx with HTTPS (Razorpay checkout requires HTTPS on live domains).
- Change `ADMIN_TOKEN` and never commit `.env`.
