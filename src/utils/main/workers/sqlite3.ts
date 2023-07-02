import DB, { BetterSqlite3Helper } from 'better-sqlite3-helper'
import { expose } from 'threads/worker'
import { migrations } from '../db/migrations'

expose({
  start(dbPath: string) {
    return start(dbPath)
  },
  async execute(key: keyof BetterSqlite3Helper.DBInstance, ...args: unknown[]) {
    return await execute(key, ...args)
  }
})

let db: BetterSqlite3Helper.DBInstance

async function execute(key: keyof BetterSqlite3Helper.DBInstance, ...args: unknown[]) {
  return await (db[key] as (...args: unknown[]) => unknown)(...args)
}

function start(dbPath: string) {
  db = DB({
    path: dbPath,
    readonly: false,
    fileMustExist: false,
    WAL: true,
    migrate: {
      migrations: migrations
    }
  })
  registerRegexp(db)
}

function registerRegexp(database: BetterSqlite3Helper.DBInstance) {
  database.function('regexp', (pattern: string, str: string) => {
    if (str != null) {
      return str.match(new RegExp(pattern, 'i')) ? 1 : 0
    }
    return 0
  })
}
