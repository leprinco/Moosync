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
import { nativeImage, ThumbarButton } from 'electron'
import path from 'path'

export class MprisChannel implements IpcChannelInterface {
  name = IpcEvents.MPRIS
  private controller = MediaController

  private buttonState: MprisRequests.ButtonStatus = {}

  private buttonStatusCallbacks: ((buttons: PlayerButtons) => void)[] = []

  constructor() {
    this.controller.createPlayer('Moosync')
    this.setOnButtonPressed()
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
    }
  }

  private onSongInfoChange(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.SongInfo>) {
    if (request.params) {
      const { title, albumName, artistName, albumArtist, thumbnail, genres } = request.params
      if (!title) {
        this.controller.updatePlayerDetails({
          title: '',
          albumName: '',
          artistName: '',
          thumbnail: '',
          genres: [],
          albumArtist: ''
        })
      } else {
        this.controller.updatePlayerDetails({ title, albumName, artistName, thumbnail, genres, albumArtist })
      }
    }

    event.reply(request.responseChannel)
  }

  private onPlaybackStateChanged(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.PlaybackState>) {
    if (request.params.state) {
      switch (request.params.state) {
        case 'PLAYING':
          this.controller.setPlaybackStatus(PlaybackStateEnum.Playing)
          this.handlePlayPauseButtonState(true)
          break
        case 'PAUSED':
          this.controller.setPlaybackStatus(PlaybackStateEnum.Paused)
          this.handlePlayPauseButtonState(false)
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

  private setButtonStatus(event: Electron.IpcMainEvent, request: IpcRequest<MprisRequests.ButtonStatus>) {
    if (request.params) {
      this.buttonState = { ...this.buttonState, ...request.params }

      this.controller.setButtonStatus({
        play: this.buttonState.play,
        pause: this.buttonState.pause,
        next: this.buttonState.next,
        prev: this.buttonState.prev,
        shuffle: this.buttonState.shuffle,
        loop: this.buttonState.loop
      })

      this.buttonStatusCallbacks.forEach((val) => {
        val(this.buttonState)
      })
      this.setWindowToolbar()
    }

    event.reply(request.responseChannel)
  }

  private handlePlayPauseButtonState(isPlaying: boolean) {
    this.buttonState['play'] = !isPlaying
    this.buttonState['pause'] = isPlaying

    this.buttonStatusCallbacks.forEach((val) => {
      val(this.buttonState)
    })
    this.setWindowToolbar()
  }

  public onButtonPressed(button: ValueOf<typeof ButtonEnum>) {
    WindowHandler.getWindow(true)?.webContents.send(MprisEvents.ON_BUTTON_PRESSED, button)
  }

  private setOnButtonPressed() {
    this.controller.setButtonPressCallback(this.onButtonPressed.bind(this))
  }

  private setWindowToolbar() {
    const window = WindowHandler.getWindow(true)

    if (window) {
      const buttons: ThumbarButton[] = []

      if (this.buttonState.prev) {
        buttons.push({
          icon: nativeImage.createFromPath(path.join(__static, 'prev_track.png')),
          click: () => this.onButtonPressed(ButtonEnum.Previous),
          tooltip: 'Previous track'
        })
      }

      if (this.buttonState.play) {
        buttons.push({
          icon: nativeImage.createFromPath(path.join(__static, 'play.png')),
          click: () => this.onButtonPressed(ButtonEnum.Play),
          tooltip: 'Play'
        })
      }

      if (this.buttonState.pause) {
        buttons.push({
          icon: nativeImage.createFromPath(path.join(__static, 'pause.png')),
          click: () => this.onButtonPressed(ButtonEnum.Pause),
          tooltip: 'Pause'
        })
      }

      if (this.buttonState.next) {
        buttons.push({
          icon: nativeImage.createFromPath(path.join(__static, 'next_track.png')),
          click: () => this.onButtonPressed(ButtonEnum.Previous),
          tooltip: 'Next track'
        })
      }

      window.setThumbarButtons(buttons)
    }
  }

  public onButtonStatusChange(callback: (buttons: PlayerButtons) => void) {
    this.buttonStatusCallbacks.push(callback)
  }
}
