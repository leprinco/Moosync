/*
 *  playlists.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { IpcEvents, PlaylistEvents } from './constants'
import { loadPreferences } from '@/utils/main/db/preferences'

import { _windowHandler } from '../windowManager'
import { getSongDB } from '@/utils/main/db'
import fs from 'fs'
import { writeFile } from 'fs/promises'
import path from 'path'
import { v4 } from 'uuid'

export class PlaylistsChannel implements IpcChannelInterface {
  name = IpcEvents.PLAYLIST
  handle(event: Electron.IpcMainEvent, request: IpcRequest): void {
    switch (request.type) {
      case PlaylistEvents.ADD_TO_PLAYLIST:
        this.addToPlaylist(event, request as IpcRequest<PlaylistRequests.AddToPlaylist>)
        break
      case PlaylistEvents.REMOVE_FROM_PLAYLIST:
        this.removeFromPlaylist(event, request as IpcRequest<PlaylistRequests.AddToPlaylist>)
        break
      case PlaylistEvents.CREATE_PLAYLIST:
        this.createPlaylist(event, request as IpcRequest<PlaylistRequests.CreatePlaylist>)
        break
      case PlaylistEvents.UPDATE_PLAYLIST:
        this.updatePlaylist(event, request as IpcRequest<PlaylistRequests.CreatePlaylist>)
        break
      case PlaylistEvents.SAVE_COVER:
        this.saveCoverToFile(event, request as IpcRequest<PlaylistRequests.SaveCover>)
        break
      case PlaylistEvents.REMOVE_PLAYLIST:
        this.removePlaylist(event, request as IpcRequest<PlaylistRequests.RemoveExportPlaylist>)
        break
      case PlaylistEvents.EXPORT:
        this.exportPlaylist(event, request as IpcRequest<PlaylistRequests.RemoveExportPlaylist>)
        break
    }
  }

  private async createPlaylist(event: Electron.IpcMainEvent, request: IpcRequest<PlaylistRequests.CreatePlaylist>) {
    try {
      const data = await getSongDB().createPlaylist(request.params.playlist)
      event.reply(request.responseChannel, data)
    } catch (e) {
      console.error(e)
      event.reply(request.responseChannel)
    }
  }

  private async updatePlaylist(event: Electron.IpcMainEvent, request: IpcRequest<PlaylistRequests.CreatePlaylist>) {
    await getSongDB().updatePlaylist(request.params.playlist)
    event.reply(request.responseChannel)
  }

  private async addToPlaylist(event: Electron.IpcMainEvent, request: IpcRequest<PlaylistRequests.AddToPlaylist>) {
    await getSongDB().addToPlaylist(request.params.playlist_id, ...request.params.song_ids)
    event.reply(request.responseChannel)
  }

  private async saveCoverToFile(event: Electron.IpcMainEvent, request: IpcRequest<PlaylistRequests.SaveCover>) {
    if (request.params.b64) {
      const cacheDir = loadPreferences().thumbnailPath
      const filePath = path.join(cacheDir, `${v4()}.png`)
      if (fs.existsSync(cacheDir)) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } else {
        fs.mkdirSync(cacheDir)
      }
      fs.writeFile(filePath, request.params.b64.replace(/^data:image\/png;base64,/, ''), 'base64', () => {
        event.reply(request.responseChannel, filePath)
      })
      return
    }
    event.reply(request.responseChannel)
  }

  private async removePlaylist(
    event: Electron.IpcMainEvent,
    request: IpcRequest<PlaylistRequests.RemoveExportPlaylist>,
  ) {
    if (request.params.playlist) {
      await getSongDB().removePlaylist(request.params.playlist)
      event.reply(request.responseChannel)
    }
    event.reply(request.responseChannel)
  }

  private async exportPlaylist(
    event: Electron.IpcMainEvent,
    request: IpcRequest<PlaylistRequests.RemoveExportPlaylist>,
  ) {
    if (request.params.playlist) {
      const playlist = request.params.playlist
      if (playlist) {
        const m3u8 = `#EXTM3U\n#PLAYLIST:${playlist.playlist_name}\n${await this.parsePlaylistSongs(playlist)}`

        const filePath = await _windowHandler.openSaveDialog(true, {
          title: 'Save playlist as...',
          properties: ['showOverwriteConfirmation', 'createDirectory'],
          filters: [
            {
              name: 'm3u Playlist',
              extensions: ['m3u'],
            },
          ],
        })
        if (!filePath?.canceled && filePath?.filePath) {
          let exportPath = filePath.filePath
          if (!path.extname(exportPath).startsWith('.m3u')) {
            exportPath += '.m3u'
          }

          console.debug('Exporting playlist to', exportPath)
          writeFile(exportPath, m3u8, {
            encoding: 'utf-8',
          })
        }
      }
    }
    event.reply(request.responseChannel)
  }

  private async getParsedCoverPath(song: Song) {
    const cover = song.song_coverPath_high ?? song.album?.album_coverPath_high

    if (cover) {
      if (cover.startsWith('http')) {
        return cover
      }
    }
  }

  private async parsePlaylistSongs(playlist: Playlist) {
    let ret = ''
    const playlistSongs = await getSongDB().getSongByOptions({ playlist: { playlist_id: playlist.playlist_id } })
    for (const s of playlistSongs) {
      if (s.path || s.url) {
        ret += `#EXTINF:${s.duration ?? 0},${this.getSongTitleParsed(s)}
${s.album && `#EXTALB:${s.album?.album_name}`}
${s.genre && s.genre.length !== 0 ? `#EXTGENRE:${s.genre.join(',')}` : ''}
${(await this.getParsedCoverPath(s)) && `#EXTIMG:${await this.getParsedCoverPath(s)}`}
#MOOSINF:${s.type}
${(s.path && `file://${s.path}`) ?? s.url}\n`
      }
    }

    // Remove blank lines
    return ret.replace(/^s*$(?:\r\n?|\n)/gm, '')
  }

  private getSongTitleParsed(song: Song) {
    if (song.artists && song.artists.length > 0) {
      return `${song.artists.map((val) => val.artist_name).join(';')} - ${song.title}`
    }

    return song.title
  }

  private async removeFromPlaylist(event: Electron.IpcMainEvent, request: IpcRequest<PlaylistRequests.AddToPlaylist>) {
    if (request.params.playlist_id && request.params.song_ids) {
      await getSongDB().removeFromPlaylist(request.params.playlist_id, ...request.params.song_ids)
    }
    event.reply(request.responseChannel)
  }
}
