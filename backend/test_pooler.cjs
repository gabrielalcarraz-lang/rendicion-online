const { Pool } = require('pg');

const connString = 'postgresql://postgres.gzyffxcncoygmsydrmyy:%40go2drrazcaaL@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to Supabase Pooler:', err);
  } else {
    console.log('Connected to Supabase Pooler successfully:', res.rows);
  }
  pool.end();
});
