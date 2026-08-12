import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// File Upload Setup - Enforce Cloudinary for Serverless
let storage;
if (process.env.CLOUDINARY_URL) {
  const cloudinary = await import('cloudinary').then(m => m.default || m);
  const v2 = cloudinary.v2;
  const { CloudinaryStorage } = await import('multer-storage-cloudinary');
  storage = new CloudinaryStorage({
    cloudinary: v2,
    params: {
      folder: 'rendiciones',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
    }
  });
} else {
  // Fallback to memory storage if Cloudinary is missing
  storage = multer.memoryStorage();
}
const upload = multer({ storage });

// DB setup - Enforce PostgreSQL for Serverless
let db;
let pool;
if (process.env.DATABASE_URL) {
  const pg = await import('pg');
  const Pool = pg.default ? pg.default.Pool || pg.Pool : pg.Pool;
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
      cb(); 
    },
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
} else {
    console.error("CRITICAL ERROR: DATABASE_URL is missing. Serverless functions require PostgreSQL.");
}

// Initialize tables sequentially to avoid FK errors
let isInitialized = false;
async function initializeDB() {
  if (isInitialized || !db) return;
  const serialType = 'SERIAL';
  const autoinc = '';
  const datetimeType = 'TIMESTAMP';

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
    await runQuery(`ALTER TABLE receipts ADD COLUMN iva REAL DEFAULT 0`).catch(()=>{});
    await runQuery(`ALTER TABLE receipts ADD COLUMN total_amount REAL DEFAULT 0`).catch(()=>{});
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
    await runQuery(`ALTER TABLE items ADD COLUMN quantity REAL DEFAULT 1`).catch(()=>{});
    await runQuery(`ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0`).catch(()=>{});
  }

  await runQuery(`CREATE TABLE IF NOT EXISTS assignments (
    id ${serialType} PRIMARY KEY ${autoinc},
    item_id INTEGER,
    person_name TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
  )`);
  
  isInitialized = true;
}

// Middleware to ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  if (process.env.DATABASE_URL && !isInitialized) {
    await initializeDB();
  }
  next();
});

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

// 4. Upload a receipt and run OCR (or save manual item)
app.post('/api/reports/:id/receipts', upload.single('receiptImage'), async (req, res) => {
  const reportId = req.params.id;
  const { name, paid_by, manualAmount, manualDetail } = req.body;
  const image_path = req.file && req.file.path ? req.file.path : null;

  db.run(`INSERT INTO receipts (report_id, name, image_path, paid_by) VALUES (?, ?, ?, ?)`, 
    [reportId, name, image_path, paid_by], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    const receiptId = this.lastID;

    if (manualAmount && manualDetail) {
      const total = parseFloat(manualAmount) || 0;
      const iva = Math.round(total - (total / 1.19));
      db.run(`UPDATE receipts SET iva = ?, total_amount = ? WHERE id = ?`, 
        [iva, total, receiptId], function(err) {
         if (err) return res.status(500).json({ error: err.message });
         return res.json({ id: receiptId, name: manualDetail, paid_by, image_path, iva, total_amount: total });
      });
    } else if (req.file) {
      const processText = (text) => {
          let iva = 0;
          let total = 0;
          
          const lines = text.split('\n');
          lines.forEach(line => {
              const lowerLine = line.toLowerCase();
              const numRegex = /\b(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)\b/g;
              
              if (lowerLine.includes('total') && !lowerLine.includes('subtotal')) {
                  let match;
                  let lastNum = 0;
                  while ((match = numRegex.exec(line)) !== null) {
                      lastNum = parseFloat(match[1].replace(/[.,]/g, ''));
                  }
                  if (lastNum > total) total = lastNum;
              }
              
              if (lowerLine.includes('iva') || lowerLine.includes('19%')) {
                  let match;
                  let lastNum = 0;
                  while ((match = numRegex.exec(line)) !== null) {
                      const val = parseFloat(match[1].replace(/[.,]/g, ''));
                      if (val !== 19) lastNum = val;
                  }
                  if (lastNum > 0 && lastNum < total) iva = lastNum;
              }
          });
          
          if (iva === 0 && total > 0) {
              iva = Math.round(total - (total / 1.19));
          }

          db.run(`UPDATE receipts SET iva = ?, total_amount = ? WHERE id = ?`, [iva, total, receiptId], function(err) {
              res.json({ id: receiptId, name, paid_by, image_path, iva, total_amount: total, raw_text: text });
          });
      };

      if (req.file.mimetype === 'application/pdf') {
         import('node-fetch').then(fetchModule => {
           const fetch = fetchModule.default || fetchModule;
           fetch(image_path).then(res => res.buffer()).then(dataBuffer => {
             pdfParse(dataBuffer).then(function(data) {
                 processText(data.text);
             }).catch(err => {
                 console.error("PDF Error:", err);
                 res.json({ id: receiptId, name, paid_by, image_path, items: [], warning: "PDF Parsing Failed" });
             });
           }).catch(err => {
              console.error("Fetch PDF Error:", err);
              res.json({ id: receiptId, name, paid_by, image_path, items: [], warning: "PDF Fetch Failed" });
           });
         });
      } else {
         const recognizeImage = async (imagePath) => {
           try {
             const result = await Tesseract.recognize(imagePath, 'spa', { cachePath: '/tmp' });
             return result.data.text;
           } catch (err) {
             console.error("OCR Error:", err);
             return "";
           }
         };

         recognizeImage(image_path)
          .then(text => processText(text))
          .catch(err => {
            console.error("OCR Error:", err);
            res.json({ id: receiptId, name, paid_by, image_path, items: [], warning: "OCR Failed" });
          });
      }
    } else {
       res.json({ id: receiptId, name, paid_by, image_path, items: [] });
    }
  });
});

