const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');
const os = require('os');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code']
});

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 200, 300, 400, 500, 1000]
});

let requestCountWindow = 0;
let lastRps = 0;
setInterval(() => {
  lastRps = requestCountWindow;
  requestCountWindow = 0;
}, 1000);

app.use((req, res, next) => {
  requestCountWindow++;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.route) {
      httpRequestCounter.inc({ method: req.method, route: req.route.path, code: res.statusCode });
      httpRequestDurationMicroseconds
        .labels(req.method, req.route.path, res.statusCode)
        .observe(duration);
    }
  });
  next();
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'broadcast_db',
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unready', error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.status(200).json({
    podName: os.hostname(),
    rps: lastRps,
    cpuLoad: os.loadavg()[0],
    memoryFreeMb: Math.round(os.freemem() / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stress', (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 15) {
    Math.sqrt(Math.random() * 1000000);
  }
  res.status(200).json({ status: 'processed', pod: os.hostname() });
});

app.post('/api/notices', async (req, res) => {
  const { title, message, targetTag, scheduledAt } = req.body;
  try {
    const query = `
      INSERT INTO notices (title, message, target_tag, scheduled_at, status)
      VALUES ($1, $2, $3, $4, 'QUEUED')
      RETURNING *;
    `;
    const values = [title, message, targetTag, scheduledAt || new Date()];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, notice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notices', async (req, res) => {
  const { tag } = req.query;
  try {
    let result;
    if (tag) {
      result = await pool.query('SELECT * FROM notices WHERE target_tag = $1 ORDER BY created_at DESC', [tag]);
    } else {
      result = await pool.query('SELECT * FROM notices ORDER BY created_at DESC');
    }
    res.status(200).json({ notices: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`NoticeFlow Broadcast API running on port ${port}`);
});
