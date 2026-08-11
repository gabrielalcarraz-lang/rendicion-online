require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const translateQuery = (sql) => {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
};

const db = {
  run: function(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    let translated = translateQuery(sql);
    const isInsert = translated.trim().toUpperCase().startsWith('INSERT');
    if (isInsert && !translated.toUpperCase().includes('RETURNING')) {
       translated += ' RETURNING id';
    }
    console.log("Running:", translated);
    pool.query(translated, params, (err, res) => {
       if (err) console.error("PG Query Error:", err.message);
       const context = {
          lastID: res && res.rows && res.rows.length > 0 ? res.rows[0].id : null,
          changes: res ? res.rowCount : 0
       };
       if (cb) cb.call(context, err);
    });
  }
};

async function initializeDB() {
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
  console.log("1 done");

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
  console.log("2 done");
  
  if (!errReceipts) {
    await runQuery(`ALTER TABLE receipts ADD COLUMN iva REAL DEFAULT 0`);
    await runQuery(`ALTER TABLE receipts ADD COLUMN total_amount REAL DEFAULT 0`);
  }
  console.log("3 done");

  const errItems = await runQuery(`CREATE TABLE IF NOT EXISTS items (
    id ${serialType} PRIMARY KEY ${autoinc},
    receipt_id INTEGER,
    description TEXT,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    amount REAL,
    FOREIGN KEY(receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
  )`);
  console.log("4 done");
  if (!errItems) {
    await runQuery(`ALTER TABLE items ADD COLUMN quantity REAL DEFAULT 1`);
    await runQuery(`ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0`);
  }
  console.log("5 done");

  await runQuery(`CREATE TABLE IF NOT EXISTS assignments (
    id ${serialType} PRIMARY KEY ${autoinc},
    item_id INTEGER,
    person_name TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
  )`);
  
  console.log("Database initialized.");
  pool.end();
}

initializeDB();
