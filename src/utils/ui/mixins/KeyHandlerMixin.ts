/*
 *  ContextMenuMixin.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { Component } from 'vue-property-decorator'
import PlayerControls from '@/utils/ui/mixins/PlayerControls'
import { mixins } from 'vue-class-component'
import { bus } from '@/mainWindow/main'
import { defaultKeybinds, HotkeyEvents } from '@/utils/commonConstants'

@Component
export default class KeyHandlerMixin extends mixins(PlayerControls) {
  private pressedKeys: Record<string, boolean> = {}

  private keyboardHotKeyMap: readonly HotkeyPair[] = []

  async created() {
    this.keyboardHotKeyMap = Object.freeze(
      await window.PreferenceUtils.loadSelective('hotkeys', false, defaultKeybinds)
    )

    console.log(this.keyboardHotKeyMap)
  }

  private onlyRequiredKeysPressed(requiredKeys: string[]) {
    return JSON.stringify(Object.keys(this.pressedKeys)) === JSON.stringify(requiredKeys)
  }

  private performAction(action: HotkeyEvents) {
    switch (action) {
      case HotkeyEvents.PLAY:
        this.play()
        break
      case HotkeyEvents.PAUSE:
        this.pause()
        break
      case HotkeyEvents.PLAY_TOGGLE:
        this.togglePlay()
        break
      case HotkeyEvents.VOLUME_INC:
        this.volume += 5
        break
      case HotkeyEvents.VOLUME_DEC:
        this.volume -= 5
        break
      case HotkeyEvents.MUTE_TOGGLE:
        this.muteToggle()
        break
      case HotkeyEvents.MUTE_ACTIVE:
        this.mute()
        break
      case HotkeyEvents.MUTE_INACTIVE:
        this.unmute()
        break
      case HotkeyEvents.REPEAT_ACTIVE:
        this.repeat = true
        break
      case HotkeyEvents.REPEAT_INACTIVE:
        this.repeat = false
        break
      case HotkeyEvents.REPEAT_TOGGLE:
        this.toggleRepeat()
        break
      case HotkeyEvents.RELOAD_PAGE:
        location.reload()
        break
      case HotkeyEvents.DEVTOOLS_TOGGLE:
        window.WindowUtils.toggleDevTools(true)
        break
      case HotkeyEvents.HELP:
        window.WindowUtils.openExternal('https://github.com/Moosync/Moosync#readme')
        break
      case HotkeyEvents.QUEUE_CLOSE:
        bus.$emit('onToggleSlider', false)
        break
      case HotkeyEvents.QUEUE_OPEN:
        bus.$emit('onToggleSlider', true)
        break
      case HotkeyEvents.QUEUE_TOGGLE:
        bus.$emit('onToggleSlider')
        break
      case HotkeyEvents.FULLSCREEN:
        window.WindowUtils.toggleFullscreen(true)
        break
    }
  }

  private isHotkeyActive() {
    for (const combinations of this.keyboardHotKeyMap) {
      for (const key of combinations.key) {
        if (this.onlyRequiredKeysPressed(key)) {
          this.performAction(combinations.value)
        }
      }
    }
  }

  protected registerKeyboardHotkeys() {
    document.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        this.pressedKeys[e.code] = true
        this.isHotkeyActive()
      }
    })

    document.addEventListener('keyup', (e) => {
      delete this.pressedKeys[e.code]
    })

    document.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        this.pressedKeys[`Mouse${e.button}`] = true
        this.isHotkeyActive()
      }
    })

    document.addEventListener('mouseup', (e) => {
      delete this.pressedKeys[`Mouse${e.button}`]
    })
  }
}
