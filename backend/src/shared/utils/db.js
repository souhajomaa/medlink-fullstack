import pg from 'pg';
import { getSecret } from './secrets.js'; // ✅ AJOUT

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'medlink',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medlink',
  password: getSecret('db_password'), // ✅ REMPLACE process.env.DB_PASSWORD
  port: parseInt(process.env.DB_PORT) || 5432,
});

export default pool;