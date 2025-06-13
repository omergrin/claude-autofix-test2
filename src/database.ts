import sqlite3 from 'sqlite3';
import { SolvedIssue } from './types.js';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private async initTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS solved_issues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          root_cause_hash TEXT UNIQUE NOT NULL,
          github_issue_number INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          error_pattern TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async isSolved(rootCauseHash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM solved_issues WHERE root_cause_hash = ?',
        [rootCauseHash],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async markAsSolved(rootCauseHash: string, githubIssueNumber: number, errorPattern: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO solved_issues (root_cause_hash, github_issue_number, error_pattern) VALUES (?, ?, ?)',
        [rootCauseHash, githubIssueNumber, errorPattern],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getSolvedIssues(): Promise<SolvedIssue[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM solved_issues ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as SolvedIssue[]);
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}