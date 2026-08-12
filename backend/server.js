const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Setup
let storage;
if (process.env.CLOUDINARY_URL) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'rendiciones',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
    }
  });
  console.log("Using Cloudinary for image storage.");
} else {
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  });
  console.log("Using local disk for image storage.");
}
const upload = multer({ storage });

// DB setup
let db;
let pool;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  // Strip query parameters to prevent pg parser from overriding our ssl config
  const cleanUrl = process.env.DATABASE_URL.split('?')[0];
  pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  const translateQuery = (sql) => {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  };

  db = {
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      pool.query(translateQuery(sql), params, (err, res) => cb(err, res ? res.rows : []));
    },
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      pool.query(translateQuery(sql), params, (err, res) => cb(err, res && res.rows.length > 0 ? res.rows[0] : null));
    },
    run: function(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      let translated = translateQuery(sql);
      const isInsert = translated.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !translated.toUpperCase().includes('RETURNING')) {
         translated += ' RETURNING id';
      }
      pool.query(translated, params, (err, res) => {
         if (err) console.error("PG Query Error:", translated, err.message);
         const context = {
            lastID: res && res.rows && res.rows.length > 0 ? res.rows[0].id : null,
            changes: res ? res.rowCount : 0
         };
         if (cb) cb.call(context, err);
      });
    },
    serialize: (cb) => { 
      // Since pg queries are async and we need sequential creation for foreign keys,
      // we'll execute cb() but we should actually await table creations.
      // To keep compatibility without huge refactor, we let it run, 
      // but ideally we'd use a real async flow.
      cb(); 
    },
    // We will bypass serialize for initialization below and use pool directly.
    prepare: (sql) => {
      const translated = translateQuery(sql);
      return {
        run: function(params, cb) {
          let runSql = translated;
          const isInsert = runSql.trim().toUpperCase().startsWith('INSERT');
          if (isInsert && !runSql.toUpperCase().includes('RETURNING')) {
             runSql += ' RETURNING id';
          }
          pool.query(runSql, params, (err, res) => {
             const context = {
                lastID: res && res.rows && res.rows.length > 0 ? res.rows[0].id : null,
                changes: res ? res.rowCount : 0
             };
             if (cb) cb.call(context, err);
          });
        },
        finalize: () => {}
      };
    }
  };
  console.log("Using PostgreSQL for database.");
} else {
  throw new Error("DATABASE_URL must be provided. SQLite is no longer supported in this environment.");
}

// Initialize tables
async function initializeDB() {
  const serialType = process.env.DATABASE_URL ? 'SERIAL' : 'INTEGER';
  const autoinc = process.env.DATABASE_URL ? '' : 'AUTOINCREMENT';
  const datetimeType = process.env.DATABASE_URL ? 'TIMESTAMP' : 'DATETIME';

  const runQuery = (sql) => new Promise((resolve) => {
    db.run(sql, [], (err) => resolve(err));
  });

  await runQuery(`CREATE TABLE IF NOT EXISTS reports (
    id ${serialType} PRIMARY KEY ${autoinc},
    name TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at ${datetimeType} DEFAULT CURRENT_TIMESTAMP
  )`);

  const errReceipts = await runQuery(`CREATE TABLE IF NOT EXISTS receipts (
    id ${serialType} PRIMARY KEY ${autoinc},
    report_id INTEGER,
    name TEXT,
    image_path TEXT,
    paid_by TEXT,
    iva REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
  )`);
  if (!errReceipts) {
    await runQuery(`ALTER TABLE receipts ADD COLUMN iva REAL DEFAULT 0`);
    await runQuery(`ALTER TABLE receipts ADD COLUMN total_amount REAL DEFAULT 0`);
  }

  const errItems = await runQuery(`CREATE TABLE IF NOT EXISTS items (
    id ${serialType} PRIMARY KEY ${autoinc},
    receipt_id INTEGER,
    description TEXT,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    amount REAL,
    FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
  )`);
  if (!errItems) {
    await runQuery(`ALTER TABLE items ADD COLUMN quantity REAL DEFAULT 1`);
    await runQuery(`ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0`);
  }

  await runQuery(`CREATE TABLE IF NOT EXISTS assignments (
    id ${serialType} PRIMARY KEY ${autoinc},
    item_id INTEGER,
    person_name TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
  )`);
  
  console.log("Database initialized.");
}

initializeDB();

// API Endpoints

// 1. Create a new report
app.post('/api/reports', (req, res) => {
  const { name } = req.body;
  db.run(`INSERT INTO reports (name) VALUES (?)`, [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, status: 'open' });
  });
});

