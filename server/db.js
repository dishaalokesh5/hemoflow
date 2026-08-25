import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const isCloudDb = connectionString && !connectionString.includes('localhost');

const pool = new pg.Pool(
  connectionString
    ? {
        connectionString,
        ssl: isCloudDb ? { rejectUnauthorized: false } : false
      }
    : {
        connectionString: 'postgres://postgres@localhost:5432/hemoflow'
      }
);

pool.on('error', (err) => {
  console.error('Unexpected database client error:', err.message);
});

export default pool;
