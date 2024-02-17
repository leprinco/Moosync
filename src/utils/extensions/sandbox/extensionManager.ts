/*
 *  extensionManager.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { prefixLogger } from '../../main/logger/utils'
import { ExtensionRequestGenerator } from './api'
import { InMemoryRegistry } from './extensionRegistry'
import { readFile } from 'fs/promises'
import log from 'loglevel'
import path from 'path'
import { v4 } from 'uuid'
import { NodeVM } from 'vm2'

export abstract class AbstractExtensionManager {
  abstract instantiateAndRegister(extension: UnInitializedExtensionItem): Promise<void>
  abstract deregister(packageName: string): void
  abstract getExtensions(options?: getExtensionOptions): Iterable<ExtensionItem>
  abstract setStarted(packageName: string, status: boolean): void
}

export class ExtensionManager extends AbstractExtensionManager {
  private extensionRegistry = new InMemoryRegistry()
  private logsPath: string
  private installPath: string

  private extensionCommunicator: ExtensionCommunicator = {
    extensionRetriever: this.getExtensions.bind(this),
    addPreference: this.addPreference.bind(this),
    removePreference: this.removePreference.bind(this),
  }

  constructor(logsPath: string, installPath: string) {
    super()
    this.logsPath = logsPath
    this.installPath = installPath
  }

  private register(extensionItem: ExtensionItem) {
    this.extensionRegistry.register(extensionItem)
  }

  deregister(packageName: string) {
    this.extensionRegistry.deregister(packageName)
  }

  private getProcessEnv() {
    const env = JSON.parse(JSON.stringify(process.env)) as Partial<NodeJS.ProcessEnv>
    env.FanartTVApiKey = undefined
    env.LastFmApiKey = undefined
    env.LastFmSecret = undefined
    env.SpotifyClientID = undefined
    env.SpotifyClientSecret = undefined
    env.YoutubeClientID = undefined
    env.YoutubeClientSecret = undefined

    env['YOUTUBECLIENTID'] = undefined
    env['YOUTUBECLIENTSECRET'] = undefined
    env['LASTFMAPIKEY'] = undefined
    env['LASTFMSECRET'] = undefined
    env['FANARTTVAPIKEY'] = undefined
    env['GH_TOKEN'] = undefined

    env['MOOSYNC_VERSION'] = process.env.MOOSYNC_VERSION
    env['installPath'] = this.installPath

    return env
  }

  private async getVM(entryFilePath: string, extensionPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const events = require('events')
    const vm = new NodeVM({
      console: 'redirect',
      sandbox: {
        URL,
        URLSearchParams,
      },
      env: this.getProcessEnv(),
      nesting: true,
      require: {
        external: true,
        context: 'host',
        builtin: ['*'],
        root: [path.dirname(entryFilePath), extensionPath],
        mock: {
          events,
        },
      },
    })

    return vm
  }

  private getGlobalObject(packageName: string, entryFilePath: string) {
    const child = log.getLogger(packageName)
    prefixLogger(this.logsPath, child)

    return {
      __dirname: path.dirname(entryFilePath),
      __filename: entryFilePath,
      api: new ExtensionRequestGenerator(packageName, this.extensionCommunicator),
      logger: child,
    }
  }

  private readFileNoCache(path: string) {
    return readFile(path, { flag: 'rs', encoding: 'utf-8' })
  }

  private async checkExtValidityAndGetInstance(
    entryFilePath: string,
    extensionPath: string,
  ): Promise<{ vm: NodeVM; factory: ExtensionFactory } | undefined> {
    try {
      const file = await this.readFileNoCache(entryFilePath)
      const vm = await this.getVM(entryFilePath, extensionPath)
      const extension = vm.run(file, entryFilePath)

      let instance

      if (typeof extension === 'function') {
        instance = new extension()
      }

      if (typeof extension === 'object') {
        instance = new extension.default()
      }

      if (!Array.isArray(instance.extensionDescriptors)) {
        return
      }

      for (const factory of instance.extensionDescriptors) {
        if (factory.create) {
          return { factory: factory, vm }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  private setGlobalObjectToVM(vm: NodeVM, packageName: string, entryFilePath: string) {
    const globalObj = this.getGlobalObject(packageName, entryFilePath)
    vm.freeze(globalObj.api, 'api')
    vm.freeze(globalObj.logger, 'logger')

    vm.on('console.log', globalObj.logger.log)
    vm.on('console.info', globalObj.logger.info)
    vm.on('console.trace', globalObj.logger.trace)
    vm.on('console.debug', globalObj.logger.debug)
    vm.on('console.warn', globalObj.logger.warn)
    vm.on('console.error', globalObj.logger.error)

    return globalObj
  }

  async instantiateAndRegister(extension: UnInitializedExtensionItem) {
    const vmObj = await this.checkExtValidityAndGetInstance(extension.entry, extension.extensionPath)
    if (vmObj) {
      const global = this.setGlobalObjectToVM(vmObj.vm, extension.packageName, extension.entry)

      const preferences = await (vmObj.factory.registerPreferences?.() ??
        vmObj.factory.registerUserPreferences?.() ??
        [])

      const instance = await vmObj.factory.create()

      console.debug('Instantiated', extension.name)

      this.register({
        name: extension.name,
        desc: extension.desc,
        author: extension.author,
        packageName: extension.packageName,
        version: extension.version,
        hasStarted: false,
        entry: extension.entry,
        vm: vmObj.vm,
        extensionPath: extension.extensionPath,
        extensionIcon: extension.extensionIcon,
        preferences,
        global,
        instance,
      })
    }

    console.debug(`Registered ${extension.name} - ${extension.desc}`)
  }

  getExtensions(options?: getExtensionOptions): Iterable<ExtensionItem> {
    return this.extensionRegistry.get(options)
  }

  private notifyPreferencesChanged(packageName: string) {
    process.send?.({
      type: 'update-preferences',
      channel: v4(),
      data: undefined,
      extensionName: packageName,
    } as extensionUIRequestMessage)
  }

  private addPreference(packageName: string, preference: ExtensionPreferenceGroup) {
    for (const e of this.extensionRegistry.get({ packageName })) {
      if (e.preferences.find((val) => val.key === preference.key)) {
        console.warn('Preference already exists, skipping...')
        return
      }
      e.preferences.push(preference)
      this.notifyPreferencesChanged(packageName)
      return
    }
  }

  private removePreference(packageName: string, key: string) {
    for (const e of this.extensionRegistry.get({ packageName })) {
      const i = e.preferences.findIndex((val) => val.key === key)
      if (i !== -1) {
        e.preferences.splice(i, 1)
        this.notifyPreferencesChanged(packageName)
      } else {
        console.warn('Preference with key', key, 'does not exist')
      }
      return
    }
  }

  setStarted(packageName: string, status: boolean) {
    this.extensionRegistry.setStarted(packageName, status)
  }
}
