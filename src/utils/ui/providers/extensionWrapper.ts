import { ProviderScopes } from '@/utils/commonConstants'
import { GenericProvider } from './generics/genericProvider'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'

export class ExtensionProvider extends GenericProvider {
  public key: string

  private loggedInStatus = false
  private _title = ''
  private _icon = ''
  private _bgColor = ''
  private _username?: string
  private _accountId = ''
  private providerScopes: ProviderScopes[] = []

  constructor(packageName: string, scopes: ProviderScopes[]) {
    super()
    this.key = packageName
    this.providerScopes = scopes

    window.ExtensionUtils.getExtensionDisplayName(this.key).then((name) => {
      this._title = name
    })

    window.ExtensionUtils.getRegisteredAccounts(this.key).then((details) => {
      if (details[this.key] && details[this.key][0]) this.setAccountDetails(details[this.key][0])
    })

    window.ExtensionUtils.listenAccountRegistered((details) => {
      this.setAccountDetails(details.data)
    })
  }

  private setAccountDetails(details: StrippedAccountDetails) {
    this._title = details.name
    this.loggedInStatus = details.loggedIn
    this._icon = details.icon
    this._bgColor = details.bgColor
    this._username = details.username
    this._accountId = details.id

    bus.$emit(EventBus.REFRESH_ACCOUNTS, this.key)
  }

  public get canLogin() {
    return !!this._accountId
  }

  public async getLoggedIn(): Promise<boolean> {
    return this.loggedInStatus
  }

  public async login(): Promise<boolean> {
    await window.ExtensionUtils.performAccountLogin(this.key, this._accountId, true)
    return true
  }

  public async signOut(): Promise<void> {
    await window.ExtensionUtils.performAccountLogin(this.key, this._accountId, false)
  }

  public async updateConfig(): Promise<boolean> {
    return !!this._accountId
  }

  public async getUserDetails(): Promise<string | undefined> {
    return this._username
  }

  public matchEntityId(id: string): boolean {
    return id.startsWith(`${this.key}:`)
  }

  public sanitizeId(id: string): string {
    return id.replace(`${this.key}:`, '')
  }

  private async sendExtensionEventRequest<T extends ExtraExtensionEventTypes>(
    type: T,
    data: ExtraExtensionEventData<T>
  ) {
    const resp = await window.ExtensionUtils.sendEvent({
      type,
      data,
      packageName: this.key
    })

    if (resp && resp[this.key]) {
      const fetchedData = resp[this.key]
      return fetchedData
    }
  }

  public async getUserPlaylists(invalidateCache?: boolean | undefined): Promise<ExtendedPlaylist[]> {
    const playlists: ExtendedPlaylist[] = []
    const resp = await this.sendExtensionEventRequest('requestedPlaylists', [invalidateCache ?? false])

    if (resp) {
      const icon = await window.ExtensionUtils.getExtensionIcon(this.key)
      for (const p of resp.playlists) {
        playlists.push({
          ...p,
          icon: (p.icon && 'media://' + p.icon) ?? (icon && 'media://' + icon),
          isRemote: true,
          extension: this.key
        })
      }
    }

    return playlists
  }

  public async *getPlaylistContent(
    id: string,
    invalidateCache?: boolean | undefined
  ): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    const resp = await this.sendExtensionEventRequest('requestedPlaylistSongs', [id, invalidateCache ?? false])

    if (resp) {
      yield { songs: resp.songs }
    }
  }

  public async *getArtistSongs(artist: Artists): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    const resp = await this.sendExtensionEventRequest('requestedArtistSongs', [artist])

    if (resp) {
      yield { songs: resp.songs }
    }
  }

  public async *getAlbumSongs(album: Album): AsyncGenerator<{ songs: Song[]; nextPageToken?: unknown }> {
    const resp = await this.sendExtensionEventRequest('requestedAlbumSongs', [album])

    if (resp) {
      yield { songs: resp.songs }
    }
  }

  public async getPlaylistDetails(url: string, invalidateCache?: boolean | undefined): Promise<Playlist | undefined> {
    const resp = await this.sendExtensionEventRequest('requestedPlaylistFromURL', [url, invalidateCache ?? false])
    return resp?.playlist
  }

  // TODO: Match playlist url to extension
  public matchSongUrl(): boolean {
    return true
  }

  public async getSongDetails(url: string, invalidateCache?: boolean | undefined): Promise<Song | undefined> {
    const resp = await this.sendExtensionEventRequest('requestedSongFromURL', [url, invalidateCache ?? false])
    return resp?.song
  }

  private _lastSearchResult: Record<string, SearchReturnType> = {}

  private setLastSearchResult(term: string, data: SearchReturnType | undefined | void) {
    if (!data) {
      data = {
        songs: [],
        albums: [],
        artists: [],
        playlists: []
      }
    }

    this._lastSearchResult = {
      [term]: data
    }
  }

  private getLastSearchResult(term: string) {
    return this._lastSearchResult[term]
  }

  private async splitSearch<T extends keyof SearchReturnType>(term: string, property: T): Promise<SearchReturnType[T]> {
    const cache = this.getLastSearchResult(term)
    if (cache) {
      return cache[property]
    }

    console.log('sending search request')
    const resp = await this.sendExtensionEventRequest('requestedSearchResult', [term])
    this.setLastSearchResult(term, resp)

    return (resp && resp[property]) ?? []
  }

  public async searchSongs(term: string): Promise<Song[]> {
    console.log('searching song')
    return await this.splitSearch(term, 'songs')
  }

  public async searchArtists(term: string): Promise<Artists[]> {
    return await this.splitSearch(term, 'artists')
  }

  public async searchAlbum(term: string): Promise<Album[]> {
    return await this.splitSearch(term, 'albums')
  }

  public async searchPlaylists(term: string): Promise<Playlist[]> {
    return await this.splitSearch(term, 'playlists')
  }

  public provides(): ProviderScopes[] {
    return this.providerScopes
  }

  public get Title(): string {
    return this._title
  }

  public get BgColor(): string {
    return this._bgColor
  }

  public get IconComponent(): string {
    return this._icon
  }
}
