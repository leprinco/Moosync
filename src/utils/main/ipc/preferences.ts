import { IpcEvents, PreferenceEvents } from './constants';
import { getActiveTheme, loadAllThemes, loadPreferences, loadSelectivePreference, loadTheme, onPreferenceChanged, savePreferences, saveSelectivePreference, saveTheme, setActiveTheme } from '../db/preferences';

import { WindowHandler } from '../windowManager';

export class PreferenceChannel implements IpcChannelInterface {
  name = IpcEvents.PREFERENCES
  handle(event: Electron.IpcMainEvent, request: IpcRequest): void {
    switch (request.type) {
      case PreferenceEvents.LOAD_PREFERENCES:
        this.loadPreferences(event, request)
        break
      case PreferenceEvents.SAVE_PREFERENCES:
        this.savePreferences(event, request)
        break
      case PreferenceEvents.SAVE_SELECTIVE_PREFERENCES:
        this.saveSelective(event, request)
        break
      case PreferenceEvents.LOAD_SELECTIVE_PREFERENCES:
        this.loadSelective(event, request)
        break
      case PreferenceEvents.PREFERENCE_REFRESH:
        this.onPreferenceChanged(event, request)
        break
      case PreferenceEvents.SET_THEME:
        this.setTheme(event, request)
        break
      case PreferenceEvents.GET_THEME:
        this.getTheme(event, request)
        break
      case PreferenceEvents.SET_ACTIVE_THEME:
        this.setActiveTheme(event, request)
        break
      case PreferenceEvents.GET_ACTIVE_THEME:
        this.getActiveTheme(event, request)
        break
      case PreferenceEvents.GET_ALL_THEMES:
        this.getAllThemes(event, request)
        break
    }
  }

  private loadPreferences(event: Electron.IpcMainEvent, request: IpcRequest) {
    event.reply(request.responseChannel, loadPreferences())
  }

  private savePreferences(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.preferences) {
      event.reply(request.responseChannel, savePreferences(request.params.preferences))
    }
  }

  private saveSelective(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.key && request.params.value) {
      event.reply(request.responseChannel, saveSelectivePreference(request.params.key, request.params.value, request.params.isExtension))
    }
  }

  private loadSelective(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.key) {
      event.reply(request.responseChannel, loadSelectivePreference(request.params.key, request.params.isExtension))
    }
  }

  private onPreferenceChanged(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.key) {
      onPreferenceChanged(request.params.key, request.params.value)
    }
    event.reply(request.responseChannel)
  }

  private setTheme(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.theme) {
      saveTheme(request.params.theme)
    }
    event.reply(request.responseChannel)
  }

  private getTheme(event: Electron.IpcMainEvent, request: IpcRequest) {
    event.reply(request.responseChannel, loadTheme(request.params.id))
  }

  private getAllThemes(event: Electron.IpcMainEvent, request: IpcRequest) {
    event.reply(request.responseChannel, loadAllThemes())
  }

  private setActiveTheme(event: Electron.IpcMainEvent, request: IpcRequest) {
    if (request.params.id) {
      const theme = loadTheme(request.params.id)
      if (theme || request.params.id === 'default') {
        setActiveTheme(request.params.id)
        WindowHandler.getWindow(true)?.webContents.send(PreferenceEvents.THEME_REFRESH, theme)
      }
    }
    event.reply(request.responseChannel)
  }

  private getActiveTheme(event: Electron.IpcMainEvent, request: IpcRequest) {
    event.reply(request.responseChannel, getActiveTheme())
  }
}

export function preferencesChanged() {
  WindowHandler.getWindow(true)?.webContents.send(PreferenceEvents.PREFERENCE_REFRESH)
}
