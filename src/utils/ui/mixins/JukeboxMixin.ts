/*
 *  AccountsMixin.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { vxm } from '@/mainWindow/store'
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class JukeboxMixin extends Vue {
  public get isJukeboxModeActive() {
    return vxm.themes.jukeboxMode
  }
}
