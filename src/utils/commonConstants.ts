export enum InvidiousApiResources {
  PLAYLISTS = 'auth/playlists',
  PLAYLIST_ITEMS = 'playlists/{playlist_id}',
  VIDEO_DETAILS = 'videos/{video_id}',
  TRENDING = 'trending',
  SEARCH = 'search',
  STATS = 'stats'
}

export enum HotkeyEvents {
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
  QUEUE_OPEN,
  QUEUE_CLOSE,
  QUEUE_TOGGLE,
  RELOAD_PAGE,
  DEVTOOLS_TOGGLE,
  HELP
}

export const HotKeyEventsExtras: Record<HotkeyEvents, { title: string }> = {
  [HotkeyEvents.PLAY]: {
    title: 'Play song'
  },
  [HotkeyEvents.PAUSE]: {
    title: 'Pause song'
  },
  [HotkeyEvents.PLAY_TOGGLE]: {
    title: 'Toggle play'
  },
  [HotkeyEvents.MUTE_ACTIVE]: {
    title: 'Mute'
  },
  [HotkeyEvents.MUTE_INACTIVE]: {
    title: 'Unmute'
  },
  [HotkeyEvents.MUTE_TOGGLE]: {
    title: 'Toggle mute'
  },
  [HotkeyEvents.VOLUME_INC]: {
    title: 'Increase volume'
  },
  [HotkeyEvents.VOLUME_DEC]: {
    title: 'Decrease volume'
  },
  [HotkeyEvents.REPEAT_ACTIVE]: {
    title: 'Repeat song'
  },
  [HotkeyEvents.REPEAT_INACTIVE]: {
    title: 'Disable repeat'
  },
  [HotkeyEvents.REPEAT_TOGGLE]: {
    title: 'Toggle repeat'
  },
  [HotkeyEvents.QUEUE_OPEN]: {
    title: 'Open song queue'
  },
  [HotkeyEvents.QUEUE_CLOSE]: {
    title: 'Close song queue'
  },
  [HotkeyEvents.QUEUE_TOGGLE]: {
    title: 'Toggle song queue'
  },
  [HotkeyEvents.RELOAD_PAGE]: {
    title: 'Reload page'
  },
  [HotkeyEvents.DEVTOOLS_TOGGLE]: {
    title: 'Toggle dev-tools'
  },
  [HotkeyEvents.HELP]: {
    title: 'Open help'
  }
}

export const defaultKeybinds: HotkeyPair[] = [
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
  },
  {
    key: [['Escape']],
    value: HotkeyEvents.QUEUE_CLOSE
  }
]
