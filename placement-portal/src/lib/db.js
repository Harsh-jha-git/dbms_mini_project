import mysql from 'mysql2/promise';

const g = globalThis;
export const pool =
  g._pool ??
  (g._pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 10,
    dateStrings: true,
    decimalNumbers: true,
    multipleStatements: false,
  }));

// rows from a plain SELECT
export async function rows(sql, params = []) {
  const [r] = await pool.query(sql, params);
  return r;
}
