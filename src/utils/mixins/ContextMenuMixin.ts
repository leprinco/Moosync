import { Component } from 'vue-property-decorator'
import { EventBus } from '@/utils/ipc/main/constants'
import { MenuItem } from 'vue-context-menu-popup'
import PlayerControls from '@/utils/mixins/PlayerControls'
import { Song } from '@/models/songs'
import { bus } from '@/mainWindow/main'
import { mixins } from 'vue-class-component'
import { YoutubeItem } from '@/models/youtube'
import { toSong } from '@/models/youtube'
import { vxm } from '@/mainWindow/store'
import { Playlist } from '@/models/playlists'

@Component
export default class ContextMenuMixin extends mixins(PlayerControls) {
  get playlists() {
    return vxm.playlist.playlists
  }

  private async addToPlaylist(playlist_id: string, songs: Song[]) {
    window.DBUtils.addToPlaylist(playlist_id, ...songs)
  }

  private populatePlaylistMenu(item: Song[], exclude?: string): MenuItem[] {
    const menu: MenuItem[] = [
      {
        label: 'Create Playlist',
        handler: () => {
          bus.$emit(EventBus.SHOW_NEW_PLAYLIST_MODAL, item)
        }
      },
    ]
    for (const [key, val] of Object.entries(this.playlists)) {
      if (key == exclude) {
        continue
      }
      menu.push({
        label: val,
        handler: () => {
          this.addToPlaylist(key, item)
        },
      })
    }
    return menu
  }

  public getSongContextMenu(exclude: string | undefined, event: Event, ...item: Song[]) {
    const items = [
      {
        label: 'Play Now',
        handler: () => {
          this.playTop(...item)
        },
      },
      {
        label: 'Add To Queue',
        handler: () => {
          this.queueSong(...item)
        },
      },
      {
        label: 'Add To Playlist',
        children: this.populatePlaylistMenu(item, exclude),
      },
    ]
    bus.$emit(EventBus.SHOW_CONTEXT, event, items)
  }

  public getYoutubeContextMenu(event: Event, ...item: YoutubeItem[]) {
    const items = [
      {
        label: 'Play Now',
        handler: () => {
          this.playTop(...toSong(...item))
        },
      },
      {
        label: 'Add To Queue',
        handler: () => {
          this.queueSong(...toSong(...item))
        },
      },
      {
        label: 'Add To Library',
        handler: () => window.DBUtils.storeSongs(toSong(...item)),
      },
      {
        label: 'Add To Playlist',
        children: this.populatePlaylistMenu(toSong(...item)),
      },
    ]
    bus.$emit(EventBus.SHOW_CONTEXT, event, items)
  }

  public getPlaylistContextMenu(event: Event, playlist: Playlist, refreshCallback: () => void) {
    const items = [
      {
        label: 'Remove Playlist',
        handler: () => {
          window.DBUtils.removePlaylist(playlist.playlist_id)
          refreshCallback()
        },
      }
    ]
    bus.$emit(EventBus.SHOW_CONTEXT, event, items)
  }

  public getGeneralPlaylistMenu(event: Event) {
    const items = [
      {
        label: 'Add Playlist from URL',
        handler: () => {
          bus.$emit(EventBus.SHOW_ADD_PLAYLIST_MODAL)
        },
      }
    ]
    bus.$emit(EventBus.SHOW_CONTEXT, event, items)
  }
}
