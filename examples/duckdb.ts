import duckdb from "duckdb";

import { type TableData, type Database } from "duckdb";

export async function getDbInstance(dbFileName = ":memory:") {
  const inst = await new Promise((resolve, reject) => {
    const db = new duckdb.Database(
      dbFileName,
      { access_mode: "READ_WRITE", allow_unsigned_extensions: "true" },
      (err, res) => {
        if (err) {
          console.error(err);
          reject(err);
        } else resolve(db);
      }
    );
  });
  return inst;
}

export async function asyncQueryDuckDB(db: Database, sql: string): Promise<TableData> {
  const res = await new Promise<TableData>((resolve, reject) => {
    db.all(sql, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      } else resolve(data);
    });
  });
  return res;
}
