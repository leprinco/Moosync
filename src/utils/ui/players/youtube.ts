import { Player } from './player'
import YTPlayer from 'yt-player'

export class YoutubePlayer extends Player {
  playerInstance: YTPlayer

  constructor(playerInstance: YTPlayer) {
    super()
    this.playerInstance = playerInstance
  }

  load(src?: string, volume?: number): void {
    src ? this.playerInstance.load(src) : null
    volume ? (this.volume = volume) : null
  }

  async play(): Promise<void> {
    this.playerInstance.play()
    return
  }

  pause(): void {
    return this.playerInstance.pause()
  }

  stop(): void {
    return this.playerInstance.stop()
  }

  get currentTime(): number {
    return this.playerInstance.getCurrentTime()
  }

  set currentTime(time: number) {
    this.playerInstance.seek(time)
  }

  get volume(): number {
    return this.playerInstance.getVolume()
  }

  set volume(volume: number) {
    this.playerInstance.setVolume(volume)
  }

  protected listenOnEnded(): void {
    this.playerInstance.addListener('ended', this.onEndedCallback!)
  }

  protected listenOnTimeUpdate(): void {
    this.playerInstance.addListener('timeupdate', this.onTimeUpdateCallback!)
  }

  protected listenOnLoad(): void {
    this.playerInstance.addListener('cued', this.onLoadCallback!)
  }

  protected listenOnError(): void {
    this.playerInstance.addListener('error', this.onErrorCallback as (err: any) => void)
    this.playerInstance.addListener('unplayable', this.onErrorCallback as (err: any) => void)
  }

  protected listenOnStateChange(): void {
    if (this.onStateChangeCallback) {
      this.playerInstance.addListener('playing', () => this.onStateChangeCallback!('PLAYING'))
      this.playerInstance.addListener('paused', () => this.onStateChangeCallback!('PAUSED'))
      this.playerInstance.addListener('ended', () => this.onStateChangeCallback!('STOPPED'))
    }
  }

  removeAllListeners(): void {
    this.playerInstance.removeAllListeners()
  }
}
