/*
 *  mpris.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { IpcEvents, MprisEvents } from './constants'
import MediaController, { ButtonEnum, PlaybackStateEnum, PlayerButtons } from 'media-controller'

import { WindowHandler } from '../windowManager'

function checkStarted() {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      if (this instanceof MprisChannel && this.isStarted) {
        return originalMethod.bind(this)(...args)
      }
    }
  }
}

export class MprisChannel implements IpcChannelInterface {
  name = IpcEvents.MPRIS
  private controller = MediaController

  private buttonState: MprisRequests.ButtonStatus = {}

  private buttonStatusCallbacks: ((buttons: PlayerButtons) => void)[] = []

  isStarted = false

  constructor() {
    try {
      this.controller.createPlayer('Moosync')
      this.isStarted = true
      this.setOnButtonPressed()
    } catch (e) {
      console.error(e)
    }
  }

  handle(event: Electron.IpcMainEvent, request: IpcRequest): void {
    switch (request.type) {
      case MprisEvents.PLAYBACK_STATE_CHANGED:
        this.onPlaybackStateChanged(event, request as IpcRequest<MprisRequests.PlaybackState>)
        break
      case MprisEvents.SONG_INFO_CHANGED:
        this.onSongInfoChange(event, request as IpcRequest<MprisRequests.SongInfo>)
        break
      case MprisEvents.BUTTON_STATUS_CHANGED:
        this.setButtonStatus(event, request as IpcRequest<MprisRequests.ButtonStatus>)
        break
      case MprisEvents.POSITION_CHANGED:
        this.updatePosition(event, request as IpcRequest<MprisRequests.Position>)
        break
    }
  }

  @checkStarted()
  private updatePosition(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.Position>) {
    if (request.params) {
      this.controller.setCurrentDuration(request.params.position * 10e5)
    }
    event.reply(request.responseChannel)
  }

  @checkStarted()
  private onSongInfoChange(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.SongInfo>) {
    if (request.params) {
      const { title, albumName, artistName, albumArtist, thumbnail, genres, id, duration } = request.params
      if (!title) {
        this.controller.updatePlayerDetails({
          title: '',
          albumName: '',
          artistName: '',
          thumbnail: '',
          genres: [],
          albumArtist: '',
          duration: 0,
        })
      } else {
        this.controller.updatePlayerDetails({
          id: 'track/0',
          title,
          albumName,
          artistName,
          thumbnail,
          genres,
          albumArtist,
          duration: (duration ?? 0) * 10e5,
        })
      }

      if (this.buttonState) {
        this.controller.setButtonStatus(this.buttonState)
      }
    }

    event.reply(request.responseChannel)
  }

  @checkStarted()
  private onPlaybackStateChanged(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.PlaybackState>) {
    if (request.params.state) {
      switch (request.params.state) {
        case 'PLAYING':
          this.handlePlayPauseButtonState(true)
          this.controller.setPlaybackStatus(PlaybackStateEnum.Playing)
          break
        case 'PAUSED':
          this.handlePlayPauseButtonState(false)
          this.controller.setPlaybackStatus(PlaybackStateEnum.Paused)
          break
        case 'STOPPED':
          this.controller.setPlaybackStatus(PlaybackStateEnum.Stopped)
          break
        case 'LOADING':
          this.controller.setPlaybackStatus(PlaybackStateEnum.Changing)
          break
      }
    }
    event.reply(request.responseChannel)
  }

  @checkStarted()
  private setButtonStatus(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.ButtonStatus>) {
    if (request.params) {
      this.buttonState = { ...this.buttonState, ...request.params }

      this.controller.setButtonStatus(this.buttonState)

      this.buttonStatusCallbacks.forEach((val) => {
        val(this.buttonState)
      })
    }

    event.reply(request.responseChannel)
  }

  @checkStarted()
  private handlePlayPauseButtonState(isPlaying: boolean) {
    if (process.platform !== 'linux') {
      this.buttonState['play'] = !isPlaying
      this.buttonState['pause'] = isPlaying
    } else {
      this.buttonState['play'] = true
      this.buttonState['pause'] = true
    }

    this.controller.setButtonStatus(this.buttonState)
  }

  @checkStarted()
  public onButtonPressed(button: ValueOf<typeof ButtonEnum>, arg?: unknown) {
    WindowHandler.getWindow(true)?.webContents.send(MprisEvents.ON_BUTTON_PRESSED, button, arg)
  }

  @checkStarted()
  private setOnButtonPressed() {
    this.controller.setButtonPressCallback(this.onButtonPressed.bind(this))
  }

  @checkStarted()
  public onButtonStatusChange(callback: (buttons: PlayerButtons) => void) {
    this.buttonStatusCallbacks.push(callback)
  }

  public get buttonStatus() {
    return this.buttonState
  }
}