// 2. Get all reports
app.get('/api/reports', (req, res) => {
  db.all(`SELECT * FROM reports ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Get single report details (with receipts and items)
app.get('/api/reports/:id', (req, res) => {
  const reportId = req.params.id;
  db.get(`SELECT * FROM reports WHERE id = ?`, [reportId], (err, report) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    db.all(`SELECT * FROM receipts WHERE report_id = ?`, [reportId], (err, receipts) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const receiptIds = receipts.map(r => r.id);
      if (receiptIds.length === 0) {
        return res.json({ ...report, receipts: [] });
      }

      db.all(`SELECT * FROM items WHERE receipt_id IN (${receiptIds.join(',')})`, [], (err, items) => {
         if (err) return res.status(500).json({ error: err.message });
         
         const itemIds = items.map(i => i.id);
         let assignmentsPromise = Promise.resolve([]);
         
         if (itemIds.length > 0) {
           assignmentsPromise = new Promise((resolve, reject) => {
             db.all(`SELECT * FROM assignments WHERE item_id IN (${itemIds.join(',')})`, [], (err, assignments) => {
               if (err) reject(err);
               else resolve(assignments);
             });
           });
         }

         assignmentsPromise.then(assignments => {
           // Assemble the data structure
           const itemsWithAssignments = items.map(item => ({
             ...item,
             assignments: assignments.filter(a => a.item_id === item.id).map(a => a.person_name)
           }));

           const receiptsWithItems = receipts.map(receipt => ({
             ...receipt,
             items: itemsWithAssignments.filter(i => i.receipt_id === receipt.id)
           }));

           res.json({ ...report, receipts: receiptsWithItems });
         }).catch(err => {
           res.status(500).json({ error: err.message });
         });
      });
    });
  });
});

// 4. Upload a receipt (OCR removed)
app.post('/api/reports/:id/receipts', upload.single('receiptImage'), async (req, res) => {
  const reportId = req.params.id;
  const { name, paid_by, manualAmount, manualDetail } = req.body;
  
  // Cloudinary gives a full URL in req.file.path. Local gives a relative path.
  const image_path = req.file ? (req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`) : null;

  db.run(`INSERT INTO receipts (report_id, name, image_path, paid_by) VALUES (?, ?, ?, ?)`, 
    [reportId, name, image_path, paid_by], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    const receiptId = this.lastID;

    // If manual entry was provided instead of OCR
    if (manualAmount && manualDetail) {
      const total = parseFloat(manualAmount) || 0;
      const iva = Math.round(total - (total / 1.19));
      db.run(`UPDATE receipts SET iva = ?, total_amount = ? WHERE id = ?`, 
        [iva, total, receiptId], function(err) {
         if (err) return res.status(500).json({ error: err.message });
         return res.json({ id: receiptId, name: manualDetail, paid_by, image_path, iva, total_amount: total });
      });
    } else {
       res.json({ id: receiptId, name, paid_by, image_path, items: [], total_amount: 0 });
    }
  });
});

// Extract raw text manually (OCR / PDF) - DISABLED
app.get('/api/receipts/:id/extract', (req, res) => {
   res.json({ text: '' });
});

// 5. Update items and assignments manually (Save changes to receipt)
app.post('/api/receipts/:id/save', (req, res) => {
   const receiptId = req.params.id;
   const { items } = req.body; // Array of { id, description, amount, assignments: [] }
   
   db.serialize(() => {
     db.run(`DELETE FROM assignments WHERE item_id IN (SELECT id FROM items WHERE receipt_id = ?)`, [receiptId]);
     db.run(`DELETE FROM items WHERE receipt_id = ?`, [receiptId]);

     if (!items || items.length === 0) {
       return res.json({ success: true });
     }

     const stmt = db.prepare(`INSERT INTO items (receipt_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)`);
     const assignStmt = db.prepare(`INSERT INTO assignments (item_id, person_name) VALUES (?, ?)`);

     items.forEach(item => {
        const qty = item.quantity || 1;
        const up = item.unit_price || 0;
        stmt.run([receiptId, item.description, qty, up, item.amount], function(err) {
          if (!err && item.assignments && item.assignments.length > 0) {
            const newItemId = this.lastID;
            item.assignments.forEach(person => {
               assignStmt.run([newItemId, person]);
            });
          }
        });
     });

     stmt.finalize();
     assignStmt.finalize();
     res.json({ success: true });
   });
});

// 7. Delete Report (Cascading)
app.delete('/api/reports/:id', (req, res) => {
  const reportId = req.params.id;

  db.serialize(() => {
    // 1. Get all image paths to delete physical files
    db.all(`SELECT image_path FROM receipts WHERE report_id = ? AND image_path IS NOT NULL`, [reportId], (err, rows) => {
      if (!err) {
        rows.forEach(row => {
          const filePath = path.join(__dirname, row.image_path);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch(e) { console.error("Error deleting file", e); }
          }
        });
      }
      
      // 2. Cascade delete from DB
      db.run(`DELETE FROM assignments WHERE item_id IN (SELECT id FROM items WHERE receipt_id IN (SELECT id FROM receipts WHERE report_id = ?))`, [reportId]);
      db.run(`DELETE FROM items WHERE receipt_id IN (SELECT id FROM receipts WHERE report_id = ?)`, [reportId]);
      db.run(`DELETE FROM receipts WHERE report_id = ?`, [reportId]);
      db.run(`DELETE FROM reports WHERE id = ?`, [reportId], function(err) {
         if (err) return res.status(500).json({ error: err.message });
         res.json({ success: true });
      });
    });
  });
});

