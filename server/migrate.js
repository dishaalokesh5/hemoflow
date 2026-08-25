import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Database migrations applied successfully.');
  } catch (err) {
    console.error('Failed to run database migrations:', err.message);
  }
}

if (process.argv[1] === __filename) {
  runMigrations().then(() => process.exit(0));
}
