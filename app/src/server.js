const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'broadcast_db',
});

// Health check endpoint for K8s Probes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness check endpoint (verifies DB connection)
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unready', error: err.message });
  }
});

// Create and broadcast notice
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

// List notices by tag
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

app.listen(port, () => {
  console.log(`Notice Broadcast API running on port ${port}`);
});