// 8. Close Report (Delete photos)
app.post('/api/reports/:id/close', (req, res) => {
  const reportId = req.params.id;
  
  // Find photos and delete them
  db.all(`SELECT image_path FROM receipts WHERE report_id = ? AND image_path IS NOT NULL`, [reportId], (err, rows) => {
     if (err) return res.status(500).json({ error: err.message });

     rows.forEach(row => {
       const filePath = path.join(__dirname, row.image_path);
       if (fs.existsSync(filePath)) {
         fs.unlinkSync(filePath);
       }
     });

     db.run(`UPDATE receipts SET image_path = NULL WHERE report_id = ?`, [reportId]);
     db.run(`UPDATE reports SET status = 'closed' WHERE id = ?`, [reportId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Report closed and photos deleted." });
     });
  });
});

// Settlement Calculation API
app.get('/api/reports/:id/settlement', (req, res) => {
   const reportId = req.params.id;
   
   db.all(`
     SELECT r.paid_by, r.id as receipt_id, sum(i.amount) as total_paid
     FROM receipts r 
     LEFT JOIN items i ON i.receipt_id = r.id
     WHERE r.report_id = ?
     GROUP BY r.id
   `, [reportId], (err, payments) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT a.person_name, i.amount, 
               (SELECT COUNT(*) FROM assignments a2 WHERE a2.item_id = i.id) as shared_by
        FROM items i
        JOIN assignments a ON a.item_id = i.id
        JOIN receipts r ON i.receipt_id = r.id
        WHERE r.report_id = ?
      `, [reportId], (err, consumption) => {
         if (err) return res.status(500).json({ error: err.message });

         const balances = {};
         
         // 1. Add what they paid
         payments.forEach(p => {
            if (p.paid_by && p.paid_by.trim() !== '') {
               if (!balances[p.paid_by]) balances[p.paid_by] = 0;
               balances[p.paid_by] += (p.total_paid || 0); // They are owed this
            }
         });

         // 2. Subtract what they consumed
         consumption.forEach(c => {
             if (c.person_name && c.person_name.trim() !== '') {
                 if (!balances[c.person_name]) balances[c.person_name] = 0;
                 // If an item is assigned to 3 people, each pays amount / 3
                 const splitAmount = c.amount / (c.shared_by || 1);
                 balances[c.person_name] -= splitAmount; // They owe this
             }
         });

         res.json(balances);
      });
   });
});

// Update receipt amount (rectification)
app.put('/api/receipts/:id', (req, res) => {
   const { total_amount } = req.body;
   const iva = Math.round(total_amount - (total_amount / 1.19));
   
   db.run(`UPDATE receipts SET total_amount = ?, iva = ? WHERE id = ?`, [total_amount, iva, req.params.id], function(err) {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ success: true, total_amount, iva });
   });
});

// Delete receipt
app.delete('/api/receipts/:id', (req, res) => {
   const receiptId = req.params.id;
   
   db.get(`SELECT image_path FROM receipts WHERE id = ?`, [receiptId], (err, receipt) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
      
      db.serialize(() => {
         // Delete items and assignments associated with this receipt
         db.all(`SELECT id FROM items WHERE receipt_id = ?`, [receiptId], (err, items) => {
            if (!err && items.length > 0) {
               const itemIds = items.map(i => i.id).join(',');
               db.run(`DELETE FROM assignments WHERE item_id IN (${itemIds})`);
               db.run(`DELETE FROM items WHERE receipt_id = ?`, [receiptId]);
            }
         });

         db.run(`DELETE FROM receipts WHERE id = ?`, [receiptId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Delete image file if exists
            if (receipt.image_path) {
               const fullPath = path.join(__dirname, receipt.image_path);
               if (fs.existsSync(fullPath)) {
                  fs.unlinkSync(fullPath);
               }
            }
            res.json({ success: true, message: "Receipt deleted." });
         });
      });
   });
});

// Get unique receipt names for autocomplete
app.get('/api/receipt-names', (req, res) => {
   db.all(`SELECT DISTINCT name FROM receipts WHERE name IS NOT NULL AND name != '' ORDER BY name ASC`, [], (err, rows) => {
       if (err) return res.status(500).json({ error: err.message });
       res.json(rows.map(r => r.name));
   });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening at http://0.0.0.0:${port}`);
});
