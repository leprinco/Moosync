/*
 *  database.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { DBUtils } from './utils'
import { promises as fsP } from 'fs'
import { v4 } from 'uuid'
import { isArtist, isEmpty, sanitizeArtistName } from '../../common'

import { loadPreferences } from './preferences'
import path from 'path'
import { getExtensionHostChannel } from '../ipc'
import { downloadFile } from '@/utils/main/mainUtils'
import { isAlbum } from '../../common'
import { access, mkdir } from 'fs/promises'

type KeysOfUnion<T> = T extends T ? keyof T : never
// AvailableKeys will basically be keyof Foo | keyof Bar
// so it will be  "foo" | "bar"
type EntityKeys<T extends Artists | Album | Genre | Playlist> = KeysOfUnion<EntityApiOptions<T>>

export class SongDBInstance extends DBUtils {
  /* ============================= 
                ALLSONGS
     ============================= */

  private verifySong(song: Partial<Song>) {
    return !!(song._id && song.title && song.date_added && !isEmpty(song.duration) && song.type)
  }

  private getSongId(oldId: string, providerExtension?: string) {
    if (providerExtension) {
      if (oldId.startsWith(`${providerExtension}:`)) {
        return oldId
      } else {
        return `${providerExtension}:${oldId}`
      }
    }

    return oldId
  }

  private notifyExtensionHostSongChanged(added: boolean, songs: Song[]) {
    if (songs.length > 0) {
      getExtensionHostChannel().sendExtraEvent({
        type: added ? 'songAdded' : 'songRemoved',
        data: [songs]
      })
    }
  }

  public async store(...songsToAdd: Song[]): Promise<Song[]> {
    const newList: Song[] = []
    const existingList: Song[] = []
    for (const newDoc of songsToAdd) {
      if (this.verifySong(newDoc)) {
        const existing = (await this.getSongByOptions({ song: { _id: newDoc._id, path: newDoc.path } }))[0]
        if (existing) {
          existingList.push(existing)
          continue
        }

        const artistID = newDoc.artists ? await this.storeArtists(...newDoc.artists) : []
        const albumID = newDoc.album ? await this.storeAlbum(newDoc.album) : ''
        const genreID = newDoc.genre ? await this.storeGenre(...newDoc.genre) : []

        newDoc._id = this.getSongId(newDoc._id ?? v4(), newDoc.providerExtension)

        const marshaledSong = this.marshalSong(newDoc)

        this.db.insert('allsongs', { ...marshaledSong, duration: marshaledSong.duration || -1 })
        this.storeArtistBridge(artistID, marshaledSong._id)
        this.storeGenreBridge(genreID, marshaledSong._id)
        this.storeAlbumBridge(albumID, marshaledSong._id)

        this.updateAllSongCounts()

        if (newDoc.artists && artistID.length > 0) {
          for (const i in newDoc.artists) {
            newDoc.artists[i].artist_id = artistID[i]
          }
        }

        if (newDoc.album && albumID) {
          newDoc.album.album_id = albumID
        }

        newList.push(newDoc)
      } else {
        console.error('Failed to verify song', newDoc)
      }
    }

    this.notifyExtensionHostSongChanged(true, newList)
    return [...newList, ...existingList]
  }

  private updateAllSongCounts() {
    this.updateSongCountAlbum()
    this.updateSongCountArtists()
    this.updateSongCountGenre()
    this.updateSongCountPlaylists()
  }

  private async getCountBySong(bridge: string, column: string, song: string) {
    const data: Record<string, string>[] = await this.db.query(`SELECT ${column} FROM ${bridge} WHERE song = ?`, song)
    const counts = []
    for (const i of data) {
      counts.push(
        ...(await this.db.query(`SELECT count(id) as count, ${column} FROM ${bridge} WHERE ${column} = ?`, i[column]))
      )
    }

    return counts
  }

  /**
   * Removes song by its ID. Also removes references to albums, artists, genre, playlist and unlinks thumbnails.
   * @param songs list of songs to remove
   */
  public async removeSong(...songs: Song[]) {
    const pathsToRemove: string[] = []

    for (const song_id of songs.map((val) => val._id)) {
      const songCoverPath_low: string = await this.db.queryFirstCell(
        `SELECT song_coverPath_low from allsongs WHERE _id = ?`,
        song_id
      )
      const songCoverPath_high: string = await this.db.queryFirstCell(
        `SELECT song_coverPath_high from allsongs WHERE _id = ?`,
        song_id
      )

      if (songCoverPath_low) pathsToRemove.push(songCoverPath_low)
      if (songCoverPath_high) pathsToRemove.push(songCoverPath_high)

      this.db.delete('artist_bridge', { song: song_id })
      this.db.delete('album_bridge', { song: song_id })
      this.db.delete('genre_bridge', { song: song_id })
      this.db.delete('playlist_bridge', { song: song_id })

      this.db.delete('allsongs', { _id: song_id })
    }

    await this.cleanDb()

    for (const path of pathsToRemove) {
      await this.removeFile(path)
    }

    this.updateAllSongCounts()

    this.notifyExtensionHostSongChanged(false, songs)
  }

  private async updateSongArtists(newArtists: Artists[], oldArtists: Artists[] | undefined, songID: string) {
    if (JSON.stringify(oldArtists) !== JSON.stringify(newArtists)) {
      this.db.delete('artist_bridge', { song: songID })

      for (const a of oldArtists ?? []) {
        if (!newArtists.find((val) => val.artist_name === a.artist_name)) {
          const songCount = await this.db.queryFirstCell<number>(
            'SELECT COUNT(id) FROM artist_bridge WHERE artist = ?',
            a.artist_id
          )
          if (songCount === 0) {
            this.db.delete('artists', { artist_id: a.artist_id })
            if (a.artist_coverPath) {
              this.removeFile(a.artist_coverPath)
            }
          }
        }
      }

      const artistIDs = await this.storeArtists(...newArtists)
      this.storeArtistBridge(artistIDs, songID)
    }
  }

  private async updateSongGenre(newGenres: string[], oldGenres: string[] | undefined, songID: string) {
    if (JSON.stringify(newGenres) !== JSON.stringify(oldGenres)) {
      this.db.delete('genre_bridge', { song: songID })

      for (const g of oldGenres ?? []) {
        if (!newGenres.includes(g)) {
          const songCount = await this.db.queryFirstCell<number>(
            'SELECT COUNT(id) FROM genre_bridge WHERE genre = ?',
            g
          )
          if (songCount === 0) {
            this.db.delete('genres', { genre_id: g })
          }
        }
      }

      const genreIDs = await this.storeGenre(...newGenres)
      this.storeGenreBridge(genreIDs, songID)
    }
  }

  private async updateSongAlbums(newAlbum: Album, oldAlbum: Album | undefined, songID: string) {
    this.db.delete('album_bridge', { song: songID })

    if (JSON.stringify(newAlbum) !== JSON.stringify(oldAlbum)) {
      if (oldAlbum?.album_id) {
        const songCount = await this.db.queryFirstCell<number>(
          'SELECT COUNT(id) FROM album_bridge WHERE album = ?',
          oldAlbum.album_id
        )
        if (songCount === 0) {
          this.db.delete('albums', { album_id: oldAlbum.album_id })
          if (oldAlbum.album_coverPath_high) this.removeFile(oldAlbum.album_coverPath_high)
          if (oldAlbum.album_coverPath_low) this.removeFile(oldAlbum.album_coverPath_low)
        }
      }

      const albumIDs = await this.storeAlbum(newAlbum)
      this.storeAlbumBridge(albumIDs, songID)
    }
  }

  private async getCoverPath(oldCoverPath: string, newCoverpath: string) {
    const thumbPath = loadPreferences().thumbnailPath
    try {
      await access(thumbPath)
    } catch (e) {
      await mkdir(thumbPath, { recursive: true })
    }

    if (oldCoverPath !== newCoverpath) {
      if (newCoverpath) {
        const finalPath = path.join(thumbPath, v4() + (path.extname(newCoverpath) ?? '.png'))

        if (newCoverpath.startsWith('http')) {
          try {
            await downloadFile(newCoverpath, finalPath)
            return finalPath
          } catch (e) {
            console.error('Failed to download from url', newCoverpath, e)
            return oldCoverPath
          }
        }

        if (path.dirname(newCoverpath) !== path.dirname(finalPath)) {
          await fsP.copyFile(newCoverpath, finalPath)
          return finalPath
        }

        return newCoverpath
      }
    }
    return oldCoverPath
  }

  public async updateSong(song: Song, skipChecks = false) {
    if (this.verifySong(song)) {
      const oldSong = (await this.getSongByOptions({ song: { _id: song._id } }))[0]

      if (oldSong) {
        this.updateSongArtists(song.artists ?? [], oldSong.artists, song._id)
        this.updateSongAlbums(song.album ?? {}, oldSong.album, song._id)
        this.updateSongGenre(song.genre ?? [], oldSong.genre, song._id)

        const marshalled = this.marshalSong(song)

        if (!skipChecks) {
          const finalCoverPathHigh = await this.getCoverPath(
            oldSong.song_coverPath_high ?? '',
            song.song_coverPath_high ?? ''
          )

          if (song.song_coverPath_low && song.song_coverPath_low !== song.song_coverPath_high) {
            const finalCoverPathLow = await this.getCoverPath(
              oldSong.song_coverPath_low ?? '',
              song.song_coverPath_low ?? ''
            )

            marshalled.song_coverPath_high = finalCoverPathHigh
            marshalled.song_coverPath_low = finalCoverPathLow
          }
        }

        await this.db.updateWithBlackList('allsongs', marshalled, ['_id = ?', song._id], ['_id'])
        this.updateAllSongCounts()
        return
      }

      console.warn('Song with id', song._id, 'does not exist in db')
    }
  }

  /**
   * Search every entity for matching keyword
   * @param term term to search
   * @param exclude path to exclude from search
   * @returns SearchResult consisting of songs, albums, artists, genre
   */
  public async searchAll(term: string, exclude?: string[]): Promise<SearchResult> {
    const songs = await this.getSongByOptions(
      {
        song: {
          title: term,
          path: term
        }
      },
      exclude
    )

    const albums = await this.getEntityByOptions<Album>({
      album: {
        album_name: term
      }
    })

    const artists = await this.getEntityByOptions<Artists>({
      artist: {
        artist_name: term
      }
    })

    const genres = await this.getEntityByOptions<Genre>({
      genre: {
        genre_name: term
      }
    })

    const playlists = await this.getEntityByOptions<Playlist>({
      playlist: {
        playlist_name: term
      }
    })

    return { songs, albums, artists, genres, playlists }
  }

  private getInnerKey(property: keyof SearchableSong): keyof marshaledSong {
    if (property === 'extension') return 'provider_extension'
    if (property === 'showInLibrary') return 'show_in_library'
    return property
  }

  private getLikeQuery(invert?: boolean) {
    return invert ? 'NOT LIKE' : 'LIKE'
  }

  private populateWhereQuery(options?: SongAPIOptions) {
    if (options) {
      let where = 'WHERE '
      const args: string[] = []
      let isFirst = true

      const addANDorOR = () => {
        const str = !isFirst ? (options.inclusive ? 'AND' : 'OR') : ''
        isFirst = false
        return str
      }

      for (const key of Object.keys(options)) {
        if (key !== 'inclusive' && key !== 'sortBy') {
          const tableName = this.getTableByProperty(key as keyof SongAPIOptions)
          const data = options[key as keyof SongAPIOptions]
          if (data) {
            for (const [innerKey, innerValue] of Object.entries(data)) {
              let parsedValue = innerValue
              if (typeof innerValue === 'boolean') parsedValue = innerValue ? 1 : 0

              where += `${addANDorOR()} ${tableName}.${this.getInnerKey(
                innerKey as keyof SearchableSong
              )} ${this.getLikeQuery(options.invert)} ?`
              args.push(`${parsedValue}`)
            }
          }
        }
      }

      if (args.length === 0) {
        return { where: '', args: [] }
      }

      return { where, args }
    }
    return { where: '', args: [] }
  }

  private getSortByTable(sortBy: SongSortOptions) {
    switch (sortBy.type) {
      case 'playCount':
        return 'analytics'
      case 'album':
        return 'albums'
      case 'artist':
        return 'artists'
      case 'genre':
        return 'genres'
      default:
        return 'allsongs'
    }
  }

  private getSortByColumn(sortBy: SongSortOptions) {
    switch (sortBy.type) {
      case 'playCount':
        return 'play_count'
      case 'album':
        return 'album_name'
      case 'artist':
        return 'artist_name'
      case 'genre':
        return 'genre_name'
      default:
        return sortBy.type
    }
  }

  private addOrderClause(sortBy?: SongSortOptions[], noCase = false) {
    if (sortBy) {
      let ret = 'ORDER BY '
      sortBy.forEach((s, index) => {
        ret += `${this.getSortByTable(s)}.${this.getSortByColumn(s)} ${noCase ? 'COLLATE NOCASE' : ''} ${
          s.asc ? 'ASC' : 'DESC'
        } ${index !== sortBy.length - 1 ? ',' : ''}`
      })

      return ret
    }
    return ''
  }

  private normalizeSortBy(sortBy: SongAPIOptions['sortBy']) {
    if (sortBy) {
      if (Array.isArray(sortBy)) return sortBy
      else return [sortBy]
    }
  }

  /**
   * Gets song by options
   * @param [options] SongAPIOptions to search by
   * @param [exclude] paths to exclude from result
   * @returns list of songs matching the query
   */
  public async getSongByOptions(options?: SongAPIOptions, exclude?: string[]): Promise<Song[]> {
    const { where, args } = this.populateWhereQuery(options)

    const songs: marshaledSong[] = await this.db.query(
      `SELECT ${this.getSelectClause()}, ${this.addGroupConcatClause()} FROM allsongs
      ${this.addLeftJoinClause(undefined, 'allsongs')}
        ${where}
        ${this.addExcludeWhereClause(args.length === 0, exclude)} GROUP BY allsongs._id ${this.addOrderClause(
        this.normalizeSortBy(options?.sortBy),
        args.length > 0
      )}`,
      ...args
    )

    return this.batchUnmarshal(songs, (artistIds) => {
      return Promise.all<Artists>(
        [...new Set(artistIds)].map(
          async (val) =>
            (
              await this.getEntityByOptions<Artists>({
                artist: {
                  artist_id: val
                }
              })
            )[0]
        )
      )
    })
  }

  private getTableByProperty(key: string) {
    switch (key) {
      case 'song':
        return 'allsongs'
      case 'album':
        return 'albums'
      case 'artist':
        return 'artists'
      case 'genre':
        return 'genres'
      case 'playlist':
        return 'playlists'
    }
  }

  private getTitleColByProperty(key: string) {
    switch (key) {
      case 'song':
        return 'title'
      case 'album':
        return 'album_name'
      case 'artist':
        return 'artist_name'
      case 'genre':
        return 'genre_name'
      case 'playlist':
        return 'playlist_name'
    }
  }

  /**
   * Get album, genre, playlist, artists by options
   * @param options EntityApiOptions to search by
   * @returns
   */
  public async getEntityByOptions<T extends Artists | Album | Genre | Playlist>(
    options: EntityApiOptions<T>
  ): Promise<T[]> {
    let isFirst = true
    const addANDorOR = () => {
      const str = !isFirst ? (options.inclusive ? 'AND' : 'OR') : ''
      isFirst = false
      return str
    }

    let query = `SELECT * FROM `
    let where = `WHERE `
    const args: string[] = []
    let orderBy
    for (const [key, value] of Object.entries(options)) {
      const tableName = this.getTableByProperty(key as EntityKeys<T>)
      if (tableName) {
        query += `${tableName} `
        orderBy = `${tableName}.${this.getTitleColByProperty(key as EntityKeys<T>)}`

        if (typeof value === 'boolean' && value === true) {
          break
        }

        if (typeof value === 'object') {
          const data: Record<string, string> = options[key as never]
          if (data) {
            for (const [innerKey, innerValue] of Object.entries(data)) {
              if (innerKey && innerValue) {
                where += `${addANDorOR()} ${innerKey} ${this.getLikeQuery(options.invert)} ?`
                args.push(innerValue)
              }
            }
            break
          }
        }
      }
    }

    let ret =
      (await this.db.query<T>(
        `${query} ${args.length > 0 ? where : ''} ORDER BY ${orderBy} ASC`,
        ...args.map((val) => val.replaceAll(' ', '%'))
      )) ?? []
    if ('artist' in options) {
      ret = ret.map((val) => {
        if ('artist_extra_info' in val && typeof val.artist_extra_info === 'string') {
          return {
            ...val,
            artist_extra_info: JSON.parse(val.artist_extra_info)
          }
        }
        return val
      })
    }

    return ret
  }

  /**
   * Get song matching the md5 hash
   * @param hash md5 hash
   * @returns Song
   */
  public getByHash(hash: string) {
    return this.getSongByOptions({
      song: {
        hash
      }
    })
  }

  /**
   * Update cover image of song by id
   * @param id id of song to update cover image
   * @param coverHigh high resolution cove image path
   * @param coverLow low resolution cove image path
   */
  public async updateSongCover(id: string, coverHigh: string, coverLow?: string) {
    await this.db.update(
      'allsongs',
      {
        song_coverPath_high: coverHigh,
        song_coverPath_low: coverLow
      },
      ['_id = ?', id]
    )
  }

  public async updateSongLyrics(id: string, lyrics: string) {
    await this.db.update(
      'allsongs',
      {
        lyrics
      },
      ['_id = ?', id]
    )
  }

  public async getAllPaths(): Promise<string[]> {
    return this.db.queryColumn('path', `SELECT path from allsongs`)
  }

  /* ============================= 
                ALBUMS
     ============================= */

  private async storeAlbum(album: Album): Promise<string> {
    let id: string | undefined
    if (album.album_name) {
      id = await this.db.queryFirstCell(
        `SELECT album_id FROM albums WHERE album_name = ? COLLATE NOCASE`,
        album.album_name.trim()
      )
      if (!id) {
        id = v4()
        await this.db.run(
          `INSERT INTO albums (album_id, album_name, album_coverPath_low, album_coverPath_high, album_artist) VALUES(?, ?, ?, ?, ?)`,
          id,
          album.album_name.trim(),
          album.album_coverPath_low,
          album.album_coverPath_high,
          album.album_artist
        )
      }
    }
    return id as string
  }

  /**
   * Updates album covers by song_id
   * @param songid id of the song belonging to the album whose cover is to be updated
   * @param coverHigh high resolution cover path
   * @param coverLow low resolution cover path
   */
  public async updateAlbumCovers(songid: string, coverHigh: string, coverLow?: string) {
    const { album_id } = (await this.db.queryFirstRowObject(
      `SELECT album as album_id FROM album_bridge WHERE song = ?`,
      songid
    )) as { album_id: string }
    if (album_id) {
      this.db.update('albums', { album_coverPath_high: coverHigh, album_coverPath_low: coverLow }, [
        'album_id = ?',
        album_id
      ])
    }
  }

  public async updateAlbum(album: Album) {
    if (album.album_id) {
      const oldAlbum = (
        await this.getEntityByOptions<Album>({
          album: {
            album_id: album.album_id
          }
        })
      )[0]

      const coverPath = await this.getCoverPath(oldAlbum?.album_coverPath_high ?? '', album.album_coverPath_high ?? '')
      album.album_coverPath_high = coverPath
      album.album_coverPath_low = coverPath

      if (coverPath && oldAlbum?.album_coverPath_high !== coverPath) {
        if (oldAlbum?.album_coverPath_high) {
          await this.removeFile(oldAlbum.album_coverPath_high)
        }

        if (oldAlbum?.album_coverPath_low) {
          await this.removeFile(oldAlbum.album_coverPath_low)
        }
      }

      this.db.updateWithBlackList('albums', album, ['album_id = ?', album.album_id], ['album_id', 'album_extra_info'])

      this.updateAlbumExtraInfo(album.album_id, album.album_extra_info)
    }
  }

  public async updateAlbumExtraInfo(id: string, info: Album['album_extra_info'], extension?: string) {
    let toUpdateInfo: Album['album_extra_info'] = JSON.parse(
      (await this.db.queryFirstCell<string>('SELECT album_extra_info from albums WHERE album_id = ?', id)) ?? '{}'
    )

    if (!toUpdateInfo || Object.keys(toUpdateInfo).length === 0) {
      toUpdateInfo = {
        extensions: {}
      }
    }

    if (extension) {
      if (toUpdateInfo.extensions && info) {
        toUpdateInfo['extensions'][extension] = info as Record<string, string>
      }
    } else {
      toUpdateInfo = { ...toUpdateInfo, ...info }
    }

    this.db.update('albums', { album_extra_info: JSON.stringify(toUpdateInfo) }, ['album_id = ?', id])
  }

  /**
   * Updates song count of all albums
   */
  public async updateSongCountAlbum() {
    for (const row of await this.db.query(`SELECT album_id FROM albums`)) {
      this.db.run(
        `UPDATE albums SET album_song_count = (SELECT count(id) FROM album_bridge WHERE album = ?) WHERE album_id = ?`,
        (row as Album).album_id,
        (row as Album).album_id
      )
    }
  }

  private async storeAlbumBridge(albumID: string, songID: string) {
    if (albumID) {
      const exists: number = await this.db.queryFirstCell(
        `SELECT COUNT(id) FROM album_bridge WHERE album = ? AND song = ?`,
        albumID,
        songID
      )
      if (exists === 0) {
        this.db.insert('album_bridge', { song: songID, album: albumID })
      }
    }
  }

  /* ============================= 
                GENRE
     ============================= */

  /**
   * Updates song count of all genres
   */
  public async updateSongCountGenre() {
    for (const row of await this.db.query(`SELECT genre_id FROM genres`)) {
      this.db.run(
        `UPDATE genres SET genre_song_count = (SELECT count(id) FROM genre_bridge WHERE genre = ?) WHERE genre_id = ?`,
        (row as Genre).genre_id,
        (row as Genre).genre_id
      )
    }
  }

  private async storeGenre(...genre: string[]) {
    const genreID: string[] = []
    if (genre) {
      for (const a of genre) {
        if (a) {
          const id: string = await this.db.queryFirstCell(
            `SELECT genre_id FROM genres WHERE genre_name = ? COLLATE NOCASE`,
            a
          )
          if (id) genreID.push(id)
          else {
            const id = v4()
            this.db.insert('genres', { genre_id: id, genre_name: a.trim() })
            genreID.push(id)
          }
        }
      }
    }
    return genreID
  }

  private async storeGenreBridge(genreID: string[], songID: string) {
    for (const i of genreID) {
      const exists = await this.db.queryFirstCell(
        `SELECT COUNT(id) FROM genre_bridge WHERE genre = ? AND song = ?`,
        i,
        songID
      )
      if (exists === 0) {
        this.db.insert('genre_bridge', { song: songID, genre: i })
      }
    }
  }

  /* ============================= 
                ARTISTS
     ============================= */

  /**
   * Updates artists details
   * artist_id and artist_name are not updated
   * artist is queried by artist_id
   * @param artist artist with updated details.
   *
   * @returns number of rows updated
   */
  public async updateArtists(artist: Artists) {
    if (artist) {
      const oldArtist = (
        await this.getEntityByOptions<Artists>({
          artist: {
            artist_id: artist.artist_id
          }
        })
      )[0]

      if (oldArtist) {
        const coverPath = await this.getCoverPath(oldArtist.artist_coverPath ?? '', artist.artist_coverPath ?? '')
        artist.artist_coverPath = coverPath

        this.db.updateWithBlackList(
          'artists',
          artist,
          ['artist_id = ?', artist.artist_id],
          ['artist_id', 'artist_extra_info']
        )

        if (oldArtist?.artist_coverPath) {
          await this.removeFile(oldArtist.artist_coverPath)
        }

        this.updateArtistExtraInfo(artist.artist_id, artist.artist_extra_info)
      }
    }
  }

  private async storeArtists(...artists: Artists[]): Promise<string[]> {
    const artistID: string[] = []
    for (const a of artists) {
      if (a.artist_name) {
        const sanitizedName = sanitizeArtistName(a.artist_name)

        let id: string = await this.db.queryFirstCell(
          `SELECT artist_id FROM artists WHERE sanitized_artist_name = ? OR artist_name = ? COLLATE NOCASE`,
          sanitizedName,
          sanitizedName
        )
        if (id) {
          artistID.push(id)
          const existingArtist = await this.db.queryFirstRow<Artists>(
            `SELECT * FROM artists WHERE artist_id = ? COLLATE NOCASE`,
            id
          )

          if (existingArtist) {
            if (a.artist_mbid) {
              if (!existingArtist.artist_mbid) {
                this.db.update('artists', a.artist_mbid, ['artist_id = ?', id])
              }

              if (!existingArtist.artist_coverPath && a.artist_coverPath) {
                this.db.update('artists', a.artist_coverPath, ['artist_id = ?', id])
              }
            }
          }
        } else {
          id = v4()
          this.db.insert('artists', { artist_id: id, artist_name: a.artist_name, sanitized_artist_name: sanitizedName })
          artistID.push(id)
        }

        await this.updateArtistExtraInfo(id, a.artist_extra_info ?? {})
      }
    }
    return artistID
  }

  public async updateArtistExtraInfo(id: string, info: Artists['artist_extra_info'], extension?: string) {
    let toUpdateInfo: Artists['artist_extra_info'] = JSON.parse(
      (await this.db.queryFirstCell<string>('SELECT artist_extra_info from artists WHERE artist_id = ?', id)) ?? '{}'
    )

    if (!toUpdateInfo || Object.keys(toUpdateInfo).length === 0) {
      toUpdateInfo = {
        youtube: {
          channel_id: ''
        },
        spotify: {
          artist_id: ''
        },
        extensions: {}
      }
    }

    if (extension) {
      if (toUpdateInfo.extensions && info) {
        toUpdateInfo['extensions'][extension] = info as Record<string, string>
      }
    } else {
      toUpdateInfo = { ...toUpdateInfo, ...info }
    }

    this.db.update('artists', { artist_extra_info: JSON.stringify(toUpdateInfo) }, ['artist_id = ?', id])
  }

  private async storeArtistBridge(artistID: string[], songID: string) {
    for (const i of artistID) {
      const exists = await this.db.queryFirstCell(
        `SELECT COUNT(id) FROM artist_bridge WHERE artist = ? AND song = ?`,
        i,
        songID
      )
      if (exists === 0) {
        this.db.insert('artist_bridge', { song: songID, artist: i })
      }
    }
  }

  /**
   * Gets default cover for artist
   * Queries the albums belonging to songs by the artist for cover image
   * @param id of artist whose default cover image is required
   * @returns high resolution cover image for artist
   */
  public async getDefaultCoverByArtist(id: string) {
    const artist_cover = this.db.queryFirstCell(`SELECT artist_coverPath from artists WHERE artist_id = ?`, id)
    if (artist_cover) {
      return artist_cover
    }

    const album_cover: marshaledSong = await this.db.queryFirstCell(
      `SELECT album_coverPath_high from albums WHERE album_id = (SELECT album FROM album_bridge WHERE song = (SELECT song FROM artist_bridge WHERE artist = ?))`,
      id
    )

    if (album_cover) {
      return album_cover
    }

    const song_cover = this.db.queryFirstCell(
      `SELECT song_coverPath_high from allsongs WHERE _id = (SELECT song FROM artist_bridge WHERE artist = ?)`,
      id
    )

    return song_cover
  }

  /**
   * Updates song count of all genres
   */
  public async updateSongCountArtists() {
    for (const row of await this.db.query(`SELECT artist_id FROM artists`)) {
      this.db.run(
        `UPDATE artists SET artist_song_count = (SELECT count(id) FROM artist_bridge WHERE artist = ?) WHERE artist_id = ?`,
        (row as Artists).artist_id,
        (row as Artists).artist_id
      )
    }
  }

  /* ============================= 
                PLAYLISTS
     ============================= */

  private notifyExtensionHostPlaylistChanged(added: boolean, playlist: Playlist[]) {
    if (playlist.length > 0) {
      getExtensionHostChannel().sendExtraEvent({
        type: added ? 'playlistAdded' : 'playlistRemoved',
        data: [playlist]
      })
    }
  }

  /**
   * Creates playlist
   * @param name name of playlist
   * @param desc description of playlist
   * @param imgSrc cover image of playlist
   * @returns playlist id after creation
   */
  public async createPlaylist(playlist: Partial<Playlist>): Promise<string> {
    const id = playlist.playlist_id ?? v4()

    const playlistToInsert: Playlist = {
      playlist_name: playlist.playlist_name ?? 'New Playlist',
      playlist_desc: playlist.playlist_desc,
      playlist_id: id,
      playlist_song_count: playlist.playlist_song_count ?? 0,
      playlist_path: playlist.playlist_path,
      playlist_coverPath: playlist.playlist_coverPath,
      extension: playlist.extension,
      icon: playlist.icon
    }

    if (playlist.playlist_path) {
      const id: string = await this.db.queryFirstCell(
        `SELECT playlist_id FROM playlists WHERE playlist_path = ?`,
        playlist.playlist_path
      )
      if (id) return id
    }

    await this.db.insert('playlists', playlistToInsert)

    this.notifyExtensionHostPlaylistChanged(true, [playlistToInsert])
    return id
  }

  public async getPlaylistByPath(filePath: string): Promise<Playlist[]> {
    return this.getEntityByOptions({
      playlist: {
        playlist_path: filePath
      }
    })
  }

  public async updatePlaylist(playlist: Partial<Playlist>) {
    const oldPlaylist = (
      await this.getEntityByOptions<Playlist>({ playlist: { playlist_id: playlist.playlist_id } })
    )[0]

    const coverPath = await this.getCoverPath(oldPlaylist.playlist_coverPath ?? '', playlist.playlist_coverPath ?? '')
    playlist.playlist_coverPath = coverPath

    this.db.updateWithBlackList('playlists', playlist, ['playlist_id = ?', playlist.playlist_id], ['playlist_id'])

    if (oldPlaylist?.playlist_coverPath) {
      await this.removeFile(oldPlaylist.playlist_coverPath)
    }
  }

  /**
   * Updates playlist cover path
   * @param playlist_id id of playlist whose cover is to be updated
   * @param coverPath hig resolution cover path
   */
  public updatePlaylistCoverPath(playlist_id: string, coverPath: string) {
    this.db.update('playlists', { playlist_coverPath: coverPath }, ['playlist_id = ?', playlist_id])
  }

  private async isPlaylistCoverExists(playlist_id: string) {
    return !!(
      (
        await this.db.query(`SELECT playlist_coverPath FROM playlists WHERE playlist_id = ?`, playlist_id)
      )[0] as Playlist
    )?.playlist_coverPath
  }

  /**
   * Adds songs to playlist
   * @param playlist_id id of playlist where songs are to be added
   * @param songs songs which are to be added to playlist
   */
  public async addToPlaylist(playlist_id: string, ...songs: Song[]) {
    // TODO: Regenerate cover instead of using existing from song
    let coverExists = await this.isPlaylistCoverExists(playlist_id)

    const stored = await this.store(...songs.map((val) => ({ ...val, showInLibrary: false })))

    for (const s of stored) {
      if (!coverExists && playlist_id !== 'favorites_playlist') {
        if (s.album?.album_coverPath_high) {
          this.updatePlaylistCoverPath(playlist_id, s.album.album_coverPath_high)
          coverExists = true
        }
      }
      this.db.insert('playlist_bridge', { playlist: playlist_id, song: s._id })
    }
    this.updateSongCountPlaylists()
  }

  /**
   * Removes song from playlist
   * @param playlist id of playlist from which song is to be removed
   * @param songs songs which are to be removed
   */
  public async removeFromPlaylist(playlist: string, ...songs: Song[]) {
    for (const s of songs.map((val) => val._id)) {
      await this.db.delete('playlist_bridge', { playlist: playlist, song: s })
    }
    this.updateSongCountPlaylists()
  }

  /**
   * Updates song count of all playlists
   */
  public async updateSongCountPlaylists() {
    for (const row of await this.db.query(`SELECT playlist_id FROM playlists`)) {
      await this.db.run(
        `UPDATE playlists SET playlist_song_count = (SELECT count(id) FROM playlist_bridge WHERE playlist = ?) WHERE playlist_id = ?`,
        (row as Playlist).playlist_id,
        (row as Playlist).playlist_id
      )
    }
  }

  /**
   * Removes playlist
   * @param playlists playlists to be removed
   */
  public async removePlaylist(...playlists: Playlist[]) {
    for (const playlist of playlists) {
      const playlist_id = playlist.playlist_id
      await this.db.delete('playlist_bridge', { playlist: playlist_id })
      await this.db.delete('playlists', { playlist_id: playlist_id })
    }

    this.notifyExtensionHostPlaylistChanged(false, playlists)
  }

  private async removeFile(src: string) {
    if (!this.isCoverInUseAfterRemoval(src)) {
      await fsP.rm(src, { force: true })
    }
  }

  private async isCoverInUseAfterRemoval(coverPath: string) {
    const tableMap = [
      { table: 'allsongs', columns: ['song_coverPath_high', 'song_coverPath_low'] },
      { table: 'artists', columns: ['artist_coverPath'] },
      { table: 'albums', columns: ['album_coverPath_high', 'album_coverPath_low'] },
      { table: 'playlists', columns: ['playlist_coverPath'] }
    ]

    for (const val of tableMap) {
      const argMap: string[] = Array(val.columns.length).fill(coverPath)
      const c = await this.db.queryFirstCell<number>(
        `SELECT count(*) FROM ${val.table} WHERE ${val.columns.map((val) => `${val} = ?`).join(' OR ')}`,
        ...argMap
      )

      if (c && c > 0) {
        console.debug('Got cover', coverPath, 'usage in', val.table, c, 'times')
        return true
      }
    }

    return false
  }

  /* ============================= 
                Analytics
     ============================= */

  public async incrementPlayCount(song_id: string) {
    let playCount = await this.db.queryFirstCell<number>(`SELECT play_count FROM analytics WHERE song_id = ?`, song_id)
    if (isEmpty(playCount)) {
      await this.db.insert('analytics', { id: v4(), song_id, play_count: 0, play_time: 0 })
      playCount = 0
    }

    this.db.update('analytics', { play_count: playCount + 1 }, { song_id })
  }

  public async getPlayCount(...song_id: string[]) {
    let res: { song_id: string; play_count: number; play_time: number }[] = []

    if (song_id.length > 0) {
      const where = song_id.map((val) => `'${val}'`).join(', ')
      res = await this.db.query(`SELECT song_id, play_count, play_time FROM analytics WHERE song_id in (${where})`)
    } else {
      res = await this.db.query(`SELECT song_id, play_count, play_time FROM analytics`)
    }
    return Object.assign(
      {},
      ...res.map((val) => ({ [val.song_id]: { playCount: val.play_count, playTime: val.play_time } }))
    )
  }

  public async incrementPlayTime(song_id: string, duration: number) {
    let playTime = await this.db.queryFirstCell<number>(`SELECT play_time FROM analytics WHERE song_id = ?`, song_id)
    if (isEmpty(playTime)) {
      await this.db.insert('analytics', { id: v4(), song_id, play_count: 0, play_time: duration })
      playTime = 0
    }

    this.db.update('analytics', { play_time: playTime + duration }, { song_id })
  }

  /* ============================= 
                Destructive
     ============================= */

  public async cleanDb() {
    const tables = ['album', 'artist', 'genre']
    const pathsToRemove: (string | undefined)[] = []

    for (const table of tables) {
      const data: (Album | Artists | Genre)[] = await this.db.query(
        `SELECT * from ${table}s as t1 LEFT JOIN ${table}_bridge t2 ON t1.${table}_id = t2.${table} WHERE t2.${table} IS NULL`
      )

      for (const d of data) {
        if (isAlbum(d)) {
          pathsToRemove.push(d.album_coverPath_high, d.album_coverPath_low)
        }

        if (isArtist(d)) {
          pathsToRemove.push(d.artist_coverPath)
        }

        this.db.delete(`${table}s`, {
          [`${table}_id`]: (d as Record<string, string>)[`${table}_id`]
        })
      }
    }

    const promises: Promise<void>[] = []
    for (const p of pathsToRemove) {
      if (p) promises.push(this.removeFile(p))
    }

    await Promise.all(promises)
  }
}
