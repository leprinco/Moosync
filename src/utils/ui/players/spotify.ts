import { Player } from './player'
import { PlayerEvent, PlayerEventTypes } from 'librespot-node'
import { vxm } from '@/mainWindow/store'

export class SpotifyPlayer extends Player {
  private listenerMap: Partial<Record<PlayerEventTypes, { listener: unknown; channel: string }>> = {}
  private lastVolume = 0

  private ignorePause = false

  public provides(): PlayerTypes[] {
    return ['SPOTIFY']
  }

  get key() {
    return 'SPOTIFY'
  }

  async _initialize(): Promise<void> {
    await vxm.providers.spotifyProvider.getLoggedIn()
    return
  }

  async _load(src?: string | undefined, volume?: number | undefined, autoplay?: boolean | undefined): Promise<void> {
    await window.SpotifyPlayer.command('LOAD', [src])
    volume && (this.volume = volume)
    autoplay && (await window.SpotifyPlayer.command('PLAY'))
  }

  async _play(): Promise<void> {
    await window.SpotifyPlayer.command('PLAY')
  }

  async _pause(): Promise<void> {
    await window.SpotifyPlayer.command('PAUSE')
  }

  async _stop(): Promise<void> {
    this.ignorePause = true
    await window.SpotifyPlayer.command('PAUSE')
    await window.SpotifyPlayer.command('VOLUME', [0])
  }

  get currentTime(): number {
    return 0
  }

  set currentTime(time: number) {
    window.SpotifyPlayer.command('SEEK', [time * 1000])
  }

  get volume(): number {
    return 0
  }

  set volume(volume: number) {
    this.lastVolume = volume
    window.SpotifyPlayer.command('VOLUME', [volume])
  }

  private registerListener<T extends PlayerEventTypes>(event: T, listener: (e: PlayerEvent<T>) => void) {
    const channel = window.SpotifyPlayer.on(event, listener)
    this.listenerMap[event] = { listener: listener, channel }
  }

  protected listenOnEnded(callback: () => void): void {
    this.registerListener('EndOfTrack', () => {
      this.ignorePause = true
      callback()
    })
  }

  protected listenOnTimeUpdate(callback: (time: number) => void): void {
    this.registerListener('TimeUpdated', (e) => callback(e.position_ms / 1000))
  }

  protected listenOnLoad(callback: () => void): void {
    this.registerListener('TrackChanged', () => callback())
  }

  protected listenOnError(callback: (err: Error) => void): void {
    this.registerListener('Unavailable', (e) =>
      callback(new Error(`Failed to load track ${e.track_id}. Track unavailable`))
    )
  }

  protected listenOnStateChange(callback: (state: PlayerState) => void): void {
    this.registerListener('Playing', () => {
      callback('PLAYING')
      this.volume = this.lastVolume
    })

    this.registerListener('Paused', () => {
      if (this.ignorePause) {
        this.ignorePause = false
        return
      }
      callback('PAUSED')
    })
    this.registerListener('Stopped', () => callback('STOPPED'))
    this.registerListener('Loading', () => callback('LOADING'))
  }

  protected listenOnBuffer(callback: () => void): void {
    this.registerListener('Loading', () => callback())
  }

  removeAllListeners(): void {
    for (const [key, value] of Object.entries(this.listenerMap)) {
      window.SpotifyPlayer.off(value.channel, key, value.listener)
    }
  }

  createAudioContext(): AudioContext | undefined {
    return undefined
  }

  connectAudioContextNode(): void {
    undefined
  }

  preload(): void {
    undefined
  }

  async close() {
    await window.SpotifyPlayer.close()
  }
}
