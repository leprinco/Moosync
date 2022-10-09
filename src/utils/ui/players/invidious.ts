import { LocalPlayer } from './local'
import { vxm } from '../../../mainWindow/store/index'
import EventEmitter from 'events'

export class InvidiousPlayer extends LocalPlayer {
  private customLoadEventEmitter = new EventEmitter()
  private lastAutoPlay = false

  async load(src?: string, volume?: number, autoplay?: boolean) {
    this.customLoadEventEmitter.emit('loading')
    let playbackURL = await this.fetchPlaybackURL(src)
    if (playbackURL) {
      const shouldProxy = (await window.PreferenceUtils.loadSelectiveArrayItem<Checkbox>('invidious.always_proxy'))
        ?.enabled

      console.log(shouldProxy)
      if (shouldProxy ?? true) {
        playbackURL = await this.proxyVideoOnInvidious(playbackURL)
      }

      this.customLoadEventEmitter.emit('loaded')
      this.lastAutoPlay = autoplay ?? this.lastAutoPlay
      super.load(playbackURL, volume, this.lastAutoPlay)
    }
  }

  private async fetchPlaybackURL(str: string | undefined) {
    if (str) {
      if (str.startsWith('http')) {
        return str
      }
      // This won't make a request to youtube
      const resp: InvidiousSong | undefined = await vxm.providers._invidiousProvider.getSongDetails(
        `https://www.youtube.com/watch?v=${str}`
      )
      if (resp) {
        return resp.invidiousPlaybackUrl
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
    this.playerInstance.onerror = async (event, source, line, col, err) => {
      try {
        this.customLoadEventEmitter.emit('loading')
        const newUrl = await this.proxyVideoOnInvidious(((event as ErrorEvent)?.target as HTMLAudioElement)?.src)
        this.load(newUrl)
      } catch (e) {
        console.error(e)
      }

      if (err) {
        callback(err)
      }
    }
  }
}
