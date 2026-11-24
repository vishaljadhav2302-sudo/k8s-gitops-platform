const express = require('express');
const path = require('node:path');
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
app.use(express.static(path.join(__dirname, 'public')));

function proxyTo(baseUrl, route) {
  return async (req, res, next) => {
    try {
      const options = {
        method: req.method,
        signal: AbortSignal.timeout(5000),
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.headers = { 'content-type': 'application/json' };
        options.body = JSON.stringify(req.body);
      }
      const upstream = await fetch(new URL(route, baseUrl), options);
      const body = await upstream.text();
      res.status(upstream.status)
        .type(upstream.headers.get('content-type') || 'application/json')
        .send(body);
    } catch (error) {
      next(error);
    }
  };
}

const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

app.get('/api/products', proxyTo(productServiceUrl, '/products'));
app.get('/api/orders', proxyTo(orderServiceUrl, '/orders'));
app.post('/api/orders', proxyTo(orderServiceUrl, '/orders'));

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
  res.status(error.name === 'TimeoutError' ? 504 : 502).json({ error: 'Upstream service unavailable' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log(`frontend listening on ${port}`));