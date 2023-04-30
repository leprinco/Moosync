/*
 *  scanner.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import * as mm from 'music-metadata'

import { Observable, SubscriptionObserver } from 'observable-fns'
import { expose } from 'threads/worker'
import fs, { promises as fsP } from 'fs'

import path from 'path'
import { v4 } from 'uuid'
import { XMLParser } from 'fast-xml-parser'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { getLogger, levels } from 'loglevel'
import { prefixLogger } from '../logger/utils'
import { access, readdir, readFile } from 'fs/promises'
import crypto from 'crypto'
import { v1 } from 'uuid'

let parser: XMLParser | undefined

const logger = getLogger(`ScanWorker (${v1()})`)
logger.setLevel(process.env.DEBUG_LOGGING ? levels.DEBUG : levels.INFO)

expose({
  scanSingleSong(path: string, splitPattern: string, loggerPath: string) {
    return new Observable((observer) => {
      prefixLogger(loggerPath, logger)
      scan(path, splitPattern, observer)
        .then(() => observer.complete())
        .catch((e) => observer.error(e))
    })
  },

  getCover(path: string, basePath: string, id: string, onlyHigh: boolean, loggerPath: string) {
    return new Observable((observer) => {
      prefixLogger(loggerPath, logger)
      getCover(path, basePath, id, onlyHigh)
        .then((data) => observer.next(data))
        .then(() => observer.complete())
        .catch((e) => observer.error(e))
    })
  },

  getHash(path: string, loggerPath: string) {
    return new Observable((observer) => {
      prefixLogger(loggerPath, logger)
      generateChecksum(path)
        .then((val) => observer.next(val))
        .then(() => observer.complete())
        .catch((e) => observer.error(e))
    })
  },

  scanSinglePlaylist(path: string, splitPattern: string, loggerPath: string) {
    return new Observable((observer) => {
      prefixLogger(loggerPath, logger)
      scanPlaylistByPath(path, splitPattern, observer).then(() => {
        logger.debug('Completed playlist scan')
        observer.complete()
      })
    })
  }
})

async function getCover(filePath: string, basePath: string, id: string, onlyHigh: boolean) {
  const metadata = await mm.parseFile(filePath, {
    duration: false,
    skipCovers: false,
    skipPostHeaders: true
  })

  const cover =
    metadata.common.picture?.[0].data ?? (await findCoverFile(path.dirname(filePath), path.basename(filePath)))

  if (cover) {
    return writeBuffer(cover, basePath, id, onlyHigh)
  }
}

async function scanFile(filePath: string, splitPattern: string): Promise<ScannedSong> {
  const fsStats = await fsP.stat(filePath)
  // const buffer = await getBuffer(filePath)

  const processed = processFile(
    {
      path: filePath,
      inode: fsStats.ino.toString(),
      deviceno: fsStats.dev.toString(),
      size: fsStats.size
    },
    // buffer,
    splitPattern
  )

  return processed
}

async function getBuffer(filePath: string) {
  const buffer = await readFile(filePath)
  return buffer
}

function createXMLParser() {
  if (!parser) {
    parser = new XMLParser({ ignoreAttributes: false })
  }
}

// async function parseWPL(filePath: string) {
//   logger.debug('parsing wpl')
//   const data = parser?.parse(await fsP.readFile(filePath), {})
//   const songs: string[] = []
//   let title = ''

//   if (data['smil']) {
//     if (data['smil']['body'] && data['smil']['body']['seq']) {
//       const media = data['smil']['body']['seq']['media']
//       if (media) {
//         if (Array.isArray(media)) {
//           for (const m of media) {
//             songs.push(m['@_src'])
//           }
//         } else {
//           songs.push(media['@_src'])
//         }
//       }
//     }

//     if (data['smil']['head']) {
//       title = data['smil']['head']['title']
//     }
//   }

//   return { title, songs }
// }

async function processLineByLine(filePath: string, callback: (data: string, index: number) => Promise<boolean>) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  })

  let i = 0
  for await (const line of rl) {
    const res = await callback(line, i)
    i++

    if (!res) {
      break
    }
  }
}

async function parseM3U(filePath: string) {
  logger.debug('Parsing m3u')
  const songs: Song[] = []
  let title = ''

  let prevSongDetails: Partial<Song> = {}

  await processLineByLine(filePath, async (data, index) => {
    logger.debug('Parsing line', index, data)
    if (index === 0) {
      return data === '#EXTM3U'
    }

    if (!data.startsWith('#')) {
      let songPath = ''
      if (data.startsWith('file://')) {
        songPath = path.resolve(filePath, data.startsWith('file') ? fileURLToPath(data) : data)
      } else {
        songPath = data
      }

      if (!prevSongDetails.type) {
        prevSongDetails.type = 'LOCAL'
      }

      if (!prevSongDetails?.title) {
        prevSongDetails.title = path.basename(songPath)
      }

      if (!prevSongDetails.duration) {
        prevSongDetails.duration = 0
      }

      if (prevSongDetails.type !== 'LOCAL') {
        songs.push({
          _id: `${prevSongDetails.type.toLocaleLowerCase()}:${songPath}`,
          ...prevSongDetails,
          type: prevSongDetails.type,
          url: songPath,
          date_added: Date.now()
        } as Song)
      } else {
        songs.push({
          _id: v4(),
          ...prevSongDetails,
          type: prevSongDetails.type,
          date_added: Date.now(),
          path: songPath
        } as Song)
      }

      prevSongDetails = {}
    } else if (data.startsWith('#PLAYLIST')) {
      title = data.replace('#PLAYLIST:', '')
    } else if (data.startsWith('#EXTINF')) {
      const str = data.replace('#EXTINF:', '')
      prevSongDetails = {
        title: str.substring(str.indexOf('-') + 1, str.length).trim(),
        duration: parseInt(str.substring(0, str.indexOf(','))) ?? 0,
        artists: str
          .substring(str.indexOf(',') + 1, str.indexOf('-'))
          .split(';')
          .map((val) => ({
            artist_id: '',
            artist_name: val
          }))
      }
    } else if (data.startsWith('#MOOSINF')) {
      prevSongDetails.type = data.replace('#MOOSINF:', '') as PlayerTypes
    } else if (data.startsWith('#EXTALB')) {
      prevSongDetails.album = {
        album_name: data.replace('#EXTALB:', '')
      }
    } else if (data.startsWith('#EXTGENRE')) {
      prevSongDetails.genre = data.replace('#EXTGENRE:', '').split(',')
    } else if (data.startsWith('#EXTIMG')) {
      prevSongDetails.song_coverPath_high = data.replace('#EXTIMG:', '')
      prevSongDetails.song_coverPath_low = prevSongDetails.song_coverPath_high
    }
    return true
  })
  return { songs, title }
}

async function scanPlaylist(filePath: string) {
  try {
    await fsP.access(filePath)
  } catch (e) {
    logger.error('Failed to access playlist at path', filePath)
    return
  }

  createXMLParser()
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    // case '.wpl':
    // return parseWPL(filePath)
    case '.m3u':
    case '.m3u8':
      return parseM3U(filePath)
  }
}

async function findCoverFile(baseDir: string, fileName: string): Promise<Buffer | undefined> {
  const files = await readdir(baseDir)
  const validFiles = files.filter((val) =>
    val.match(new RegExp(`cover|albumart|album_art|folder|${fileName.replace(path.extname(fileName), '')}`, 'i'))
  )

  for (const f of validFiles) {
    if (path.extname(f).match(/png|jpeg|jpg|bmp|tif/i)) {
      try {
        const fullPath = path.join(baseDir, f)
        await access(fullPath)

        const buffer = await readFile(fullPath)
        logger.debug('Found file', f, 'as valid cover')

        return buffer
      } catch (e) {
        logger.debug('Local cover file', f, 'not found')
      }
    }
  }
}

async function processFile(stats: stats, splitPattern: string): Promise<ScannedSong> {
  const metadata = await mm.parseFile(stats.path, {
    duration: false,
    skipCovers: true,
    skipPostHeaders: true
  })
  const hash = metadata.format.audioMD5?.toString()

  const info = await getInfo(metadata, stats, hash, splitPattern)

  return { song: info }
}

async function getInfo(
  data: mm.IAudioMetadata,
  stats: stats,
  hash: string | undefined,
  splitPattern: string
): Promise<Song> {
  const artists: Artists[] = []
  if (data.common.artists) {
    for (let i = 0; i < data.common.artists.length; i++) {
      let split
      if (splitPattern) {
        split = data.common.artists[i].split(new RegExp(splitPattern))
      } else {
        split = [data.common.artists[i]]
      }
      for (const s of split) {
        artists.push({
          artist_id: '',
          artist_name: s,
          artist_mbid: data.common.musicbrainz_artistid?.at(i) ?? ''
        })
      }
    }
  }

  if (!data.common.lyrics || data.common.lyrics.length === 0) {
    const uslt = data.native['ID3v2.3']?.find((val) => val.id === 'USLT')
    if (uslt) {
      data.common.lyrics = [uslt?.value?.text]
    }
  }

  if (!data.common.lyrics || data.common.lyrics.length === 0) {
    const lrcFile = stats.path.replace(`${path.extname(stats.path)}`, '.lrc')
    logger.debug('Trying to find LRC file at', lrcFile)

    try {
      await access(lrcFile)
      if (lrcFile) {
        const lrcRegex = /\[\d{2}:\d{2}.\d{2}\]/gm
        const lyricsContent = await readFile(lrcFile, { encoding: 'utf-8' })
        let parsedLyrics = ''
        for (const line of lyricsContent.split('\n')) {
          if (line.match(lrcRegex)) {
            parsedLyrics += line.replaceAll(lrcRegex, '') + '\n'
          }
        }

        data.common.lyrics = [parsedLyrics]
      }
    } catch {
      logger.debug('Could not find LRC file')
    }
  }

  return {
    _id: v4(),
    title: data.common.title ? data.common.title : path.basename(stats.path, path.extname(stats.path)),
    path: stats.path,
    size: stats.size,
    album: {
      album_name: data.common.album,
      album_song_count: 0,
      year: data.common.year,
      album_artist: data.common.albumartist
    },
    artists: artists,
    date: data.common.date,
    year: data.common.year,
    genre: data.common.genre,
    lyrics: data.common.lyrics ? data.common.lyrics[0] : undefined,
    releaseType: data.common.releasetype,
    bitrate: data.format.bitrate,
    codec: data.format.codec,
    container: data.format.container,
    duration: data.format.duration || 0,
    sampleRate: data.format.sampleRate,
    hash,
    inode: stats.inode,
    deviceno: stats.deviceno,
    date_added: Date.now(),
    track_no: data.common.track.no ?? undefined,
    type: 'LOCAL'
  }
}

async function scanPlaylistByPath(
  filePath: string,
  splitPattern: string,
  observer: SubscriptionObserver<ScannedSong | ScannedPlaylist | Progress>
) {
  const result = await scanPlaylist(filePath)
  const retSongs: Song[] = []
  if (result?.songs) {
    for (const song of result.songs) {
      try {
        if (song.path) {
          try {
            await fsP.access(song.path)
          } catch (e) {
            logger.error('Failed to access file at', song.path, 'while scanning playlist')
            continue
          }
          const result = await scanFile(song.path, splitPattern)
          retSongs.push(result.song)
        } else if (song.url) {
          retSongs.push(song)
        }
      } catch (e) {
        logger.error(e)
      }
    }
    logger.debug('Sending playlist data to main process')
    observer.next({ title: result.title, filePath, songs: retSongs })
  }
}

async function scan(
  filePath: string,
  splitPattern: string,
  observer: SubscriptionObserver<ScannedSong | ScannedPlaylist | Progress>
) {
  logger.debug('Scanning song', filePath)
  try {
    const result = await scanFile(filePath, splitPattern)
    observer.next({ song: result.song })
  } catch (e) {
    logger.error(e)
  }
  return
}

async function writeBuffer(bufferDesc: Buffer, basePath: string, id?: string, onlyHigh = false) {
  let sharpInstance: typeof import('sharp') | undefined = undefined
  try {
    sharpInstance = (await import('sharp')).default
  } catch (e) {
    console.error(
      'Failed to import sharp. Probably missing libvips-cpp.so or libffi.so.7. Read more at https://moosync.app/wiki/#known-bugs',
      e
    )
  }

  id = id ?? v4()

  const highPath = path.join(basePath, id + '-high.jpg')
  // Write new file only if it doesn't exist
  try {
    await access(highPath)
  } catch {
    if (sharpInstance && typeof sharpInstance === 'function') {
      await sharpInstance(Buffer.from(bufferDesc)).resize(800, 800).toFile(highPath)
    } else {
      await writeNoResize(bufferDesc, highPath)
    }
  }
  let lowPath
  if (!onlyHigh) {
    lowPath = path.join(basePath, id + '-low.jpg')
    try {
      await access(lowPath)
    } catch {
      if (sharpInstance) {
        await sharpInstance(Buffer.from(bufferDesc)).resize(80, 80).toFile(lowPath)
      } else {
        lowPath = highPath
      }
    }
  }

  return { high: highPath, low: lowPath }
}

async function writeNoResize(buffer: Buffer, path: string) {
  await fsP.writeFile(path, buffer)
}

async function generateChecksum(filePath: string): Promise<string> {
  const buffer = await getBuffer(filePath)
  const h = crypto.createHash('md5')
  const hash = h.update(buffer).digest('hex')
  return hash
}
