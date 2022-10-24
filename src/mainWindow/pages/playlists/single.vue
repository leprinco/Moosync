<!-- 
  _id.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<route>
{
  "props": true
}
</route>
<template>
  <div class="w-100 h-100">
    <SongView
      :defaultDetails="defaultDetails"
      :songList="songList"
      :detailsButtonGroup="buttonGroups"
      :isLoading="isLoading"
      :isRemote="isRemote"
      :onSongContextMenuOverride="onSongContextMenuOverride"
      @playAll="playPlaylist"
      @addToQueue="addPlaylistToQueue"
      @addToLibrary="addPlaylistToLibrary"
      @onScrollEnd="loadNextPage"
      @onSearchChange="onSearchChange"
      @playRandom="playRandom"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop } from 'vue-property-decorator'
import SongView from '@/mainWindow/components/songView/SongView.vue'

import { mixins } from 'vue-class-component'
import ContextMenuMixin from '@/utils/ui/mixins/ContextMenuMixin'
import { vxm } from '@/mainWindow/store'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'
import ProviderMixin from '@/utils/ui/mixins/ProviderMixin'
import { ProviderScopes } from '@/utils/commonConstants'
import { GenericProvider } from '@/utils/ui/providers/generics/genericProvider'
import { arrayDiff, getRandomFromArray } from '@/utils/common'

@Component({
  components: {
    SongView
  }
})
export default class SinglePlaylistView extends mixins(ContextMenuMixin, ProviderMixin) {
  @Prop({ default: () => () => undefined })
  private enableRefresh!: () => void

  private songList: Song[] = []

  private isLoading = false
  private isAddedInLibrary = false

  private invalidateCache = false

  private providers = this.getProvidersByScope(ProviderScopes.PLAYLIST_SONGS)

  private getPlaylistOwnerProvider() {
    if (this.playlist?.playlist_id) {
      for (const p of this.providers) {
        if (p.matchEntityId(this.playlist?.playlist_id)) {
          return p
        }
      }
    }
  }

  get buttonGroups(): SongDetailButtons {
    return {
      enableContainer: true,
      enableLibraryStore: this.isRemote() && !this.isAddedInLibrary,
      playRandom: !!(this.songList.length > 150 || this.nextPageToken)
    }
  }

  get defaultDetails(): SongDetailDefaults {
    return {
      defaultTitle: this.playlist?.playlist_name ?? '',
      defaultSubSubtitle: this.$tc('songView.details.songCount', this.songList.length),
      defaultCover: this.playlist?.playlist_coverPath ?? ''
    }
  }

  private get isYoutube() {
    return (this.$route.query.id as string)?.startsWith('youtube')
  }

  private get isSpotify() {
    return (this.$route.query.id as string)?.startsWith('spotify')
  }

  private get isExtension() {
    return this.$route.query.extension
  }

  private isRemote() {
    return !!(this.isYoutube || this.isSpotify || this.isExtension)
  }

  private async refresh() {
    this.nextPageToken = undefined
    this.songList = []
    await this.fetchSongListAsync()
  }

  async created() {
    this.isAddedInLibrary = !!(
      await window.SearchUtils.searchEntityByOptions<Playlist>({
        playlist: { playlist_id: this.playlist.playlist_id }
      })
    )[0]
    this.refresh()
  }

  mounted() {
    this.enableRefresh()
    this.listenGlobalRefresh()
  }

  private listenGlobalRefresh() {
    bus.$on(EventBus.REFRESH_PAGE, () => {
      this.invalidateCache = true
      this.refresh()
    })
  }

  private get playlist() {
    return {
      playlist_id: this.$route.query.playlist_id as string,
      playlist_name: this.$route.query.playlist_name as string,
      playlist_coverPath: this.$route.query.playlist_coverPath as string,
      playlist_song_count: parseInt(this.$route.query.playlist_song_count as string) ?? 0,
      playlist_path: this.$route.query.playlist_path as string | undefined,
      extension: this.$route.query.extension as string | undefined
    }
  }

  private async fetchLocalSongList() {
    this.isLoading = true
    if (this.playlist) {
      const songs = await window.SearchUtils.searchSongsByOptions({
        playlist: {
          playlist_id: this.playlist.playlist_id as string
        },
        sortBy: vxm.themes.songSortBy
      })

      this.songList.push(...songs.filter((val) => this.songList.findIndex((val2) => val2._id === val._id) === -1))
    }
    this.isLoading = false
  }

  private nextPageToken?: unknown

  private async fetchProvider(provider: GenericProvider) {
    this.isLoading = true
    const generator = provider.getPlaylistContent(
      provider.sanitizeId(this.playlist.playlist_id, 'PLAYLIST'),
      this.invalidateCache,
      this.nextPageToken
    )

    if (generator) {
      for await (const items of generator) {
        const uniqueItems = items.songs.filter((val) => this.songList.findIndex((val2) => val2._id === val._id) === -1)
        this.songList.push(...uniqueItems)
        this.nextPageToken = items.nextPageToken
      }
    }

    this.isLoading = false
  }

  private async fetchSongListAsync() {
    if (this.playlist) {
      await this.fetchLocalSongList()

      const owner = this.getPlaylistOwnerProvider()

      if (owner) {
        await this.fetchProvider(owner)
      }
    }
  }

  private async loadNextPage() {
    if (this.nextPageToken) {
      await this.fetchSongListAsync()
    }
  }

  private isFetching = false

  private async fetchAll(afterFetch?: (songs: Song[]) => void) {
    if (!this.isFetching) {
      this.isFetching = true
      let songListLastSong = this.songList.length - 1

      while (this.nextPageToken) {
        await this.loadNextPage()
        afterFetch && afterFetch(this.songList.slice(songListLastSong))
        songListLastSong = this.songList.length
      }

      this.isFetching = false
    }
  }

  private async playPlaylist() {
    this.playTop(this.songList)
    this.fetchAll(this.queueSong)
  }

  private async addPlaylistToQueue() {
    this.queueSong(this.songList)
    this.fetchAll(this.queueSong)
  }

  private addPlaylistToLibrary() {
    window.DBUtils.createPlaylist(this.playlist)
    this.$toasted.show(`Added ${this.playlist.playlist_name} to library`)
  }

  private onSearchChange() {
    this.fetchAll()
  }

  private async playRandom() {
    await this.fetchAll()
    const randomSongs = getRandomFromArray(this.songList, 100)
    this.queueSong(randomSongs)
  }

  private onSongContextMenuOverride(event: PointerEvent, songs: Song[]) {
    this.getContextMenu(event, {
      type: 'PLAYLIST_SONGS',
      args: {
        playlistId: this.playlist.playlist_id,
        songs,
        isRemote: this.isRemote(),
        refreshCallback: () => this.songList.splice(0, this.songList.length, ...arrayDiff(this.songList, songs))
      }
    })
  }
}
</script>
