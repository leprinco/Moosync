/*
 *  search.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { IpcEvents, SearchEvents } from './constants'
import { getDisabledPaths } from '@/utils/main/db/preferences'

import { loadSelectivePreference } from '../db/preferences'
import { InvidiousRequester } from '../fetchers/invidious'
import { LastFMScraper } from '../fetchers/lastfm'
import { LyricsFetcher } from '../fetchers/lyrics'
import { YTScraper } from '../fetchers/searchYT'
import { getSongDB } from '@/utils/main/db'

export class SearchChannel implements IpcChannelInterface {
  name = IpcEvents.SEARCH
  private ytScraper = new YTScraper()
  private lastFmScraper = new LastFMScraper()
  private invidiousRequester = new InvidiousRequester()
  private azLyricsFetcher = new LyricsFetcher()

  handle(event: Electron.IpcMainEvent, request: IpcRequest): void {
    switch (request.type) {
      case SearchEvents.SEARCH_SONGS_BY_OPTIONS:
        this.searchSongByOptions(event, request as IpcRequest<SearchRequests.SongOptions>)
        break
      case SearchEvents.SEARCH_ALL:
        this.searchAll(event, request as IpcRequest<SearchRequests.Search>)
        break
      case SearchEvents.SEARCH_YT:
        this.searchYT(event, request as IpcRequest<SearchRequests.SearchYT>)
        break
      case SearchEvents.YT_SUGGESTIONS:
        this.getYTSuggestions(event, request as IpcRequest<SearchRequests.YTSuggestions>)
        break
      case SearchEvents.GET_YT_PLAYLIST:
        this.getYTPlaylist(event, request as IpcRequest<SearchRequests.YTPlaylist>)
        break
      case SearchEvents.GET_YT_PLAYLIST_CONTENT:
        this.getYTPlaylistContent(event, request as IpcRequest<SearchRequests.YTPlaylistContent>)
        break
      case SearchEvents.GET_YT_AUDIO_URL:
        this.getYTAudioURL(event, request as IpcRequest<SearchRequests.YTSuggestions>)
        break
      case SearchEvents.SEARCH_ENTITY_BY_OPTIONS:
        this.searchEntityByOptions(event, request as IpcRequest<SearchRequests.EntityOptions>)
        break
      case SearchEvents.SCRAPE_LASTFM:
        this.scrapeLastFM(event, request as IpcRequest<SearchRequests.LastFMSuggestions>)
        break
      case SearchEvents.SCRAPE_LYRICS:
        this.scrapeLyrics(event, request as IpcRequest<SearchRequests.LyricsScrape>)
        break
      case SearchEvents.REQUEST_INVIDIOUS:
        this.requestInvidious(event, request as IpcRequest<SearchRequests.InvidiousRequest>)
        break
      case SearchEvents.GET_PLAY_COUNT:
        this.getPlayCount(event, request as IpcRequest<SearchRequests.PlayCount>)
        break
    }
  }

  private async searchAll(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.Search>) {
    if (request.params?.searchTerm) {
      event.reply(request.responseChannel, await getSongDB().searchAll(request.params.searchTerm, getDisabledPaths()))
    }
    event.reply(request.responseChannel)
  }

  private async getYTAudioURL(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.YTSuggestions>) {
    if (request.params.videoID) {
      const data = await this.ytScraper.getWatchURL(request.params.videoID)
      event.reply(request.responseChannel, data)
    }
    event.reply(request.responseChannel)
  }

  private async searchYT(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.SearchYT>) {
    if (request.params?.title) {
      try {
        const youtubeAlt =
          loadSelectivePreference<Checkbox[]>('youtubeAlt', false, [])?.find((val) => val.key === 'use_invidious')
            ?.enabled ?? false

        let data: SearchResult = {
          songs: [],
          artists: [],
          playlists: [],
          albums: [],
          genres: [],
        }
        if (!youtubeAlt) {
          data = await this.ytScraper.searchTerm(
            request.params.title,
            request.params.artists,
            request.params.matchTitle,
            request.params.scrapeYTMusic,
            request.params.scrapeYoutube,
          )
        }
        event.reply(request.responseChannel, data)
      } catch (e) {
        console.error(e)
      }
    }
    event.reply(request.responseChannel)
  }

  private getYTSuggestions(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.YTSuggestions>) {
    if (request.params) {
      this.ytScraper
        .getSuggestions(request.params.videoID ?? '')
        .then((data) => event.reply(request.responseChannel, data))
        .catch((e) => {
          console.error(e)
          event.reply(request.responseChannel, [])
        })
    }
  }

  private async searchSongByOptions(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.SongOptions>) {
    const data = await getSongDB().getSongByOptions(request.params.options, getDisabledPaths())
    event.reply(request.responseChannel, data)
  }

  private async getYTPlaylist(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.YTPlaylist>) {
    if (request.params?.id) {
      const data = await this.ytScraper.parsePlaylistFromID(request.params.id)
      event.reply(request.responseChannel, data)
    }
  }

  private async getYTPlaylistContent(
    event: Electron.IpcMainEvent,
    request: IpcRequest<SearchRequests.YTPlaylistContent>,
  ) {
    if (request.params?.id) {
      const data = await this.ytScraper.getPlaylistContent(request.params.id, request.params.nextPageToken)
      event.reply(request.responseChannel, data)
    }
  }

  private async searchEntityByOptions(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.EntityOptions>) {
    if (request.params?.options) {
      event.reply(request.responseChannel, await getSongDB().getEntityByOptions(request.params.options))
    }
  }

  private async scrapeLastFM(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.LastFMSuggestions>) {
    if (request.params?.url) {
      const resp = await this.lastFmScraper.scrapeURL(request.params.url)
      event.reply(request.responseChannel, resp)
    }
  }

  private async scrapeLyrics(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.LyricsScrape>) {
    if (request.params?.song) {
      const resp = await this.azLyricsFetcher.getLyrics(request.params.song)
      event.reply(request.responseChannel, resp)
    }
  }

  private async requestInvidious(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.InvidiousRequest>) {
    if (request.params.resource && request.params.search) {
      const resp = await this.invidiousRequester.makeInvidiousRequest(
        request.params.resource,
        request.params.search,
        request.params.authorization,
        request.params.invalidateCache,
      )
      event.reply(request.responseChannel, resp)
    }
    event.reply(request.responseChannel)
  }

  private async getPlayCount(event: Electron.IpcMainEvent, request: IpcRequest<SearchRequests.PlayCount>) {
    if (request.params.songIds) {
      const data = await getSongDB().getPlayCount(...request.params.songIds)
      event.reply(request.responseChannel, data)
    }
    event.reply(request.responseChannel)
  }
}
