const { Pool } = require('pg');

const connString = 'postgresql://postgres:%40go2drrazcaaL@db.gzyffxcncoygmsydrmyy.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false } // Need SSL for Supabase outside their network usually
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to Supabase:', err);
  } else {
    console.log('Connected to Supabase successfully:', res.rows);
  }
  pool.end();
});
