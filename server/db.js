import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/hemoflow'
});

pool.on('error', (err) => {
  console.error('Unexpected database client error:', err.message);
});

export default pool;
