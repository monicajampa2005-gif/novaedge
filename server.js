/**
 * NovaEdge demo server
 * - Serves the animated website (./public)
 * - Lead capture API  -> data/leads.json
 * - Razorpay orders + signature verification -> data/payments.json
 * - Token-protected admin API for viewing leads/payments
 */
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');

const PORT = process.env.PORT || 3000;
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

// Plans are defined on the server so the client can't change the price.
// amount is in paise (₹1 = 100 paise)
const PLANS = {
  starter: { name: 'Starter', amount: 49900 },
  pro: { name: 'Pro', amount: 199900 },
  enterprise: { name: 'Enterprise', amount: 499900 },
};

const razorpayReady = KEY_ID && KEY_SECRET && !KEY_ID.includes('xxxx');
const razorpay = razorpayReady ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

// ---------- tiny JSON file store ----------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of [LEADS_FILE, PAYMENTS_FILE]) if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');

let writeChain = Promise.resolve();
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function appendJson(file, record) {
  writeChain = writeChain.then(() => {
    const list = readJson(file);
    list.push(record);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
  });
  return writeChain;
}
function updateJson(file, match, patch) {
  writeChain = writeChain.then(() => {
    const list = readJson(file);
    const item = list.find(match);
    if (item) Object.assign(item, patch);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
    return item;
  });
  return writeChain;
}

// ---------- simple in-memory rate limiter ----------
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    hits.set(key, entry);
    if (entry.count > max) return res.status(429).json({ ok: false, error: 'Too many requests, try again shortly.' });
    next();
  };
}

const app = express();
app.set('trust proxy', 1);

// Webhook needs the raw body for signature check -> register before express.json()
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!WEBHOOK_SECRET) return res.status(400).send('Webhook secret not configured');
  const signature = req.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex');
  if (!safeEqual(expected, signature)) return res.status(400).send('Invalid signature');
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    const p = event?.payload?.payment?.entity;
    if (p?.order_id) {
      await updateJson(PAYMENTS_FILE, (x) => x.orderId === p.order_id, {
        webhookEvent: event.event, webhookStatus: p.status, webhookAt: new Date().toISOString(),
      });
    }
  } catch (e) { console.error('Webhook parse error', e.message); }
  res.json({ ok: true });
});

app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
const clean = (v, max = 200) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, max);

// ---------- public API ----------
app.get('/api/health', (req, res) => res.json({ ok: true, razorpayConfigured: !!razorpayReady, time: new Date().toISOString() }));

app.get('/api/config', (req, res) => {
  res.json({
    razorpayKeyId: razorpayReady ? KEY_ID : null,
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, name: p.name, amount: p.amount })),
  });
});

app.post('/api/leads', rateLimit(10, 60_000), async (req, res) => {
  const { name, email, phone, company, interest, message, website } = req.body || {};
  if (website) return res.json({ ok: true }); // honeypot: bots fill hidden field
  const errors = {};
  if (!clean(name) || clean(name).length < 2) errors.name = 'Please enter your name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean(email))) errors.email = 'Please enter a valid email';
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) errors.phone = 'Please enter a valid phone number';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const lead = {
    id: 'lead_' + crypto.randomBytes(6).toString('hex'),
    name: clean(name, 100),
    email: clean(email, 150).toLowerCase(),
    phone: clean(phone, 20),
    company: clean(company, 120),
    interest: clean(interest, 50),
    message: clean(message, 1000),
    source: clean(req.get('referer'), 300),
    ip: req.ip,
    createdAt: new Date().toISOString(),
  };
  await appendJson(LEADS_FILE, lead);
  console.log(`[lead] ${lead.name} <${lead.email}>`);
  res.status(201).json({ ok: true, id: lead.id });
});

app.post('/api/payment/create-order', rateLimit(20, 60_000), async (req, res) => {
  if (!razorpay) return res.status(503).json({ ok: false, error: 'Razorpay keys are not configured on the server (.env).' });
  const plan = PLANS[req.body?.planId];
  if (!plan) return res.status(400).json({ ok: false, error: 'Unknown plan' });
  const customer = {
    name: clean(req.body?.name, 100), email: clean(req.body?.email, 150), phone: clean(req.body?.phone, 20),
  };
  try {
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
      notes: { plan: req.body.planId, customer_email: customer.email },
    });
    await appendJson(PAYMENTS_FILE, {
      orderId: order.id, planId: req.body.planId, planName: plan.name, amount: plan.amount,
      currency: 'INR', status: 'created', customer, createdAt: new Date().toISOString(),
    });
    res.json({ ok: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId: KEY_ID, planName: plan.name });
  } catch (err) {
    console.error('Order error:', err?.error || err);
    res.status(502).json({ ok: false, error: err?.error?.description || 'Could not create order' });
  }
});

app.post('/api/payment/verify', rateLimit(20, 60_000), async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!KEY_SECRET) return res.status(503).json({ ok: false, error: 'Server not configured' });
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Missing payment fields' });
  }
  const expected = crypto.createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const valid = safeEqual(expected, razorpay_signature);
  await updateJson(PAYMENTS_FILE, (x) => x.orderId === razorpay_order_id, {
    paymentId: clean(razorpay_payment_id, 60), status: valid ? 'paid' : 'signature_failed', verifiedAt: new Date().toISOString(),
  });
  if (!valid) return res.status(400).json({ ok: false, error: 'Signature verification failed' });
  console.log(`[payment] ${razorpay_payment_id} verified for ${razorpay_order_id}`);
  res.json({ ok: true, paymentId: razorpay_payment_id });
});

// ---------- admin API ----------
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || '';
  if (!ADMIN_TOKEN || !safeEqual(token, ADMIN_TOKEN)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}
app.get('/api/admin/leads', requireAdmin, (req, res) => res.json({ ok: true, leads: readJson(LEADS_FILE).reverse() }));
app.get('/api/admin/payments', requireAdmin, (req, res) => res.json({ ok: true, payments: readJson(PAYMENTS_FILE).reverse() }));
app.get('/api/admin/leads.csv', (req, res, next) => {
  req.headers['x-admin-token'] = req.query.token || req.get('x-admin-token'); next();
}, requireAdmin, (req, res) => {
  const rows = readJson(LEADS_FILE);
  const cols = ['id', 'name', 'email', 'phone', 'company', 'interest', 'message', 'createdAt'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send(csv);
});

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`\n  NovaEdge running on http://localhost:${PORT}`);
  console.log(`  Admin dashboard:   http://localhost:${PORT}/admin.html`);
  console.log(`  Razorpay:          ${razorpayReady ? 'configured (' + KEY_ID.slice(0, 12) + '…)' : 'NOT configured - add keys to .env'}\n`);
});
