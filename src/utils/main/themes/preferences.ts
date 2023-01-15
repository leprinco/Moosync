import { saveSelectivePreference, loadSelectivePreference, store } from '../db/preferences'
import { SystemThemeHandler } from './system'
import { promises as fsP } from 'fs'
import path from 'path'

/**
 * Saves theme under key "themes"
 * @param theme details of theme to save
 */
export function saveTheme(theme: ThemeDetails) {
  store.set(`themes.${theme.id}`, theme)
}

/**
 * Removes theme by id
 * @param id of theme
 */
export function removeTheme(id: string) {
  store.delete(`themes.${id}` as never)
}

/**
 * Fetches theme by id
 * @param id of theme
 * @returns details of theme if found otherwise undefined
 */
export function loadTheme(id: string): ThemeDetails | undefined {
  return store.get(`themes.${id}`) as ThemeDetails | undefined
}

/**
 * Fetches all themes
 * @returns Dictionary of themes with their id's as keys
 */
export function loadAllThemes(): { [key: string]: ThemeDetails } | undefined {
  return store.get(`themes`) as { [key: string]: ThemeDetails } | undefined
}

/**
 * Sets active theme by id
 * @param id of theme
 */
export function setActiveTheme(id: string) {
  saveSelectivePreference('activeTheme', id, false)
}

/**
 * Sets song view to active
 * @param menu to be set active
 */
export function setSongView(menu: songMenu) {
  saveSelectivePreference('songView', menu, false)
}

/**
 * Gets active song view
 * @returns song view if active otherwise compact
 */
export function getSongView(): songMenu {
  return loadSelectivePreference('songView', false, 'compact' as songMenu) ?? 'compact'
}

const defaultTheme: ThemeDetails = {
  id: 'default',
  name: 'Default',
  author: 'Moosync',
  theme: {
    primary: '#212121',
    secondary: '#282828',
    tertiary: '#151515',
    textPrimary: '#ffffff',
    textSecondary: '#565656',
    textInverse: '#000000',
    accent: '#65CB88',
    divider: 'rgba(79, 79, 79, 0.67)'
  }
}

/**
 * Gets active theme
 * @returns details of active theme if exists otherwise undefined
 */
export function getActiveTheme(): ThemeDetails {
  const id = loadSelectivePreference('activeTheme', false) as string
  return id ? loadTheme(id) ?? defaultTheme : defaultTheme
}

export async function setupSystemThemes() {
  const themes: { [key: string]: ThemeDetails } = {}

  const systemThemeHandler = new SystemThemeHandler()
  if (process.platform === 'linux') {
    const theme = await systemThemeHandler.getLinuxStyle()
    if (theme) {
      themes[theme.id] = theme
    }
  }

  if (process.platform === 'win32') {
    const theme = await systemThemeHandler.getWindowsStyle()
    if (theme) {
      themes[theme.id] = theme
    }
  }

  for (const key in themes) {
    saveTheme(themes[key])
  }
}

/**
 * Setups default themes
 */
export function setupDefaultThemes() {
  const themes: { [key: string]: ThemeDetails } = {
    '809b7310-f852-11eb-82e2-0985b6365ce4': {
      id: '809b7310-f852-11eb-82e2-0985b6365ce4',
      name: 'Fluid',
      author: 'Androbuddy',
      theme: {
        primary: '#202125',
        secondary: '#2D2F36',
        tertiary: '#27292E',
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.32)',
        textInverse: '#000000',
        accent: '#72BBFF',
        divider: 'rgba(79, 79, 79, 0.67)'
      }
    }
  }

  for (const key in themes) {
    if (!store.has(`themes.${key}`)) {
      saveTheme(themes[key])
    }
  }
}

export async function transformCSS(cssPath: string, root?: string) {
  if (root) {
    cssPath = path.resolve(root, cssPath)
  }
  await fsP.access(cssPath)

  let css = await fsP.readFile(cssPath, { encoding: 'utf-8' })

  const match = css.matchAll(new RegExp('@import', 'g'))
  for (const m of match) {
    const line = m.input
    if (line) {
      const importPath = line?.match(/(["'])((\\{2})*|(.*?[^\\](\\{2})*))\1/)
      if (importPath) {
        const imported = await transformCSS(importPath[2], path.dirname(cssPath))
        css = css.replaceAll(line, imported)
      }
    }
  }

  return css
}