app.get('/api/receipts/:id/extract', (req, res) => {
   const receiptId = req.params.id;
   db.get(`SELECT image_path FROM receipts WHERE id = ?`, [receiptId], (err, receipt) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!receipt || !receipt.image_path) return res.json({ text: '' });
      
      const fullPath = receipt.image_path;

      if (fullPath.toLowerCase().endsWith('.pdf')) {
         import('node-fetch').then(fetchModule => {
           const fetch = fetchModule.default || fetchModule;
           fetch(fullPath).then(r => r.buffer()).then(dataBuffer => {
             pdfParse(dataBuffer).then(function(data) {
                 res.json({ text: data.text });
             }).catch(err => {
                 res.json({ text: 'Error al leer el PDF.' });
             });
           });
         });
      } else {
         const recognizeImage = async (imagePath) => {
           try {
             let result = await Tesseract.recognize(imagePath, 'spa', { cachePath: '/tmp' });
             return result.data.text;
           } catch (err) {
             return "";
           }
         };

         recognizeImage(fullPath)
          .then(text => {
             res.json({ text: text });
          })
          .catch(err => {
             res.json({ text: 'Error en OCR.' });
          });
      }
   });
});

app.post('/api/receipts/:id/save', (req, res) => {
   const receiptId = req.params.id;
   const { items } = req.body;
   
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

     res.json({ success: true });
   });
});

app.delete('/api/reports/:id', (req, res) => {
  const reportId = req.params.id;

  db.serialize(() => {
    db.run(`DELETE FROM assignments WHERE item_id IN (SELECT id FROM items WHERE receipt_id IN (SELECT id FROM receipts WHERE report_id = ?))`, [reportId]);
    db.run(`DELETE FROM items WHERE receipt_id IN (SELECT id FROM receipts WHERE report_id = ?)`, [reportId]);
    db.run(`DELETE FROM receipts WHERE report_id = ?`, [reportId]);
    db.run(`DELETE FROM reports WHERE id = ?`, [reportId], function(err) {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ success: true });
    });
  });
});

app.post('/api/reports/:id/close', (req, res) => {
  const reportId = req.params.id;
  db.run(`UPDATE receipts SET image_path = NULL WHERE report_id = ?`, [reportId]);
  db.run(`UPDATE reports SET status = 'closed' WHERE id = ?`, [reportId], function(err) {
     if (err) return res.status(500).json({ error: err.message });
     res.json({ success: true, message: "Report closed." });
  });
});

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
         
         payments.forEach(p => {
            if (p.paid_by && p.paid_by.trim() !== '') {
               if (!balances[p.paid_by]) balances[p.paid_by] = 0;
               balances[p.paid_by] += (p.total_paid || 0);
            }
         });

         consumption.forEach(c => {
             if (c.person_name && c.person_name.trim() !== '') {
                 if (!balances[c.person_name]) balances[c.person_name] = 0;
                 const splitAmount = c.amount / (c.shared_by || 1);
                 balances[c.person_name] -= splitAmount;
             }
         });

         res.json(balances);
      });
   });
});

app.put('/api/receipts/:id', (req, res) => {
   const { total_amount } = req.body;
   const iva = Math.round(total_amount - (total_amount / 1.19));
   
   db.run(`UPDATE receipts SET total_amount = ?, iva = ? WHERE id = ?`, [total_amount, iva, req.params.id], function(err) {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ success: true, total_amount, iva });
   });
});

app.delete('/api/receipts/:id', (req, res) => {
   const receiptId = req.params.id;
   db.serialize(() => {
      db.all(`SELECT id FROM items WHERE receipt_id = ?`, [receiptId], (err, items) => {
         if (!err && items.length > 0) {
            const itemIds = items.map(i => i.id).join(',');
            db.run(`DELETE FROM assignments WHERE item_id IN (${itemIds})`);
            db.run(`DELETE FROM items WHERE receipt_id = ?`, [receiptId]);
         }
      });
      db.run(`DELETE FROM receipts WHERE id = ?`, [receiptId], function(err) {
         if (err) return res.status(500).json({ error: err.message });
         res.json({ success: true, message: "Receipt deleted." });
      });
   });
});

app.get('/api/receipt-names', (req, res) => {
   db.all(`SELECT DISTINCT name FROM receipts WHERE name IS NOT NULL AND name != '' ORDER BY name ASC`, [], (err, rows) => {
       if (err) return res.status(500).json({ error: err.message });
       res.json(rows.map(r => r.name));
   });
});

export default app;
