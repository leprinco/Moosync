/*
 *  utils.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import type { BetterSqlite3Helper } from 'better-sqlite3-helper'

import { app } from 'electron'
import path from 'path'

import { Worker, spawn } from 'threads'
import { WorkerModule } from 'threads/dist/types/worker'
import { loadSelectivePreference } from './preferences'

interface BetterSqlite3Mock {
  exec: () => Promise<void>
  run: (
    ...args: Parameters<BetterSqlite3Helper.DBInstance['run']>
  ) => Promise<ReturnType<BetterSqlite3Helper.DBInstance['run']>>
  insert: (
    ...args: Parameters<BetterSqlite3Helper.DBInstance['insert']>
  ) => Promise<ReturnType<BetterSqlite3Helper.DBInstance['insert']>>

  query: <T>(...args: Parameters<BetterSqlite3Helper.DBInstance['query']>) => Promise<T[]>

  queryFirstCell: <T>(...args: Parameters<BetterSqlite3Helper.DBInstance['queryFirstCell']>) => Promise<T>
  queryFirstRowObject: <T>(
    ...args: Parameters<BetterSqlite3Helper.DBInstance['queryFirstRowObject']>
  ) => Promise<object>
  queryColumn: <T>(...args: Parameters<BetterSqlite3Helper.DBInstance['queryColumn']>) => Promise<T>
  queryFirstRow: <T>(...args: Parameters<BetterSqlite3Helper.DBInstance['queryFirstRow']>) => Promise<T>

  delete: (
    ...args: Parameters<BetterSqlite3Helper.DBInstance['delete']>
  ) => Promise<ReturnType<BetterSqlite3Helper.DBInstance['delete']>>

  update: (
    ...args: Parameters<BetterSqlite3Helper.DBInstance['update']>
  ) => Promise<ReturnType<BetterSqlite3Helper.DBInstance['update']>>

  updateWithBlackList: (
    ...args: Parameters<BetterSqlite3Helper.DBInstance['updateWithBlackList']>
  ) => Promise<ReturnType<BetterSqlite3Helper.DBInstance['updateWithBlackList']>>
}

interface PreStartQueue {
  command: keyof BetterSqlite3Mock
  args: unknown[]
  resolver: (...value: never[]) => void
}

const keys: (keyof BetterSqlite3Mock)[] = [
  'delete',
  'exec',
  'insert',
  'query',
  'queryColumn',
  'queryFirstCell',
  'queryFirstRow',
  'queryFirstRowObject',
  'run',
  'update',
  'updateWithBlackList'
]

export class DBWorkerWrapper {
  protected db: BetterSqlite3Mock
  private worker: Unpromise<ReturnType<typeof spawn<WorkerModule<string>>>> | undefined
  private preStartQueue: PreStartQueue[] = []

  constructor(dbPath?: string) {
    this.start(dbPath ?? path.join(app.getPath('appData'), app.getName(), 'databases', 'songs.db'))

    // Defer all calls till DB has started
    this.db = {} as BetterSqlite3Mock
    for (const k of keys) {
      this.db[k] = (...args: unknown[]) =>
        new Promise<never>((resolve) => {
          this.preStartQueue.push({
            command: k,
            args,
            resolver: resolve
          })
        })
    }
  }

  public async start(dbPath: string) {
    this.worker = await spawn(new Worker(__dirname + '/sqlite3.worker.js'))
    await this.worker.start(app.getPath('logs'), dbPath, loadSelectivePreference('thumbnailPath'))

    for (const k of keys) {
      this.db[k] = (...args: unknown[]) => this.worker?.execute(k, ...args) as never
    }

    // Empty the pre-start queue
    while (this.preStartQueue.length > 0) {
      const item = this.preStartQueue.splice(0, 1)[0]
      this.db[item.command](...(item.args as never[])).then((...value: unknown[]) =>
        item.resolver(...(value as never[]))
      )
    }
  }

  public close() {
    if (this.worker) this.worker.close()
  }

  protected async execute(method: string, args: unknown[]) {
    return this.worker?.execute(method, args)
  }
}
