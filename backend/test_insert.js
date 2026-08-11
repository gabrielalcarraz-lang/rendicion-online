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
    console.log("Running Query:", translated);
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

const name = "Test from script";
db.run(`INSERT INTO reports (name) VALUES (?)`, [name], function(err) {
  if (err) {
    console.error("Error inserting:", err.message);
  } else {
    console.log("Success! lastID:", this.lastID);
  }
  pool.end();
});
