import { LocalPlayer } from './local'
import { vxm } from '../../../mainWindow/store/index'
import EventEmitter from 'events'

export class InvidiousPlayer extends LocalPlayer {
  private customLoadEventEmitter = new EventEmitter()
  private lastAutoPlay = false

  private errorTries = 0

  public provides(): PlayerTypes[] {
    return ['YOUTUBE', 'SPOTIFY']
  }

  get key() {
    return 'YOUTUBE'
  }

  public async canPlay(src: string): Promise<boolean> {
    console.log('can play', src)
    return src.length === 11 || vxm.providers.youtubeProvider.matchSongUrl(src)
  }

  protected async _load(src?: string, volume?: number, autoplay?: boolean, errorTries?: number) {
    this.customLoadEventEmitter.emit('loading')
    let playbackURL = await this.fetchPlaybackURL(src)
    console.log(src, playbackURL)
    if (playbackURL) {
      const shouldProxy = (await window.PreferenceUtils.loadSelectiveArrayItem<Checkbox>('invidious.always_proxy'))
        ?.enabled

      if (shouldProxy ?? true) {
        playbackURL = await this.proxyVideoOnInvidious(playbackURL)
      }

      this.customLoadEventEmitter.emit('loaded')
      this.lastAutoPlay = autoplay ?? this.lastAutoPlay

      if (typeof errorTries === 'undefined') {
        errorTries = 0
      }

      super._load(playbackURL, volume, this.lastAutoPlay)
    }
  }

  private async fetchPlaybackURL(str: string | undefined) {
    if (str) {
      console.trace('parsing', str)
      if (str.startsWith('http')) {
        str = vxm.providers._invidiousProvider.getVideoIdFromURL(str)
      }

      if (str) {
        // This won't make a request to youtube
        const resp: InvidiousSong | undefined = await vxm.providers._invidiousProvider.getSongDetails(str)
        if (resp && resp.invidiousPlaybackUrl) {
          return resp.invidiousPlaybackUrl
        }
      } else {
        this.customLoadEventEmitter.emit('error', new Error('Invalid URL'))
      }
    }
  }

  private async proxyVideoOnInvidious(src: string) {
    const baseUrl = new URL((await window.PreferenceUtils.loadSelective<string>('invidious_instance')) ?? '')
    const currentSrc = new URL(src)

    if (baseUrl.host && baseUrl.host !== currentSrc.host) {
      currentSrc.host = new URL(baseUrl).host
    }

    return currentSrc.toString()
  }

  protected listenOnLoad(callback: () => void): void {
    this.customLoadEventEmitter.on('loaded', callback)
    super.listenOnLoad(callback)
  }

  protected listenOnBuffer(callback: () => void): void {
    this.customLoadEventEmitter.on('loading', callback)
    super.listenOnBuffer(callback)
  }

  protected listenOnError(callback: (err: Error) => void): void {
    this.customLoadEventEmitter.on('error', callback)
    this.playerInstance.onerror = async (event, source, line, col, err) => {
      if (this.errorTries < 3) {
        try {
          this.customLoadEventEmitter.emit('loading')
          const newUrl = await this.proxyVideoOnInvidious(((event as ErrorEvent)?.target as HTMLAudioElement)?.src)
          this.errorTries += 1
          this.load(newUrl, this.errorTries)
        } catch (e) {
          console.error(e)
        }
      }

      if (err) {
        callback(err)
      }
    }
  }
}
