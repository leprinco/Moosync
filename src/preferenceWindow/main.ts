/*
 *  main.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import '@/preferenceWindow/plugins/vueBootstrap'
import '@/sass/global.sass'
import '@/preferenceWindow/plugins/recycleScroller'
import 'animate.css'

import App from './Preferences.vue'
import { router } from '@/preferenceWindow/plugins/router'
import { createApp } from 'vue'
import { i18n } from '@/preferenceWindow/plugins/i18n'
import EventEmitter from 'events'
import { registerLogger } from '@/utils/ui/common'

export const bus = new EventEmitter()

const app = createApp(App)
app.use(i18n)
app.use(router)

app.directive('click-outside', {
  mounted(el, binding) {
    el.clickOutsideEvent = function (e: any) {
      if (el !== e.target && !el.contains(e.target)) {
        binding.value(e, el)
      }
    }
    document.body.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.body.removeEventListener('click', el.clickOutsideEvent)
  }
})

registerLogger(app)

app.mount('#app')
