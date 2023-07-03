import DB, { BetterSqlite3Helper } from 'better-sqlite-helper'
import { expose } from 'threads/worker'
import { migrations } from '../db/migrations'
import { getLogger, levels } from 'loglevel'
import { v1 } from 'uuid'
import { prefixLogger } from '../logger/utils'

const logger = getLogger(`Sqlite3Worker (${v1()})`)
logger.setLevel(process.env.DEBUG_LOGGING ? levels.DEBUG : levels.INFO)

expose({
  start(loggerPath: string, dbPath: string) {
    prefixLogger(loggerPath, logger)
    return start(dbPath)
  },
  async execute(key: keyof BetterSqlite3Helper.DBInstance, ...args: unknown[]) {
    return await execute(key, ...args)
  },
  close() {
    close()
  }
})

let db: BetterSqlite3Helper.DBInstance | undefined = undefined

async function execute(key: keyof BetterSqlite3Helper.DBInstance, ...args: unknown[]) {
  return await (db?.[key] as (...args: unknown[]) => unknown)(...args)
}

function start(dbPath: string) {
  db = DB({
    path: dbPath,
    readonly: false,
    fileMustExist: false,
    WAL: true,
    verbose: (...args: unknown[]) => logger.debug('Executing query', ...args),
    migrate: {
      migrations: migrations
    }
  } as BetterSqlite3Helper.DBOptions)
  registerRegexp(db)
}

function close() {
  if (db?.open) {
    db.close()
  }
}

function registerRegexp(database: BetterSqlite3Helper.DBInstance) {
  database.function('regexp', (pattern: string, str: string) => {
    if (str != null) {
      return str.match(new RegExp(pattern, 'i')) ? 1 : 0
    }
    return 0
  })
}
