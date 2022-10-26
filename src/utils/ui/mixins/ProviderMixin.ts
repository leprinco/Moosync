/*
 *  AccountsMixin.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { Component, Vue } from 'vue-property-decorator'
import { vxm } from '@/mainWindow/store'
import { GenericProvider } from '../providers/generics/genericProvider'
import { ProviderScopes } from '@/utils/commonConstants'
import { isEmpty } from '@/utils/common'

@Component
export default class ProviderMixin extends Vue {
  getProvidersByScope(action?: ProviderScopes) {
    const allProviders = [
      vxm.providers.youtubeProvider,
      vxm.providers.spotifyProvider,
      vxm.providers.lastfmProvider,
      ...vxm.providers.extensionProviders
    ]
    const ret: GenericProvider[] = []

    for (const provider of allProviders) {
      const provides = provider.provides()
      if (!isEmpty(action)) {
        if (provides.includes(action!)) {
          ret.push(provider)
        }
      } else {
        ret.push(provider)
      }
    }

    return ret
  }

  getProviderByKey(key: string): GenericProvider | undefined {
    const allProviders: GenericProvider[] = [
      vxm.providers.youtubeProvider,
      vxm.providers.spotifyProvider,
      vxm.providers.lastfmProvider,
      ...vxm.providers.extensionProviders
    ]

    return allProviders.find((val) => val.key === key)
  }

  onProvidersChanged(callback: () => void) {
    vxm.providers.$watch('_extensionProviders', callback)
  }

  getAllProviders() {
    return [
      vxm.providers.youtubeProvider,
      vxm.providers.spotifyProvider,
      vxm.providers.lastfmProvider,
      ...vxm.providers.extensionProviders
    ]
  }
}
