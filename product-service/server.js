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

const products = [
  {
    id: 'p-1001', name: 'Studio Wireless Headphones', category: 'Electronics', price: 6499,
    rating: 4.8, description: 'Immersive sound, soft memory-foam cushions, and up to 40 hours of listening.', stock: 18,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1002', name: 'Pocket Bluetooth Speaker', category: 'Electronics', price: 3299,
    rating: 4.6, description: 'Room-filling sound in a compact, water-resistant speaker made for everyday carry.', stock: 24,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1003', name: 'Everyday Oxford Shirt', category: 'Fashion', price: 2199,
    rating: 4.5, description: 'A breathable cotton Oxford with an easy fit and considered finishing.', stock: 31,
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1004', name: 'Court Low Sneakers', category: 'Fashion', price: 3899,
    rating: 4.7, description: 'Clean court-inspired sneakers with a cushioned footbed for all-day comfort.', stock: 15,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1005', name: 'Arc Table Lamp', category: 'Home', price: 4599,
    rating: 4.9, description: 'A sculptural table lamp that brings warm, focused light to a favourite corner.', stock: 9,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1006', name: 'Soft Linen Cushion', category: 'Home', price: 1499,
    rating: 4.4, description: 'Relaxed linen texture and a feather-soft insert for a little more comfort at home.', stock: 27,
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1007', name: 'City Crossbody Bag', category: 'Accessories', price: 2799,
    rating: 4.6, description: 'A hands-free everyday bag with an adjustable strap and space for the essentials.', stock: 12,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'p-1008', name: 'Insulated Steel Bottle', category: 'Accessories', price: 899,
    rating: 4.7, description: 'Double-wall stainless steel keeps drinks cold or warm wherever the day goes.', stock: 42,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=85',
  },
];

app.get('/products', (req, res) => res.json(products));
app.get('/products/:id', (req, res) => {
  const product = products.find((item) => item.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
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
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => console.log(`product-service listening on ${port}`));