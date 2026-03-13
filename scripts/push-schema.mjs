#!/usr/bin/env node
/**
 * push-schema.mjs
 * Đẩy supabase/schema.sql lên Supabase qua kết nối PostgreSQL trực tiếp.
 *
 * Sử dụng:
 *   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres \
 *   node scripts/push-schema.mjs
 *
 * Hoặc thêm DATABASE_URL vào .env.local rồi chạy:
 *   bun run db:push
 */

import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Đọc biến môi trường ──────────────────────────────────────────────────────
const loadEnv = () => {
  try {
    const env = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
    for (const line of env.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local không bắt buộc nếu biến đã được set trong shell
  }
};

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(`
❌  Thiếu biến môi trường DATABASE_URL!

Thêm vào .env.local:

  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres

  ← Lấy connection string tại: Project Settings → Database → Connection string → URI

⚠️  Database password có quyền admin. KHÔNG commit vào git.
`);
  process.exit(1);
}

// ── Đọc schema SQL ────────────────────────────────────────────────────────────
const schemaPath = resolve(__dirname, "../supabase/schema.sql");
const gachaSchemaPath = resolve(__dirname, "../supabase/gacha-schema.sql");

let sql;
try {
  const mainSchema = readFileSync(schemaPath, "utf8");
  const gachaSchema = readFileSync(gachaSchemaPath, "utf8");
  sql = mainSchema + "\n\n" + gachaSchema;
} catch (err) {
  console.error(`❌  Không đọc được file schema: ${err.message}`);
  process.exit(1);
}

// ── Tách statements ──────────────────────────────────────────────────────────
const splitStatements = (raw) => {
  const stmts = [];
  let cur = "";
  let dollarDepth = 0;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;

    const dollarMatches = (trimmed.match(/\$\$/g) || []).length;
    dollarDepth += dollarMatches;

    cur += line + "\n";

    if (dollarDepth % 2 === 0 && trimmed.endsWith(";")) {
      const stmt = cur.trim();
      if (stmt.length > 1) stmts.push(stmt);
      cur = "";
    }
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
};

// ── Main ──────────────────────────────────────────────────────────────────────
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const statements = splitStatements(sql);
console.log(`\n🚀  Kết nối PostgreSQL và đẩy schema...`);
console.log(`📄  ${schemaPath}`);
console.log(`📄  ${gachaSchemaPath}`);
console.log(`📝  ${statements.length} statements\n`);

let ok = 0;
let failed = 0;

try {
  await client.connect();
  console.log("✅  Kết nối thành công!\n");

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 72);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}… `);
    try {
      await client.query(stmt);
      console.log("✅");
      ok++;
    } catch (err) {
      const msg = String(err.message);
      if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("already member")) {
        console.log("⏭️  (đã tồn tại)");
        ok++;
      } else {
        console.log(`❌\n     ${msg}`);
        failed++;
      }
    }
  }
} catch (connErr) {
  console.error(`❌  Không thể kết nối đến database: ${connErr.message}`);
  process.exit(1);
} finally {
  await client.end();
}

console.log(`\n${"─".repeat(50)}`);
console.log(`✅  Thành công: ${ok}   ❌  Lỗi: ${failed}`);

if (failed > 0) {
  console.error("\n⚠️  Một số statement thất bại. Kiểm tra lại log ở trên.");
  process.exit(1);
} else {
  console.log("\n🎉  Schema đã được đẩy lên Supabase thành công!");
}
