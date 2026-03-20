import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullGeneratedCase } from '../types/index.js';

type QualityInput = {
  score: number;
  reasons: string[];
};

type LearningSnapshot = {
  count: number;
  avgScore: number;
  reasons: string[];
};

export class CaseMemoryStore {
  private db: any | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private memoryFallback = new Map<string, LearningSnapshot>();

  private async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const dynamicImport = new Function('specifier', 'return import(specifier)') as (
          specifier: string
        ) => Promise<unknown>;
        const sqliteModule = (await dynamicImport('node:sqlite')) as Record<string, unknown>;
        const DatabaseSync = (sqliteModule as { DatabaseSync: new (location: string) => any }).DatabaseSync;

        const dbUrl = new URL('../../data/case-memory.sqlite', import.meta.url);
        const dbFilePath = fileURLToPath(dbUrl);
        await mkdir(path.dirname(dbFilePath), { recursive: true });

        const db = new DatabaseSync(dbFilePath);
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA synchronous = NORMAL;');
        db.exec('PRAGMA temp_store = MEMORY;');
        db.exec('PRAGMA busy_timeout = 1000;');

        db.exec(`
          CREATE TABLE IF NOT EXISTS case_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            room_code TEXT NOT NULL,
            subject TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            score INTEGER NOT NULL,
            reasons_json TEXT NOT NULL,
            boi_canh TEXT NOT NULL,
            loi_khai TEXT NOT NULL,
            kien_thuc_an TEXT NOT NULL,
            keywords_json TEXT NOT NULL
          );
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS subject_memory (
            subject TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            avg_score REAL NOT NULL,
            reasons_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        this.db = db;
      } catch (error) {
        console.warn('case_memory_store_disabled', error);
      } finally {
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  private updateFallback(subject: string, quality: QualityInput): void {
    const prev = this.memoryFallback.get(subject) ?? { count: 0, avgScore: 0, reasons: [] };
    const nextCount = prev.count + 1;
    const nextAvg = (prev.avgScore * prev.count + quality.score) / nextCount;
    const nextReasons = [...quality.reasons, ...prev.reasons]
      .filter((reason, index, arr) => arr.indexOf(reason) === index)
      .slice(0, 6);

    this.memoryFallback.set(subject, {
      count: nextCount,
      avgScore: nextAvg,
      reasons: nextReasons,
    });
  }

  async getLearningHint(subject: string): Promise<string> {
    await this.init();

    if (this.db) {
      const row = this.db
        .prepare('SELECT avg_score, reasons_json FROM subject_memory WHERE subject = ?')
        .get(subject) as { avg_score?: number; reasons_json?: string } | undefined;

      if (row?.reasons_json) {
        const reasons = JSON.parse(row.reasons_json) as string[];
        if (reasons.length > 0) {
          return (
            `BÀI HỌC DỰA TRÊN DỮ LIỆU THẬT (môn ${subject}):\n` +
            reasons.slice(0, 3).map((reason, index) => `${index + 1}) ${reason}`).join('\n') +
            `\nĐiểm trung bình lịch sử: ${Math.round(row.avg_score ?? 0)}/100.\n\n`
          );
        }
      }
    }

    const fallback = this.memoryFallback.get(subject);
    if (!fallback || fallback.reasons.length === 0) return '';

    return (
      `BÀI HỌC TỪ BỘ NHỚ TẠM (môn ${subject}):\n` +
      fallback.reasons.slice(0, 3).map((reason, index) => `${index + 1}) ${reason}`).join('\n') +
      `\nĐiểm trung bình gần đây: ${Math.round(fallback.avgScore)}/100.\n\n`
    );
  }

  async saveGeneration(params: {
    roomCode: string;
    subject: string;
    difficulty: string;
    quality: QualityInput;
    caseData: FullGeneratedCase;
  }): Promise<void> {
    await this.init();

    const { roomCode, subject, difficulty, quality, caseData } = params;
    this.updateFallback(subject, quality);

    if (!this.db) return;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO case_sessions
          (created_at, room_code, subject, difficulty, score, reasons_json, boi_canh, loi_khai, kien_thuc_an, keywords_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        now,
        roomCode,
        subject,
        difficulty,
        quality.score,
        JSON.stringify(quality.reasons),
        caseData.boi_canh,
        caseData.loi_khai,
        caseData.kien_thuc_an,
        JSON.stringify(caseData.tu_khoa_thang_cuoc)
      );

    const existing = this.db
      .prepare('SELECT count, avg_score, reasons_json FROM subject_memory WHERE subject = ?')
      .get(subject) as { count?: number; avg_score?: number; reasons_json?: string } | undefined;

    const prevCount = existing?.count ?? 0;
    const prevAvg = existing?.avg_score ?? 0;
    const nextCount = prevCount + 1;
    const nextAvg = (prevAvg * prevCount + quality.score) / nextCount;
    const prevReasons = existing?.reasons_json ? (JSON.parse(existing.reasons_json) as string[]) : [];
    const mergedReasons = [...quality.reasons, ...prevReasons]
      .filter((reason, index, arr) => arr.indexOf(reason) === index)
      .slice(0, 6);

    this.db
      .prepare(
        `INSERT INTO subject_memory (subject, count, avg_score, reasons_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(subject) DO UPDATE SET
           count = excluded.count,
           avg_score = excluded.avg_score,
           reasons_json = excluded.reasons_json,
           updated_at = excluded.updated_at`
      )
      .run(subject, nextCount, nextAvg, JSON.stringify(mergedReasons), now);
  }
}

export const caseMemoryStore = new CaseMemoryStore();
