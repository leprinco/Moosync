import { createApp, isProxy, toRaw } from 'vue'
import { getErrorMessage } from '../common'

export function deepConvertProxy(val: unknown): unknown {
  if (val) {
    if (isProxy(val)) return toRaw(val)
    if (Array.isArray(val)) return val.map((v) => deepConvertProxy(v))
  }
  return val
}

export function registerLogger(app: ReturnType<typeof createApp>) {
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
      window.LoggerUtils.info(...args.map(deepConvertProxy))
    }
  }

  console.error = (...args: unknown[]) => {
    const error = getErrorMessage(...args)
    preservedConsoleError.apply(console, args)
    window.LoggerUtils.error(...error)
  }

  console.warn = (...args: unknown[]) => {
    if (!(args[0] as string).startsWith?.('[Vue warn]')) {
      preservedConsoleWarn.apply(console, args)
      try {
        window.LoggerUtils.warn(...args)
      } catch (e) {
        window.LoggerUtils.info(...args.map(deepConvertProxy))
      }
    }
  }

  console.debug = (...args: unknown[]) => {
    preservedConsoleDebug.apply(console, args)
    try {
      window.LoggerUtils.debug(...args)
    } catch {
      window.LoggerUtils.info(...args.map(deepConvertProxy))
    }
  }

  console.trace = (...args: unknown[]) => {
    preservedConsoleTrace.apply(console, args)
    try {
      window.LoggerUtils.trace(...args)
    } catch {
      window.LoggerUtils.info(...args.map(deepConvertProxy))
    }
  }

  window.onerror = (err) => {
    const error = getErrorMessage(err)
    console.error(...error)
  }

  app.config.errorHandler = (err) => {
    console.error(err)
  }

  window.onunhandledrejection = (ev) => {
    const message = ev.reason.message ?? JSON.stringify(ev.reason) ?? ev.reason
    window.LoggerUtils.error('Uncaught in promise', message)
  }
}
