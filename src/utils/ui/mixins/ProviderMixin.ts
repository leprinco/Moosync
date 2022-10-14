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
import { ProviderScopes, GenericProvider } from '../providers/generics/genericProvider'

@Component
export default class ProviderMixin extends Vue {
  getProvidersByScope(action?: ProviderScopes) {
    const allProviders = [vxm.providers.youtubeProvider, vxm.providers.spotifyProvider, vxm.providers.lastfmProvider]
    const ret: GenericProvider[] = []

    for (const provider of allProviders) {
      const provides = provider.provides()
      if (action) {
        if (provides.includes(action)) {
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
      vxm.providers.lastfmProvider
    ]

    return allProviders.filter((val) => val.key === key)[0]
  }
}
