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

const enum HotkeyEvents {
  PLAY,
  PAUSE,
  PLAY_TOGGLE,
  MUTE_ACTIVE,
  MUTE_INACTIVE,
  MUTE_TOGGLE,
  VOLUME_INC,
  VOLUME_DEC,
  REPEAT_ACTIVE,
  REPEAT_INACTIVE,
  REPEAT_TOGGLE,
  RELOAD_PAGE,
  DEVTOOLS_TOGGLE,
  HELP
}

type HotkeyPair = {
  key: KeyboardEvent['code'][][]
  value: HotkeyEvents
}

@Component
export default class KeyHandlerMixin extends mixins(PlayerControls) {
  private pressedKeys: Record<string, boolean> = {}

  private keyboardHotKeyMap: readonly HotkeyPair[] = Object.freeze([
    {
      key: [['Space']],
      value: HotkeyEvents.PLAY_TOGGLE
    },
    {
      key: [['ShiftLeft', 'Equal'], ['NumpadAdd']],
      value: HotkeyEvents.VOLUME_INC
    },
    {
      key: [['NumpadSubtract'], ['Minus']],
      value: HotkeyEvents.VOLUME_DEC
    },
    {
      key: [['KeyM']],
      value: HotkeyEvents.MUTE_TOGGLE
    },
    {
      key: [['KeyR']],
      value: HotkeyEvents.REPEAT_TOGGLE
    },
    {
      key: [['F5']],
      value: HotkeyEvents.RELOAD_PAGE
    },
    {
      key: [['F11']],
      value: HotkeyEvents.DEVTOOLS_TOGGLE
    },
    {
      key: [['F1']],
      value: HotkeyEvents.HELP
    }
  ])

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
      this.pressedKeys[e.code] = true
      this.isHotkeyActive()
    })

    document.addEventListener('keyup', (e) => {
      delete this.pressedKeys[e.code]
    })

    document.addEventListener('mousedown', (e) => {
      this.pressedKeys[`Mouse${e.button}`] = true
      this.isHotkeyActive()
    })

    document.addEventListener('mouseup', (e) => {
      delete this.pressedKeys[`Mouse${e.button}`]
    })
  }
}
