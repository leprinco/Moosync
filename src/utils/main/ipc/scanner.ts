/*
 *  scanner.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { IpcEvents, ScannerEvents } from './constants'

import { IpcMainEvent, app } from 'electron'
import { getSongDB } from '@/utils/main/db/index'
import fs from 'fs'
import os from 'os'

import { WindowHandler } from '../windowManager'
import { setupScanTask } from '../scheduler'
import { getCombinedMusicPaths, loadPreferences, loadSelectivePreference } from '../db/preferences'
import path from 'path'

import type { SongWithLen, Song as ScanSong, Playlist as ScanPlaylist } from 'scanner-native'
import { v4 } from 'uuid'

enum ScanStatus {
  UNDEFINED,
  SCANNING,
  QUEUED
}

export class ScannerChannel implements IpcChannelInterface {
  name = IpcEvents.SCANNER
  private scanStatus: ScanStatus = ScanStatus.UNDEFINED

  private totalScanFiles = 0
  private currentScanFile = 0

  handle(event: IpcMainEvent, request: IpcRequest) {
    switch (request.type) {
      case ScannerEvents.SCAN_MUSIC:
        this.scanAll(event, request as IpcRequest<ScannerRequests.ScanSongs>)
        break
      case ScannerEvents.SCAN_SINGLE_SONG:
        this.scanSingleSong(event, request as IpcRequest<ScannerRequests.ScanSingleSong>)
        break
      case ScannerEvents.GET_PROGRESS:
        this.getScanProgress(event, request)
        break
      case ScannerEvents.SCAN_SINGLE_PLAYLIST:
        this.scanSinglePlaylist(event, request as IpcRequest<ScannerRequests.ScanSinglePlaylist>)
        break
      case ScannerEvents.RESET_SCAN_TASK:
        this.resetScanTask(event, request)
        break
    }
  }

  private async getScanProgress(event: IpcMainEvent, request: IpcRequest) {
    event.reply(request.responseChannel, {
      status: this.scanStatus,
      total: this.totalScanFiles,
      current: this.currentScanFile
    })
  }

  private async destructiveScan(paths: togglePaths) {
    const allSongs = await getSongDB().getSongByOptions()
    const excludePaths = paths.filter((val) => !val.enabled).map((val) => val.path)
    const excludeRegex = new RegExp(excludePaths.length > 0 ? excludePaths.join('|').replaceAll('\\', '\\\\') : /(?!)/)

    const toRemove: Song[] = []
    for (const s of allSongs) {
      if (s.type == 'LOCAL') {
        if (paths.length == 0 || !s.path || s.path?.match(excludeRegex)) {
          toRemove.push(s)
          continue
        }

        try {
          await fs.promises.access(s.path, fs.constants.F_OK)
        } catch (e) {
          toRemove.push(s)
        }
      }
    }

    await getSongDB().removeSong(...toRemove)
    if (toRemove.length === 0) {
      await getSongDB().cleanDb()
    }
  }

  private reportProgress(currentScanIndex: number) {
    this.currentScanFile = currentScanIndex

    WindowHandler.getWindow(false)?.webContents.send(ScannerEvents.PROGRESS_CHANNEL, {
      current: this.currentScanFile,
      total: this.totalScanFiles,
      status: this.scanStatus
    } as Progress)
  }

  private parseScannedSong(data: ScanSong): Song {
    return {
      ...data,
      _id: v4(),
      date_added: Date.now()
    } as Song
  }

  private async storeSong(data: SongWithLen) {
    console.log('storing', data.song.title)
    await getSongDB().store(this.parseScannedSong(data.song))

    this.totalScanFiles = data.size
    this.reportProgress(data.current)
  }

  private parseScannedPlaylist(data: ScanPlaylist): Playlist {
    return {
      playlist_name: data.title,
      playlist_path: 'some path',
      playlist_id: 'TODO'
    }
  }

  private async storePlaylist(data: ScanPlaylist) {
    await getSongDB().createPlaylist(this.parseScannedPlaylist(data))
  }

  private async scanFilePromisified(paths: string[], forceScan = false, store = false) {
    const splitPattern = loadSelectivePreference<string>('scan_splitter') ?? ';'
    const maxThreads = os.cpus().length
    const thumbPath = loadPreferences().thumbnailPath

    const { scanFiles } = await import('scanner-native')

    const lastValue: { songs: Song[]; playlists: Playlist[] } = { songs: [], playlists: [] }

    // for (const p of paths) {
    await new Promise<typeof lastValue>((resolve) => {
      scanFiles(
        paths[1],
        thumbPath,
        path.join(app.getPath('appData'), app.getName(), 'databases', 'songs.db'),
        splitPattern,
        maxThreads,
        forceScan,
        (err, res) => {
          if (!err) {
            if (store) {
              this.storeSong(res)
            } else {
              lastValue.songs.push(this.parseScannedSong(res.song))
            }
          }
        },
        (err, res) => {
          if (!err) {
            if (store) {
              this.storePlaylist(res)
            } else {
              lastValue.playlists.push(this.parseScannedPlaylist(res))
            }
          }
        },
        () => resolve(lastValue)
      )
    })
    // }

    return lastValue
  }

  public async scanAll(event?: IpcMainEvent, request?: IpcRequest<ScannerRequests.ScanSongs>): Promise<void> {
    if (this.scanStatus !== ScanStatus.UNDEFINED) {
      return
    }

    console.log('starting scan')

    const paths = getCombinedMusicPaths() ?? []
    await this.destructiveScan(paths)

    this.scanStatus = ScanStatus.SCANNING as ScanStatus

    await this.scanFilePromisified(
      paths.filter((val) => val.enabled).map((val) => val.path),
      request?.params.forceScan,
      true
    )

    if (this.scanStatus === ScanStatus.QUEUED) {
      return this.scanAll(event, request)
    }

    this.scanStatus = ScanStatus.UNDEFINED
  }

  private async scanSingleSong(event: IpcMainEvent, request: IpcRequest<ScannerRequests.ScanSingleSong>) {
    if (request.params.songPath) {
      const result = await this.scanFilePromisified([request.params.songPath], true, false)
      event.reply(request.responseChannel, { song: result.songs[0] })
    }
  }

  private async scanSinglePlaylist(event: IpcMainEvent, request: IpcRequest<ScannerRequests.ScanSinglePlaylist>) {
    if (request.params.playlistPath) {
      event.reply(request.responseChannel, await this.scanFilePromisified([request.params.playlistPath], true, false))
    }
  }

  private resetScanTask(event: IpcMainEvent, request: IpcRequest) {
    setupScanTask()
    event.reply(request.responseChannel)
  }
}
