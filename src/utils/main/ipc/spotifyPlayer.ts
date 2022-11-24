/*
 *  spotifyPlayer.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { IpcEvents, SpotifyEvents } from './constants'
import { fork, ChildProcess } from 'child_process'
import { ConstructorConfig, PlayerEvent } from 'librespot-node'
import { v1 } from 'uuid'
import EventEmitter from 'events'
import { PlayerEventTypes } from 'librespot-node'
import path from 'path'
import { app } from 'electron'

const defaultLogPath = path.join(app.getPath('logs'))

function spawn_child(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: unknown[]) {
    if (
      this instanceof SpotifyPlayerChannel &&
      (!this.playerProcess || this.playerProcess.killed || !this.playerProcess.connected)
    ) {
      await this.spawnProcess()
    }

    return originalMethod.bind(this)(...args)
  }
}

export class SpotifyPlayerChannel implements IpcChannelInterface {
  name = IpcEvents.SPOTIFY
  public playerProcess?: ChildProcess

  private config: ConstructorConfig | undefined
  private isConnected = false

  private eventEmitter = new EventEmitter()

  private listeners: Record<string, (e: PlayerEvent) => void> = {}

  handle(event: Electron.IpcMainEvent, request: IpcRequest<never>): void {
    switch (request.type) {
      case SpotifyEvents.CONNECT:
        this.connect(event, request)
        break
      case SpotifyEvents.LISTEN_EVENT:
        this.on(event, request)
        break
      case SpotifyEvents.REMOVE_EVENT:
        this.off(event, request)
        break
      case SpotifyEvents.COMMAND:
        this.command(event, request)
        break
      case SpotifyEvents.CLOSE:
        this.closePlayer(event, request)
        break
      case SpotifyEvents.GET_TOKEN:
        this.getToken(event, request)
        break
    }
  }

  private sendAsync(message: SpotifyMessage) {
    if (this.playerProcess && !this.playerProcess.killed && this.playerProcess.connected) {
      // Don't reject error instead resolve it. Makes it easier to pass it to renderer
      return new Promise<unknown>((resolve) => {
        const id = v1()
        let resolved = false
        const listener = (message: PlayerChannelMessage) => {
          if (message.channel === id) {
            console.debug('Got reply from librespot', message)
            this.playerProcess?.off('message', listener)
            resolved = true

            if (message.error) {
              resolve(new Error(message.error))
              return
            }
            resolve(message.data)
          }
        }

        // Automatically resolve if no reply from child process in 5 secs
        setTimeout(() => {
          if (!resolved) {
            this.playerProcess?.off('message', listener)
            resolve(new Error('Failed to resolve message'))
          }
        }, 5000)

        this.playerProcess?.on('message', listener)

        this.playerProcess?.send({ data: message, channel: id })
      })
    }
  }

  public closePlayer(event?: Electron.IpcMainEvent, request?: IpcRequest) {
    if (this.playerProcess) {
      this.playerProcess.removeAllListeners()
      this.playerProcess.kill()
      this.playerProcess = undefined
    }

    event?.reply(request?.responseChannel)
  }

  private isEvent<T extends PlayerEventTypes>(val: unknown): val is PlayerEvent<T> {
    return !!(val as PlayerEvent).event
  }

  public async spawnProcess() {
    if (this.playerProcess) {
      this.playerProcess.removeAllListeners()
      this.playerProcess.kill()
    }

    this.playerProcess = fork(__dirname + '/spotify.js', ['logPath', defaultLogPath])

    this.playerProcess.on('message', (message) => {
      if (this.isEvent(message)) {
        this.eventEmitter.emit(message.event, message)
      }
    })

    if (this.config) {
      await this.sendAsync({ type: 'CONNECT', args: this.config })
    }
  }

  @spawn_child
  private async command(event: Electron.IpcMainEvent, request: IpcRequest<SpotifyRequests.Command>) {
    await this.sendAsync({ type: 'COMMAND', args: request.params })
    event.reply(request.responseChannel)
  }

  @spawn_child
  private on(event: Electron.IpcMainEvent, request: IpcRequest<SpotifyRequests.EventListener>) {
    const listener = (e: PlayerEvent) => event.sender.send(request.responseChannel ?? '', e)
    this.eventEmitter.on(request.params.event, listener)
    this.listeners[request.params.event] = listener
  }

  private off(event: Electron.IpcMainEvent, request: IpcRequest<SpotifyRequests.EventListener>) {
    const listener = this.listeners[request.params.event]
    if (listener) {
      delete this.listeners[request.params.event]
      this.eventEmitter.off(request.params.event, listener)
    }
    event.reply(request.responseChannel)
  }

  @spawn_child
  private async connect(event: Electron.IpcMainEvent, request: IpcRequest<SpotifyRequests.Config>) {
    request.params.cache_path = path.join(app.getPath('sessionData'), app.getName())
    request.params.save_tokens = true

    const ret = await this.sendAsync({ type: 'CONNECT', args: request.params })
    if (!(ret instanceof Error)) {
      this.config = request.params
    }
    event.reply(request.responseChannel, ret)
  }

  @spawn_child
  private async getToken(event: Electron.IpcMainEvent, request: IpcRequest<SpotifyRequests.Token>) {
    const token = await this.sendAsync({ type: 'TOKEN', args: request.params.scopes })
    event.reply(request.responseChannel, token)
  }
}
