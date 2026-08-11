const { Pool } = require('pg');
require('dotenv').config();

console.log("Connecting to:", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("Connection failed:", err);
  } else {
    console.log("Connection successful! Time:", res.rows[0]);
  }
  pool.end();
});
