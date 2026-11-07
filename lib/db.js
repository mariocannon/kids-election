import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { makeParties } from './parties.js';

const db = new DatabaseSync(process.env.DB_FILE || new URL('../election.db', import.meta.url).pathname);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    voted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS tally (party_id INTEGER PRIMARY KEY, votes INTEGER NOT NULL DEFAULT 0);
`);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function getElection() {
  let parties = getSetting('parties', null);
  if (!parties) {
    parties = makeParties(4);
    setSetting('parties', parties);
  }
  return {
    title: getSetting('title', 'Big Class Election'),
    date: getSetting('date', new Date().toISOString().slice(0, 10)),
    parties,
  };
}

export function updateElection({ title, date }) {
  if (title) setSetting('title', title);
  if (date) setSetting('date', date);
}

export function newParties(count) {
  setSetting('parties', makeParties(count));
  db.exec('DELETE FROM tally');
}

export function addVoter(name, className) {
  const token = randomBytes(9).toString('base64url');
  const { lastInsertRowid } = db.prepare('INSERT INTO voters (name, class_name, token) VALUES (?, ?, ?)')
    .run(name, className, token);
  return getVoter(Number(lastInsertRowid));
}

export const getVoter = (id) => db.prepare('SELECT * FROM voters WHERE id = ?').get(id);
export const getVoterByToken = (token) => db.prepare('SELECT * FROM voters WHERE token = ?').get(token);
export const listVoters = () => db.prepare('SELECT * FROM voters ORDER BY id').all();
export const deleteVoter = (id) => db.prepare('DELETE FROM voters WHERE id = ?').run(id);

export function checkIn(voter) {
  if (voter.voted_at) return false;
  db.prepare("UPDATE voters SET voted_at = datetime('now', 'localtime') WHERE id = ?").run(voter.id);
  return true;
}

export const undoCheckIn = (id) => db.prepare('UPDATE voters SET voted_at = NULL WHERE id = ?').run(id);

export function getTally() {
  const rows = db.prepare('SELECT party_id, votes FROM tally').all();
  return Object.fromEntries(rows.map((r) => [r.party_id, r.votes]));
}

export function changeTally(partyId, delta) {
  db.prepare('INSERT OR IGNORE INTO tally (party_id, votes) VALUES (?, 0)').run(partyId);
  db.prepare('UPDATE tally SET votes = MAX(0, votes + ?) WHERE party_id = ?').run(delta, partyId);
}

export function resetEverything() {
  db.exec('DELETE FROM voters; DELETE FROM tally; DELETE FROM settings;');
}
