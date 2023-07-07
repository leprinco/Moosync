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
import { getErrorMessage } from '@/utils/common'
import { createApp } from 'vue'
import { i18n } from '@/mainWindow/plugins/i18n'
import EventEmitter from 'events'

function registerLogger(app: ReturnType<typeof createApp>) {
  const preservedConsoleInfo = console.info
  const preservedConsoleError = console.error
  const preservedConsoleWarn = console.warn
  const preservedConsoleDebug = console.debug
  const preservedConsoleTrace = console.trace

  if (window.LoggerUtils && window.LoggerUtils.info && window.LoggerUtils.error) {
    console.info = (...args: unknown[]) => {
      preservedConsoleInfo.apply(console, args)
      window.LoggerUtils.info(...args)
    }

    console.error = (...args: unknown[]) => {
      const error = getErrorMessage(...args)
      preservedConsoleError.apply(console, args)
      window.LoggerUtils.error(...error)
    }

    console.warn = (...args: unknown[]) => {
      preservedConsoleWarn.apply(console, args)
      window.LoggerUtils.warn(...args)
    }

    console.debug = (...args: unknown[]) => {
      preservedConsoleDebug.apply(console, args)
      window.LoggerUtils.debug(...args)
    }

    console.trace = (...args: unknown[]) => {
      preservedConsoleTrace.apply(console, args)
      window.LoggerUtils.trace(...args)
    }

    window.onerror = (err) => {
      const error = getErrorMessage(err)
      console.error(...error)
    }

    app.config.errorHandler = (err) => {
      console.error(err)
    }
  }
}

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
