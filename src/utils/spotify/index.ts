import { ConstructorConfig, PlayerEvent, PlayerEventTypes, SpotifyPlayerSpirc, Token, TokenScope } from 'librespot-node'
import { Serializable } from 'child_process'
import { prefixLogger } from '../main/logger/utils'
import log from 'loglevel'
import { sleep } from '../common'

class SpotifyPlayerProcess {
  private player: SpotifyPlayerSpirc | undefined
  private logsPath: string

  constructor() {
    let logsPath = ''
    for (const [index, arg] of process.argv.entries()) {
      if (process.argv[index + 1]) {
        if (arg === 'logPath') {
          logsPath = process.argv[index + 1]
        }
      }
    }

    this.logsPath = logsPath
    this.setupLogger()

    this.registerListeners()
  }

  private setupLogger() {
    const logger = log.getLogger('Librespot')
    prefixLogger(this.logsPath, logger)
    const logLevel = process.env.DEBUG_LOGGING ? log.levels.DEBUG : log.levels.INFO
    logger.setLevel(logLevel)

    console.info = (...args: unknown[]) => {
      logger.info(...args)
    }

    console.error = (...args: unknown[]) => {
      logger.error(...args)
    }

    console.warn = (...args: unknown[]) => {
      logger.warn(...args)
    }

    console.debug = (...args: unknown[]) => {
      logger.debug(...args)
    }

    console.trace = (...args: unknown[]) => {
      logger.trace(...args)
    }
  }

  private async connect(config: ConstructorConfig) {
    if (this.player) {
      await this.player.close()
    }

    return new Promise<void>((resolve, reject) => {
      this.player = new SpotifyPlayerSpirc(config)
      const errorListener = (e: PlayerEvent<'InitializationError'>) => {
        reject(e)
      }

      const successListener = () => {
        this.player?.off('InitializationError', errorListener)
        resolve()
      }

      this.player.once('InitializationError', errorListener)
      this.player.once('PlayerInitialized', successListener)

      this.player.on('Playing', this.sendEvent.bind(this))
      this.player.on('Paused', this.sendEvent.bind(this))
      this.player.on('Stopped', this.sendEvent.bind(this))
      this.player.on('TrackChanged', this.sendEvent.bind(this))
      this.player.on('EndOfTrack', this.sendEvent.bind(this))
      this.player.on('VolumeChanged', this.sendEvent.bind(this))
      this.player.on('Seeked', this.sendEvent.bind(this))
      this.player.on('Loading', this.sendEvent.bind(this))
      this.player.on('Unavailable', this.sendEvent.bind(this))
      this.player.on('TimeUpdated', this.sendEvent.bind(this))
    })
  }

  private sendEvent<T extends PlayerEventTypes>(event: PlayerEvent<T>) {
    process.send && process.send(event)
  }

  private async waitForPlayerInitialize() {
    await new Promise<void>((resolve) => {
      if (this.player?.isInitialized) resolve()

      this.player?.once('PlayerInitialized', () => {
        resolve()
      })
    })
  }

  private async queueCommand(command: string, args?: unknown[]) {
    await this.waitForPlayerInitialize()

    if (command === 'PLAY') {
      await this.player?.play()
    }

    if (command === 'PAUSE') {
      await this.player?.pause()
    }

    if (args) {
      if (command === 'LOAD') {
        await (this.player?.load as (...args: unknown[]) => Promise<void>)(...args)
      }

      if (command === 'VOLUME') {
        if (args.length > 0) {
          await this.player?.setVolume(args[0] as number, false)
        }
      }

      if (command === 'SEEK') {
        if (args.length > 0) {
          await this.player?.seek(args[0] as number)
        }
      }
    }
  }

  private isMessage(val: unknown): val is PlayerChannelMessage {
    if ((val as { channel: string }).channel) return true
    return false
  }

  private async handleCommand(command: string, args: unknown[]) {
    return await this.queueCommand(command, args)
  }

  private async getToken(scopes: TokenScope[], tries = 0): Promise<Token | undefined> {
    await this.waitForPlayerInitialize()
    try {
      return this.player?.getToken(...scopes)
    } catch (e) {
      if (tries < 3) {
        await sleep(500)
        console.warn('Failed to get token, retrying')
        tries += 1
        return await this.getToken(scopes, tries)
      } else {
        console.error('Failed to get token')
      }
    }
  }

  private isErrorEvent(val: unknown): val is PlayerEvent<'InitializationError'> {
    return (val as PlayerEvent<'InitializationError'>).event === 'InitializationError'
  }

  private async parseMessage(message: Serializable) {
    if (this.isMessage(message)) {
      const type = (message.data as SpotifyMessage)?.type
      const args = (message.data as SpotifyMessage)?.args

      const ret: PlayerChannelMessage = { channel: message.channel }
      if (type === 'CONNECT' && args?.auth) {
        try {
          await this.connect(args)
        } catch (e) {
          if (this.isErrorEvent(e)) {
            this.player?.removeAllListeners()
            this.player = undefined
            ret.error = (e.error as Error).toString()
            console.debug('sending error', ret)
            process.send && process.send(ret)
          }
          process.exit(1)
        }
      }

      if (type === 'COMMAND') {
        await this.handleCommand(args.command, args.args)
      }

      if (type === 'TOKEN') {
        ret.data = await this.getToken(args)
      }

      console.debug('sending reply', ret)
      process.send && process.send(ret)
    }
  }

  private async killSelf() {
    if (this.player) {
      this.player.removeAllListeners()
      await this.player.close()
    }

    process.exit(1)
  }

  private registerListeners() {
    process.on('message', (message: SpotifyMessage) => {
      this.parseMessage(message)
    })

    process.on('exit', () => this.killSelf())
    process.on('SIGQUIT', () => this.killSelf())
    process.on('SIGINT', () => this.killSelf())
    process.on('SIGUSR1', () => this.killSelf())
    process.on('SIGUSR2', () => this.killSelf())
    process.on('SIGHUP', () => this.killSelf())
  }
}

new SpotifyPlayerProcess()
