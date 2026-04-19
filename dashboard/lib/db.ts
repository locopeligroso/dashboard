import 'server-only'
import Database from 'better-sqlite3'

const READ_PATH = process.env.DB_PATH ?? '/openclaw-data/workspace/mail-db.sqlite'
const WRITE_PATH = process.env.DB_WRITE_PATH ?? '/openclaw-data-rw/mail-db.sqlite'

type DB = Database.Database
let readInstance: DB | null = null
let writeInstance: DB | null = null

export function getReadDb(): DB {
  if (!readInstance) {
    readInstance = new Database(READ_PATH, { readonly: true, fileMustExist: true })
    readInstance.pragma('query_only = true')
  }
  return readInstance
}

export function getWriteDb(): DB {
  if (!writeInstance) {
    writeInstance = new Database(WRITE_PATH, { readonly: false, fileMustExist: true })
    // Avoid WAL for dual-mount compatibility
    try {
      writeInstance.pragma('journal_mode = DELETE')
    } catch {}
    writeInstance.pragma('foreign_keys = ON')
  }
  return writeInstance
}
