import YTPlayer from 'yt-player'

export class YTPlayerWrapper implements CustomAudioInstance {
  private supposedVolume
  private instance: YTPlayer

  private listeners: Record<string, never> = {}
  private elementIdentifier: string

  // stop() should not be called if player is going to be reused
  // This var will make sure that the 'paused' event is not fired when the
  // song is supposed to be stopped.
  private pauseAsStop = false

  constructor(element: string | HTMLElement) {
    this.instance = new YTPlayer(element, {
      modestBranding: true,
      related: false,
      annotations: false,
      keyboard: false,
      controls: false
    })
    this.elementIdentifier = element instanceof HTMLElement ? element.id : element
    this.supposedVolume = this.volume
    this.instance.on('playing', () => {
      this.volume = this.supposedVolume
    })
  }

  dispatchEvent(ev: Event) {
    this.instance.emit(ev.type)
  }

  public load() {
    return
  }

  set src(src: string) {
    if (!src) {
      this.stop()
      return
    }
    this.instance.load(src, false)
  }

  set volume(volume: number) {
    this.supposedVolume = volume
    this.instance.setVolume(volume * 100)
  }

  get volume() {
    return this.instance.getVolume() / 100
  }

  get currentTime() {
    return this.instance.getCurrentTime()
  }

  set currentTime(time: number) {
    this.instance.seek(time)
  }

  public async play() {
    this.instance?.play()
  }

  public pause() {
    this.instance?.pause()
  }

  public stop() {
    this.pauseAsStop = true
    this.instance.pause()
  }

  get paused() {
    return (
      this.instance.getState() === 'paused' ||
      this.instance.getState() === 'ended' ||
      this.instance.getState() === 'unstarted' ||
      this.instance.getState() === 'cued'
    )
  }

  set srcObject(o: unknown) {
    if (!o) {
      this.stop()
    }
    return
  }

  private removeListener(key: string) {
    if (this.listeners[key]) {
      this.removeEventListener(key, this.listeners[key])
    }
  }

  set onended(callback: never) {
    if (!callback) {
      this.removeListener('ended')
      return
    }

    this.instance.addListener('ended', callback)
    this.listeners['ended'] = callback
  }

  set ontimeupdate(callback: never) {
    if (!callback) {
      this.removeListener('timeupdate')
      return
    }
    this.instance.addListener('timeupdate', callback)
    this.listeners['timeupdate'] = callback
  }

  set onload(callback: never) {
    if (!callback) {
      this.removeListener('cued')
      return
    }
    this.instance.addListener('cued', callback)
    this.listeners['cued'] = callback
  }

  set onloadeddata(callback: never) {
    // this.instance.on('ended', callback)
  }

  set onerror(callback: never) {
    if (!callback) {
      this.removeListener('error')
      this.removeListener('unplayable')
      return
    }
    this.instance.addListener('error', callback)
    this.instance.addListener('unplayable', callback)
    this.listeners['error'] = callback
    this.listeners['unplayable'] = callback
  }

  set onloadstart(callback: never) {
    if (!callback) {
      this.removeListener('buffering')
      return
    }
    this.instance.addListener('buffering', callback)
    this.listeners['buffering'] = callback
  }

  removeAttribute(): void {
    return
  }

  addEventListener(ev: string, callback: (...args: unknown[]) => void) {
    if (ev === 'play') {
      ev = 'playing'
    }

    if (ev === 'pause') {
      ev = 'paused'
    }

    this.instance.addListener(ev, (...args: unknown[]) => {
      if (ev === 'paused' && this.pauseAsStop) {
        this.pauseAsStop = false
        return
      }
      callback(...args)
    })
  }

  removeEventListener(ev: string, callback: (...args: unknown[]) => void) {
    this.instance.removeListener(ev, callback)
  }

  setPlaybackQuality(quality: Parameters<typeof this.instance.setPlaybackQuality>[0]) {
    this.instance.setPlaybackQuality(quality)
  }
}
