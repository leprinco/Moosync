/*
 *  providers.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { LastFMProvider } from '../../utils/ui/providers/lastfm'
import { SpotifyProvider } from '../../utils/ui/providers/spotify'
import { VuexModule } from './module'
import { YoutubeProvider } from '@/utils/ui/providers/youtube'
import { InvidiousProvider } from '@/utils/ui/providers/invidious'
import { action, mutation } from 'vuex-class-component'
import { ExtensionProvider } from '@/utils/ui/providers/extensionWrapper'

export class ProviderStore extends VuexModule.With({ namespaced: 'providers' }) {
  public spotifyProvider = new SpotifyProvider()
  public lastfmProvider = new LastFMProvider()
  public _youtubeProvider = new YoutubeProvider()
  public _invidiousProvider = new InvidiousProvider()
  public _extensionProviders: ExtensionProvider[] = []

  private _loggedInYoutube = false
  private _loggedInSpotify = false
  private _loggedInLastFM = false

  private _useInvidious = false

  get youtubeProvider() {
    if (this._useInvidious) {
      return this._invidiousProvider
    } else {
      return this._youtubeProvider
    }
  }

  get useInvidious() {
    return this._useInvidious
  }

  set useInvidious(val: boolean) {
    this._useInvidious = val
  }

  get loggedInYoutube() {
    return this._loggedInYoutube
  }

  set loggedInYoutube(val: boolean) {
    this._loggedInYoutube = val
  }

  get loggedInSpotify() {
    return this._loggedInSpotify
  }

  set loggedInSpotify(val: boolean) {
    this._loggedInSpotify = val
  }

  get loggedInLastFM() {
    return this._loggedInLastFM
  }

  set loggedInLastFM(val: boolean) {
    this._loggedInLastFM = val
  }

  get extensionProviders() {
    return this._extensionProviders
  }

  @mutation
  addExtensionProvider(provider: ExtensionProvider) {
    if (this._extensionProviders.findIndex((val) => val.key === provider.key) === -1) {
      this._extensionProviders.push(provider)
    }
  }

  @action
  async fetchExtensionProviders() {
    const extensions = await window.ExtensionUtils.getAllExtensions()
    for (const e of extensions) {
      const scopes = (await window.ExtensionUtils.getExtensionProviderScopes(e.packageName))[e.packageName]
      if (scopes.length > 0) {
        this.addExtensionProvider(new ExtensionProvider(e.packageName, scopes))
      }
    }
  }
}
