<!-- 
  index.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div class="h-100 w-100 parent" @contextmenu="contextHandler">
    <b-container fluid class="album-container">
      <b-row no-gutters class="page-title">
        <b-col cols="auto">{{ $t('pages.playlists') }}</b-col>
        <b-col class="button-grow" @click="newPlaylist" cols="auto"><PlusIcon class="add-icon mb-2" /></b-col>
      </b-row>
      <b-row class="d-flex">
        <b-col col xl="2" md="3" v-for="playlist in allPlaylists" :key="playlist.playlist_id" class="card-col">
          <CardView
            :title="playlist.playlist_name"
            :imgSrc="playlist.playlist_coverPath"
            :id="playlist.playlist_id"
            :iconBgColor="getIconBgColor(playlist)"
            @click.native="gotoPlaylist(playlist)"
            @CardContextMenu="getPlaylistMenu(arguments[0], playlist)"
          >
            <template slot="icon">
              <SpotifyIcon
                v-if="playlist.playlist_id && playlist.playlist_id.startsWith('spotify')"
                color="#07C330"
                :filled="true"
              />
              <YoutubeIcon
                v-if="playlist.playlist_id && playlist.playlist_id.startsWith('youtube')"
                color="#E62017"
                :filled="true"
              />
              <inline-svg v-if="playlist.icon && playlist.icon.endsWith('svg')" :src="playlist.icon" />
              <img
                v-if="playlist.icon && !playlist.icon.endsWith('svg')"
                :src="playlist.icon"
                alt="provider logo"
                referrerPolicy="no-referrer"
              />
            </template>

            <template #defaultCover>
              <PlaylistDefault />
            </template>
          </CardView>
        </b-col>
      </b-row>
      <DeleteModal id="playlistDeleteModal" @confirm="deletePlaylist" />
    </b-container>
  </div>
</template>

<script lang="ts">
import { Component, Prop } from 'vue-property-decorator'
import CardView from '@/mainWindow/components/generic/CardView.vue'
import { mixins } from 'vue-class-component'
import RouterPushes from '@/utils/ui/mixins/RouterPushes'
import ContextMenuMixin from '@/utils/ui/mixins/ContextMenuMixin'
import { vxm } from '@/mainWindow/store'
import SpotifyIcon from '@/icons/SpotifyIcon.vue'
import YoutubeIcon from '@/icons/YoutubeIcon.vue'
import PlaylistDefault from '@/icons/PlaylistDefaultIcon.vue'
import DeleteModal from '../../../commonComponents/ConfirmationModal.vue'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'
import PlusIcon from '@/icons/PlusIcon.vue'
import ProviderMixin from '@/utils/ui/mixins/ProviderMixin'
import { ProviderScopes } from '@/utils/commonConstants'

@Component({
  components: {
    CardView,
    SpotifyIcon,
    YoutubeIcon,
    PlaylistDefault,
    DeleteModal,
    PlusIcon
  }
})
export default class Playlists extends mixins(RouterPushes, ContextMenuMixin, ProviderMixin) {
  @Prop({ default: () => () => undefined })
  private enableRefresh!: () => void

  private allPlaylists: ExtendedPlaylist[] = []

  private playlistInAction: Playlist | undefined

  private get providers() {
    return this.getProvidersByScope(ProviderScopes.PLAYLISTS)
  }

  private getIconBgColor(playlist: Playlist) {
    for (const p of this.getAllProviders()) {
      if (p.matchEntityId(playlist.playlist_id)) {
        return p.BgColor
      }
    }
  }

  private async getPlaylists(invalidateCache = false) {
    const localPlaylists = await window.SearchUtils.searchEntityByOptions<Playlist>({
      playlist: true
    })
    this.allPlaylists = [...localPlaylists]

    const promises: Promise<unknown>[] = []

    for (const p of this.providers) {
      promises.push(p.getUserPlaylists(invalidateCache).then(this.pushPlaylistToList).then(this.sort))
    }

    await Promise.all(promises)
  }

  private pushPlaylistToList(playlists: Playlist[]) {
    for (const p of playlists) {
      if (this.allPlaylists.findIndex((val) => val.playlist_id === p.playlist_id) === -1) {
        this.allPlaylists.push(p)
      }
    }
  }

  private setSort(options: PlaylistSortOptions) {
    vxm.themes.playlistSortBy = options
  }

  private sort() {
    this.allPlaylists.sort((a, b) => {
      switch (vxm.themes.playlistSortBy.type) {
        case 'name':
          return vxm.themes.playlistSortBy.asc
            ? a.playlist_name.localeCompare(b.playlist_name)
            : b.playlist_name.localeCompare(a.playlist_name)
        default:
        case 'provider':
          return vxm.themes.playlistSortBy.asc
            ? a.playlist_id.localeCompare(b.playlist_id)
            : b.playlist_id.localeCompare(a.playlist_id)
      }
    })
  }

  private contextHandler(event: MouseEvent) {
    this.getContextMenu(event, {
      type: 'GENERAL_PLAYLIST',
      args: {
        sort: {
          callback: this.setSort,
          current: vxm.themes.playlistSortBy
        },
        refreshCallback: this.refresh
      }
    })
  }

  private deletePlaylist() {
    if (this.playlistInAction) window.DBUtils.removePlaylist(this.playlistInAction.playlist_id)
    this.refresh()
  }

  private newPlaylist() {
    bus.$emit(EventBus.SHOW_NEW_PLAYLIST_MODAL, [], () => this.refresh())
  }

  mounted() {
    this.enableRefresh()
    this.getPlaylists()
    this.listenGlobalRefresh()

    vxm.themes.$watch('playlistSortBy', this.sort)
  }

  private refresh(invalidateCache = false) {
    this.getPlaylists(invalidateCache).then(() => (vxm.playlist.updated = true))
  }

  private listenGlobalRefresh() {
    bus.$on(EventBus.REFRESH_PAGE, () => {
      this.refresh(true)
    })
  }

  private getPlaylistMenu(event: Event, playlist: Playlist) {
    this.playlistInAction = playlist
    this.getContextMenu(event, {
      type: 'PLAYLIST',
      args: { playlist: playlist, deleteCallback: () => this.$bvModal.show('playlistDeleteModal') }
    })
  }
}
</script>

<style lang="sass" scoped>
.title
  font-weight: bold
  font-size: 55px
  margin-left: 15px
  margin-bottom: 50px
  margin-top: 20px

.add-icon
  width: 20px
  height: 20px
  margin-left: 15px
</style>
