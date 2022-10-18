import { ProviderScopes } from '@/utils/commonConstants'
import { cache, GenericProvider } from './generics/genericProvider'
import axios from 'axios'
import qs from 'qs'
import { vxm } from '@/mainWindow/store'

enum PipedResources {
  SEARCH = 'search',
  PLAYLIST_DETAILS = 'playlists/${playlist_id}',
  PLAYLIST_DETAILS_NEXT = 'nextpage/playlists/${playlist_id}',
  CHANNEL_DETAILS = 'channel/${channel_id}',
  CHANNEL_DETAILS_NEXT = 'nextpage/channel/${channel_id}',
  STREAM_DETAILS = 'streams/${video_id}'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class PipedProvider extends GenericProvider {
  key = 'piped'

  private api = axios.create({
    adapter: cache.adapter,
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat', encode: false })
  })

  public async getLoggedIn(): Promise<boolean> {
    vxm.providers.loggedInYoutube = true
    return true
  }

  public async login(): Promise<boolean> {
    return true
  }

  public async signOut(): Promise<void> {
    return
  }

  public async updateConfig(): Promise<boolean> {
    return true
  }

  public async getUserDetails(): Promise<string | undefined> {
    return 'Anonymous'
  }

  public matchEntityId(id: string): boolean {
    return (
      id.startsWith('youtube:') ||
      id.startsWith('youtube-playlist:') ||
      id.startsWith('youtube-author:') ||
      id.startsWith('youtube-album:')
    )
  }

  public sanitizeId(id: string, type: 'SONG' | 'PLAYLIST' | 'ALBUM' | 'ARTIST'): string {
    switch (type) {
      case 'SONG':
        return id.replace('youtube:', '')
      case 'PLAYLIST':
        return id.replace('youtube-playlist:', '')
      case 'ALBUM':
        return id
      case 'ARTIST':
        return id.replace('youtube-author:', '')
    }
  }

  public provides(): ProviderScopes[] {
    return [
      ProviderScopes.SEARCH,
      ProviderScopes.PLAYLIST_FROM_URL,
      ProviderScopes.SONG_FROM_URL,
      ProviderScopes.PLAYLIST_SONGS,
      ProviderScopes.ARTIST_SONGS,
      ProviderScopes.ALBUM_SONGS,
      ProviderScopes.SEARCH_ALBUM
    ]
  }

  private async populateRequest<T extends PipedResources, K extends PipedResponses.SearchFilters>(
    resource: T,
    params: PipedResponses.SearchObject<T, K>,
    invalidateCache = false,
    tries = 0
  ): Promise<PipedResponses.ResponseType<T, K> | undefined> {
    let BASE_URL = await window.PreferenceUtils.loadSelective<string>('piped_instance')
    if (!BASE_URL.endsWith('/')) {
      BASE_URL += '/'
    }

    let parsedResource: string = resource

    if (resource.includes('${playlist_id}')) {
      parsedResource = resource.replace('${playlist_id}', (params as PipedResponses.PlaylistDetailsRequest).playlistId)
    }

    if (resource.includes('${channel_id}')) {
      parsedResource = resource.replace('${channel_id}', (params as PipedResponses.ChannelDetailsRequest).channelId)
    }

    if (resource.includes('${video_id}')) {
      parsedResource = resource.replace('${video_id}', (params as PipedResponses.StreamRequest).videoId)
    }

    try {
      const resp = await this.api.get<PipedResponses.ResponseType<T, K>>(`${BASE_URL}${parsedResource}`, {
        params,
        method: 'GET',
        clearCacheEntry: invalidateCache
      })

      return resp.data
    } catch (e) {
      console.error('Error while fetching', `${BASE_URL}${parsedResource}`, e)

      if (tries < 3) {
        await sleep(1000)
        return this.populateRequest(resource, params, invalidateCache, tries + 1)
      }
    }
  }

  private completeUrl(halfUrl: string) {
    let url = halfUrl
    if (!halfUrl.startsWith('http')) {
      url = `https://example.com/${halfUrl}`
    }

    try {
      return new URL(url)
    } catch (e) {
      console.error('Failed to parse URL', url, e)
    }
  }

  private getParam(url: URL | undefined, param: string) {
    return url?.searchParams.get(param) ?? undefined
  }

  private getIdFromURL(url: string) {
    return this.getParam(this.completeUrl(url), 'v')
  }

  private getChannelIdFromUploaderUrl(url: string) {
    return url.replace('/channel/', '')
  }

  private getPlaylistIdFromUrl(url: string) {
    return this.getParam(this.completeUrl(url), 'list')
  }

  private parseSongs(...videos: PipedResponses.VideoDetails[]): Song[] {
    const songList: Song[] = []

    for (const v of videos) {
      if (v.url) {
        songList.push({
          _id: `youtube:${this.getIdFromURL(v.url)}`,
          title: v.title,
          artists: v.uploaderUrl
            ? [
                {
                  artist_id: `youtube-author:${this.getChannelIdFromUploaderUrl(v.uploaderUrl)}`,
                  artist_name: v.uploaderName,
                  artist_coverPath: v.uploaderAvatar,
                  artist_extra_info: {
                    youtube: {
                      channel_id: this.getChannelIdFromUploaderUrl(v.uploaderUrl)
                    }
                  }
                }
              ]
            : [],
          song_coverPath_high: v.thumbnail,
          duration: v.duration,
          playbackUrl: this.getIdFromURL(v.url),
          date_added: Date.now(),
          type: 'YOUTUBE'
        })
      }
    }

    return songList
  }

  public async searchSongs(term: string): Promise<Song[]> {
    const resp = await this.populateRequest(PipedResources.SEARCH, {
      q: term,
      filter: 'music_songs'
    })

    if (resp && resp.items) {
      return this.parseSongs(...resp.items)
    }
    return []
  }

  private parseArtist(...artists: PipedResponses.ChannelDetails[]): Artists[] {
    const artistList: Artists[] = []

    for (const a of artists) {
      artistList.push({
        artist_id: `youtube-author:${this.getChannelIdFromUploaderUrl(a.url)}`,
        artist_name: a.name,
        artist_coverPath: a.thumbnail,
        artist_extra_info: {
          youtube: {
            channel_id: this.getChannelIdFromUploaderUrl(a.url)
          }
        }
      })
    }

    return artistList
  }

  public async searchArtists(term: string): Promise<Artists[]> {
    const resp = await this.populateRequest(PipedResources.SEARCH, {
      q: term,
      filter: 'channels'
    })

    if (resp && resp.items) {
      return this.parseArtist(...resp.items)
    }
    return []
  }

  private parsePlaylists(...playlists: PipedResponses.PlaylistDetails[]): Playlist[] {
    const playlistList: Playlist[] = []

    for (const p of playlists) {
      playlistList.push({
        playlist_id: `youtube-playlist:${this.getPlaylistIdFromUrl(p.url)}`,
        playlist_name: p.name,
        playlist_coverPath: p.thumbnail
      })
    }

    return playlistList
  }

  public async searchPlaylists(term: string): Promise<Playlist[]> {
    const resp = await this.populateRequest(PipedResources.SEARCH, {
      q: term,
      filter: 'playlists'
    })

    if (resp && resp.items) {
      return this.parsePlaylists(...resp.items)
    }
    return []
  }

  private parseAlbums(...albums: PipedResponses.AlbumDetails[]): Album[] {
    const albumList: Album[] = []

    for (const a of albums) {
      albumList.push({
        album_id: `youtube-album:${this.getPlaylistIdFromUrl(a.url)}`,
        album_name: a.name,
        album_coverPath_high: a.thumbnail,
        album_artist: a.uploaderName,
        album_extra_info: {
          youtube: {
            album_id: this.getPlaylistIdFromUrl(a.url)
          }
        }
      })
    }

    return albumList
  }

  public async searchAlbum(term: string): Promise<Album[]> {
    const resp = await this.populateRequest(PipedResources.SEARCH, {
      q: term,
      filter: 'music_albums'
    })

    if (resp && resp.items) {
      return this.parseAlbums(...resp.items)
    }
    return []
  }

  public matchPlaylist(str: string): boolean {
    return !!str.match(
      /^((?:https?:)?\/\/)?((?:www|m|music)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/
    )
  }

  private parseExtendedPlaylist(playlistId: string, playlist: PipedResponses.PlaylistDetailsExtended.Root): Playlist {
    return {
      playlist_id: `youtube-playlist:${playlistId}`,
      playlist_name: playlist.name,
      playlist_coverPath: playlist.thumbnailUrl
    }
  }

  public async getPlaylistDetails(url: string, invalidateCache?: boolean | undefined): Promise<Playlist | undefined> {
    const id = this.getPlaylistIdFromUrl(url)

    if (id) {
      const resp = await this.populateRequest(
        PipedResources.PLAYLIST_DETAILS,
        {
          playlistId: id
        },
        invalidateCache
      )

      if (resp) {
        return this.parseExtendedPlaylist(id, resp)
      }
    }
    return
  }

  public async *getPlaylistContent(
    id: string,
    invalidateCache?: boolean | undefined,
    nextPageToken?: unknown
  ): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    const resp = await this.populateRequest(
      nextPageToken ? PipedResources.PLAYLIST_DETAILS_NEXT : PipedResources.PLAYLIST_DETAILS,
      {
        playlistId: id,
        nextpage: encodeURIComponent(nextPageToken as string)
      },
      invalidateCache
    )

    if (resp) {
      const songs = this.parseSongs(...(resp.relatedStreams ?? []))
      yield { songs: songs, nextPageToken: resp.nextpage }
    }
  }

  public async *getArtistSongs(
    artist: Artists,
    nextPageToken?: unknown
  ): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    let channelId = artist.artist_extra_info?.youtube?.channel_id

    if (!channelId && artist.artist_name) {
      const artists = await this.searchArtists(artist.artist_name)
      channelId = artists[0]?.artist_extra_info?.youtube?.channel_id
    }

    if (channelId) {
      const resp = await this.populateRequest(
        nextPageToken ? PipedResources.CHANNEL_DETAILS_NEXT : PipedResources.CHANNEL_DETAILS,
        {
          channelId,
          nextpage: encodeURIComponent(nextPageToken as string)
        }
      )

      if (resp) {
        const songs = this.parseSongs(...(resp.relatedStreams ?? []))
        yield { songs: songs, nextPageToken: resp.nextpage }
      }
    }
  }

