const { randomUUID } = require('node:crypto');
const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});
const errors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total HTTP responses with an error status',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});
const duration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/metrics') return;
    const labels = {
      method: req.method,
      route: req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched',
      status_code: String(res.statusCode),
    };
    requests.inc(labels);
    if (res.statusCode >= 400) errors.inc(labels);
    duration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9);
  });
  next();
});

app.use(express.json({ limit: '16kb' }));

const orders = [];

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

app.get('/orders', (req, res) => res.json(orders));
app.post('/orders', (req, res) => {
  const { customerName, items, totalAmount } = req.body || {};
  if (typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.trim().length > 80) {
    return res.status(400).json({ error: 'Provide a customer name between 2 and 80 characters' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    return res.status(400).json({ error: 'Provide between 1 and 30 cart items' });
  }

  const normalizedItems = [];
  for (const item of items) {
    if (
      !item || typeof item.productId !== 'string' || !item.productId.trim() ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 ||
      !Number.isFinite(item.price) || item.price < 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
    ) {
      return res.status(400).json({ error: 'Each item needs a productId, name, valid price, and quantity from 1 to 99' });
    }
    normalizedItems.push({
      productId: item.productId.trim(),
      name: item.name.trim(),
      price: roundMoney(item.price),
      quantity: item.quantity,
    });
  }

  const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const expectedTotal = roundMoney(subtotal + roundMoney(subtotal * 0.18));
  if (!Number.isFinite(totalAmount) || totalAmount < 0 || Math.abs(totalAmount - expectedTotal) > 0.01) {
    return res.status(400).json({ error: 'totalAmount must match the cart subtotal plus 18% GST' });
  }

  const order = {
    orderId: randomUUID(),
    customerName: customerName.trim(),
    items: normalizedItems,
    totalAmount: expectedTotal,
    status: 'Confirmed',
    timestamp: new Date().toISOString(),
  };
  orders.push(order);
  res.status(201).json(order);
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  const status = Number(error.status);
  res.status(status >= 400 && status < 500 ? status : 500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3002;
app.listen(port, '0.0.0.0', () => console.log(`order-service listening on ${port}`));