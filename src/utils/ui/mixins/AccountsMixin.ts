/*
 *  AccountsMixin.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { Component } from 'vue-property-decorator'
import { vxm } from '@/mainWindow/store'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'
import { ProviderScopes } from '@/utils/ui/providers/generics/genericProvider'
import { mixins } from 'vue-class-component'
import ProviderMixin from './ProviderMixin'

@Component
export default class AccountsMixin extends mixins(ProviderMixin) {
  private _signoutProvider?: (provider: Provider) => void

  protected extraAccounts: StrippedAccountDetails[] = []

  set signoutMethod(signout: ((provider: Provider) => void) | undefined) {
    this._signoutProvider = signout
  }

  get signoutMethod() {
    return this._signoutProvider
  }

  protected fetchProviders() {
    const p = this.getProvidersByScope()
    return p.map((val) => ({
      username: '',
      provider: val
    }))
  }

  protected providers = this.fetchProviders()

  protected async getUserDetails(provider: Provider) {
    const username = await provider?.provider.getUserDetails()
    this.$set(provider, 'username', username)
    if (!provider.username) {
      provider.provider.signOut()
    }
  }

  protected async handleClick(provider: Provider) {
    if (!(await provider.provider.getLoggedIn())) {
      const success = await provider.provider.updateConfig()
      if (!success) {
        window.WindowUtils.openWindow(false, { page: 'system' })
        return
      }
      return this.login(provider)
    }
    this._signoutProvider && this._signoutProvider(provider)
  }

  protected async login(provider: Provider) {
    if (await provider.provider.login()) {
      try {
        await this.getUserDetails(provider)
        bus.$emit(EventBus.REFRESH_USERNAMES, provider)

        if (vxm.player.currentSong) {
          const providerScopes = provider.provider.provides()
          if (providerScopes.includes(ProviderScopes.SCROBBLES)) {
            provider.provider.scrobble(vxm.player.currentSong)
          }
        }
      } catch (e) {
        console.error(e)
        await provider.provider.signOut()
      }

      // Side-effect to set logged-in variable
      await provider.provider.getLoggedIn()
    }
  }

  protected handleExtensionAccountClick(id: string) {
    const account = this.extraAccounts.find((val) => val.id === id)
    if (account) {
      window.ExtensionUtils.performAccountLogin(account.packageName, account.id, !account.loggedIn).then(() =>
        console.debug('performed login for', account.packageName)
      )
    }
  }

  async mounted() {
    this.providers.forEach((val) => {
      this.getUserDetails(val)
    })

    // TODO: Wait for useInvidious to be set

    // vxm.providers.$watch(
    //   'useInvidious',
    //   (val) => {
    //     this.getUserDetails(vxm.providers.youtubeProvider)
    //   },
    //   { immediate: true, deep: false }
    // )

    bus.$on(EventBus.REFRESH_USERNAMES, (provider: Provider) => {
      this.getUserDetails(provider)
    })

    await this.findAccounts()
    window.ExtensionUtils.listenExtensionsChanged(() => {
      this.extraAccounts = []
      this.findAccounts()
    })

    window.ExtensionUtils.listenAccountRegistered(async (details) => {
      details.data.icon = await this.getAccountIcon(details.data)
      const existing = this.extraAccounts.findIndex((val) => val.id === details.data.id)

      if (existing === -1) {
        this.extraAccounts.push(details.data)
      } else {
        this.extraAccounts.splice(existing, 1, details.data)
      }
    })
  }

  private async findAccounts() {
    const extensionAccounts = await window.ExtensionUtils.getRegisteredAccounts()
    for (const value of Object.values(extensionAccounts)) {
      for (const v of value) {
        if (!this.extraAccounts.find((val) => val.id === v.id)) {
          v.icon = await this.getAccountIcon(v)
          this.extraAccounts.push(v)
        }
      }
    }
  }

  private async getAccountIcon(account: StrippedAccountDetails) {
    let icon = account.icon
    if (icon) {
      icon = await window.ExtensionUtils.getExtensionIcon(account.packageName)
    }

    if (!icon.startsWith('http')) {
      return 'media://' + icon
    }
    return icon
  }
}