  public async *getAlbumSongs(
    album: Album,
    nextPageToken?: unknown
  ): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    let albumId = album.album_extra_info?.youtube?.album_id

    if (!albumId && album.album_name) {
      const albums = await this.searchAlbum(album.album_name)
      albumId = albums[0].album_extra_info?.youtube?.album_id
    }

    if (albumId) {
      const resp = await this.populateRequest(
        nextPageToken ? PipedResources.PLAYLIST_DETAILS_NEXT : PipedResources.PLAYLIST_DETAILS,
        {
          playlistId: albumId,
          nextpage: encodeURIComponent(nextPageToken as string)
        }
      )

      if (resp) {
        const songs = this.parseSongs(...(resp.relatedStreams ?? []))
        yield { songs: songs, nextPageToken: resp.nextpage }
      }
    }
  }

  private getHighestBitrateAudioStream(streams: PipedResponses.VideoStreamDetails.AudioStream[]) {
    return streams.sort((a, b) => b.bitrate - a.bitrate)[0]
  }

  public async getStreamUrl(videoId: string) {
    if (videoId.startsWith('http')) {
      videoId = this.getIdFromURL(videoId) ?? ''
    }

    if (videoId) {
      const resp = await this.populateRequest(
        PipedResources.STREAM_DETAILS,
        {
          videoId
        },
        true
      )

      if (resp) {
        const stream = this.getHighestBitrateAudioStream(resp.audioStreams)
        return stream.url
      }
    }
  }

  public get Title(): string {
    return 'Piped'
  }

  public get BgColor(): string {
    return '#E62017'
  }

  public get IconComponent(): string {
    return 'PipedIcon'
  }
}
