import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

export interface Session {
  userId: number;
  login: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
  refreshExpiresAt?: number;
  csrf: string;
  disconnected: number[];
  preferences: Record<
    string,
    { branch: string; lastVisitedAt: string; fullName?: string }
  >;
}
export const SESSION_TTL = 8 * 60 * 60 * 1000;
export const hash = (text: string): string =>
  createHash("sha256").update(text).digest("hex");
export const secret = (): string => randomBytes(32).toString("base64url");

export class Store {
  private db: DatabaseSync;
  constructor(
    path: string,
    private key: Buffer,
  ) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, payload TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS accounts (user_id INTEGER PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS oauth (state TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL);",
    );
    this.prune();
  }
  private encrypt(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }
  private decrypt<T>(value: string): T {
    const buffer = Buffer.from(value, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      buffer.subarray(0, 12),
    );
    cipher.setAuthTag(buffer.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        cipher.update(buffer.subarray(28)),
        cipher.final(),
      ]).toString("utf8"),
    ) as T;
  }
  prune(): void {
    this.db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    this.db.prepare("DELETE FROM oauth WHERE expires <= ?").run(Date.now());
    const expired = this.db
      .prepare("SELECT user_id, payload FROM accounts WHERE expires <= ?")
      .all(Date.now()) as { user_id: number; payload: string }[];
    for (const row of expired) {
      try {
        const account = this.decrypt<
          Pick<Session, "disconnected" | "preferences">
        >(row.payload);
        if (account.disconnected.length) {
          this.db
            .prepare(
              "UPDATE accounts SET payload = ?, expires = ? WHERE user_id = ?",
            )
            .run(
              this.encrypt({
                disconnected: account.disconnected,
                preferences: {},
              }),
              Date.now() + 30 * 24 * 60 * 60 * 1000,
              row.user_id,
            );
          continue;
        }
      } catch {
        /* Key rotation invalidates data encrypted by the old key. */
      }
      this.db
        .prepare("DELETE FROM accounts WHERE user_id = ?")
        .run(row.user_id);
    }
  }
  create(session: Session): string {
    this.prune();
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM sessions")
      .get() as { n: number };
    if (count.n >= 10000) throw new Error("Session capacity reached.");
    if (!this.account(session.userId)) this.saveAccount(session);
    const id = secret();
    this.db
      .prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)")
      .run(
        hash(id),
        session.userId,
        this.encrypt({ ...session, disconnected: [], preferences: {} }),
        Date.now() + SESSION_TTL,
      );
    return id;
  }
  get(id: string): Session | null {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
    const row = this.db
      .prepare("SELECT payload, expires FROM sessions WHERE id = ?")
      .get(hash(id)) as { payload: string; expires: number } | undefined;
    if (!row || row.expires <= Date.now()) {
      this.delete(id);
      return null;
    }
    try {
      const session = this.decrypt<Session>(row.payload);
      return { ...session, ...this.account(session.userId) };
    } catch {
      this.delete(id);
      return null;
    }
  }
  save(id: string, session: Session): void {
    this.db
      .prepare("UPDATE sessions SET payload = ? WHERE id = ? AND expires > ?")
      .run(
        this.encrypt({ ...session, disconnected: [], preferences: {} }),
        hash(id),
        Date.now(),
      );
  }
  delete(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(hash(id));
  }
  deleteUser(userId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    this.db.prepare("DELETE FROM accounts WHERE user_id = ?").run(userId);
  }
  private account(
    userId: number,
  ): Pick<Session, "disconnected" | "preferences"> | null {
    const row = this.db
      .prepare("SELECT payload, expires FROM accounts WHERE user_id = ?")
      .get(userId) as { payload: string; expires: number } | undefined;
    if (!row) return null;
    try {
      const value = this.decrypt<Pick<Session, "disconnected" | "preferences">>(
        row.payload,
      );
      return row.expires <= Date.now()
        ? { disconnected: value.disconnected, preferences: {} }
        : value;
    } catch {
      return null;
    }
  }
  saveAccount(session: Session): void {
    this.db
      .prepare(
        "INSERT INTO accounts VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload, expires=excluded.expires",
      )
      .run(
        session.userId,
        this.encrypt({
          disconnected: session.disconnected,
          preferences: session.preferences,
        }),
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );
  }
  beginOAuth(state: string, nonce: string, verifier: string): void {
    this.prune();
    const count = this.db.prepare("SELECT COUNT(*) AS n FROM oauth").get() as {
      n: number;
    };
    if (count.n >= 10000) throw new Error("Sign-in capacity reached.");
    this.db
      .prepare("INSERT INTO oauth VALUES (?, ?, ?)")
      .run(
        hash(state),
        this.encrypt({ nonceHash: hash(nonce), verifier }),
        Date.now() + 10 * 60 * 1000,
      );
  }
  consumeOAuth(state: string, nonce: string): string | null {
    const row = this.db
      .prepare("DELETE FROM oauth WHERE state = ? RETURNING payload, expires")
      .get(hash(state)) as { payload: string; expires: number } | undefined;
    if (!row || row.expires <= Date.now()) return null;
    try {
      const value = this.decrypt<{ nonceHash: string; verifier: string }>(
        row.payload,
      );
      return value.nonceHash === hash(nonce) ? value.verifier : null;
    } catch {
      return null;
    }
  }
  close(): void {
    this.db.close();
  }
}
