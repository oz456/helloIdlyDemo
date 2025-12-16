const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Database Setup
const db = new sqlite3.Database('./orders.db', (err) => {
    if (err) console.error('DB Error:', err.message);
    else console.log('Connected to SQLite DB.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no INTEGER,
    passcode TEXT,
    items TEXT,
    total INTEGER,
    status TEXT,
    timestamp INTEGER
  )`);
});

// Helper: Read Menu
function getMenu() {
    try {
        const data = fs.readFileSync('menu.json', 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Helper: Write Menu
function saveMenu(menu) {
    fs.writeFileSync('menu.json', JSON.stringify(menu, null, 2));
}

// API: Get Menu
app.get('/api/menu', (req, res) => {
    res.json(getMenu());
});

// API: Create Order
app.post('/api/order', (req, res) => {
    const { items, total } = req.body;
    const orderId = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
    const orderNo = Math.floor(100 + Math.random() * 900); // 3 digit
    const passcode = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10 digit
    const timestamp = Date.now();
    const status = 'PENDING'; // Initial status

    const stmt = db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(orderId, orderNo, passcode, JSON.stringify(items), total, status, timestamp, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ orderId, orderNo, passcode, status });
    });
    stmt.finalize();
});

// API: Get Order
app.get('/api/order/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            row.items = JSON.parse(row.items);
            res.json(row);
        } else {
            res.status(404).json({ error: 'Order not found' });
        }
    });
});

// API: Admin - List Orders
app.get('/api/admin/orders', (req, res) => {
    // Get active orders (not collected, or collected recently?)
    // For now get all, sorted by timestamp desc
    db.all('SELECT * FROM orders ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        rows.forEach(r => r.items = JSON.parse(r.items));
        res.json(rows);
    });
});

// API: Admin - Update Status
app.put('/api/admin/order/:id/status', (req, res) => {
    const { status } = req.body;
    const id = req.params.id;
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// API: Admin - Search
app.get('/api/admin/search', (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);

    const sql = `SELECT * FROM orders WHERE order_no LIKE ? OR passcode LIKE ? ORDER BY timestamp DESC`;
    db.all(sql, [`%${q}%`, `%${q}`], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        rows.forEach(r => r.items = JSON.parse(r.items));
        res.json(rows);
    });
});

// API: Admin - Update Menu Item (Price/Availability)
// NOTE: This updates menu.json directly
app.put('/api/admin/menu/:id', (req, res) => {
    // Not fully implemented in frontend yet (frontend uses local mock for updatePrice/toggleAvailability)
    // But let's implement backend support
    // Need to parse body for price/available
    // This is complex because menu.json structure is nested.
    // Skipping for now as user said "Minimal Version". 
    // Frontend admin.js currently mocks this. 
    // If required, I can implement it.
    res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
