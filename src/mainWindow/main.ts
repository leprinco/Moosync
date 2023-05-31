/*
 *  main.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import '@/mainWindow/plugins/recycleScroller'
import '@/mainWindow/plugins/toasted'
import '@/mainWindow/plugins/vueBootstrap'
import '@/mainWindow/plugins/tags-typeahead'
import '@/mainWindow/plugins/vueSliderBar'
import '@/mainWindow/plugins/inlineSVG'
import { i18n } from '@/mainWindow/plugins/i18n'
import '@/sass/global.sass'
import 'animate.css'

import App from '@/mainWindow/App.vue'
import Vue from 'vue'
import router from '@/mainWindow/plugins/router'
import { store } from '@/mainWindow/store'
import { getErrorMessage } from '@/utils/common'

Vue.config.productionTip = false
Vue.config.devtools = false

function registerLogger() {
  const preservedConsoleInfo = console.info
  const preservedConsoleError = console.error
  const preservedConsoleWarn = console.warn
  const preservedConsoleDebug = console.debug
  const preservedConsoleTrace = console.trace

  console.info = (...args: unknown[]) => {
    preservedConsoleInfo.apply(console, args)
    try {
      window.LoggerUtils.info(...args)
    } catch {
      window.LoggerUtils.info(...args.map((val) => JSON.stringify(val)))
    }
  }

  console.error = (...args: unknown[]) => {
    const error = getErrorMessage(...args)
    preservedConsoleError.apply(console, args)
    window.LoggerUtils.error(...error)
  }

  console.warn = (...args: unknown[]) => {
    preservedConsoleWarn.apply(console, args)
    try {
      window.LoggerUtils.warn(...args)
    } catch {
      window.LoggerUtils.warn(...args.map((val) => JSON.stringify(val)))
    }
  }

  console.debug = (...args: unknown[]) => {
    preservedConsoleDebug.apply(console, args)
    try {
      window.LoggerUtils.debug(...args)
    } catch {
      window.LoggerUtils.debug(...args.map((val) => JSON.stringify(val)))
    }
  }

  console.trace = (...args: unknown[]) => {
    preservedConsoleTrace.apply(console, args)
    try {
      window.LoggerUtils.trace(...args)
    } catch {
      window.LoggerUtils.trace(...args.map((val) => JSON.stringify(val)))
    }
  }

  window.onerror = (err) => {
    const error = getErrorMessage(err)
    console.error(...error)
  }

  Vue.config.errorHandler = (err) => {
    console.error(err)
  }

  window.onunhandledrejection = (ev) => {
    const message = ev.reason.message ?? JSON.stringify(ev.reason) ?? ev.reason
    window.LoggerUtils.error('Uncaught in promise', message)
  }
}

registerLogger()

export const bus = new Vue()

new Vue({
  components: { App },
  router,
  store,
  i18n,
  template: '<App/>'
}).$mount('#app')
