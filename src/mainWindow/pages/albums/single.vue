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
      :songList="filteredSongList"
      :detailsButtonGroup="buttonGroups"
      :isRemote="isRemote"
      :isLoading="isLoading"
      @playAll="playAlbum"
      @addToQueue="addAlbumToQueue"
      @onOptionalProviderChanged="onAlbumProviderChanged"
      :optionalProviders="albumSongProviders"
      @playRandom="playRandom"
    />
  </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator'
import SongView from '@/mainWindow/components/songView/SongView.vue'

import { mixins } from 'vue-class-component'
import ContextMenuMixin from '@/utils/ui/mixins/ContextMenuMixin'
import { vxm } from '@/mainWindow/store'
import PlayerControls from '@/utils/ui/mixins/PlayerControls'
import RemoteSong from '@/utils/ui/mixins/remoteSongMixin'
import Vue from 'vue'
import ProviderMixin from '@/utils/ui/mixins/ProviderMixin'
import { GenericProvider } from '@/utils/ui/providers/generics/genericProvider'
import { ProviderScopes } from '@/utils/commonConstants'
import { getRandomFromArray } from '@/utils/common'

@Component({
  components: {
    SongView
  }
})
export default class SingleAlbumView extends mixins(ContextMenuMixin, PlayerControls, RemoteSong, ProviderMixin) {
  private album: Album | null = null
  private songList: Song[] = []
  private optionalSongList: Record<string, string[]> = {}

  private loadingMap: Record<string, boolean> = {}

  private activeProviders: Record<string, boolean> = {
    local: true
  }

  get isLoading() {
    return Object.values(this.loadingMap).includes(true)
  }

  // TODO: Find some better method to check if song is remote
  private isRemote(songs: Song[]) {
    for (const s of songs) {
      for (const op of Object.values(this.optionalSongList)) {
        if (op.findIndex((val) => s._id === val) !== -1) {
          return true
        }
      }
    }
    return false
  }

  private fetchProviders() {
    const providers = this.getProvidersByScope(ProviderScopes.ALBUM_SONGS)
    return providers.map((val) => ({
      key: val.key,
      title: val.Title
    }))
  }

  // TODO: Separate pageToken for each provider
  private nextPageToken?: unknown

  private get albumSongProviders(): TabCarouselItem[] {
    return this.fetchProviders()
  }

  get buttonGroups(): SongDetailButtons {
    return {
      enableContainer: true,
      enableLibraryStore: this.hasRemoteSongs,
      playRandom: this.songList.length > 150
    }
  }

  get defaultDetails(): SongDetailDefaults {
    return {
      defaultTitle: this.album?.album_name,
      defaultSubtitle: this.album?.album_artist,
      defaultSubSubtitle: this.$tc('songView.details.songCount', this.filteredSongList.length),
      defaultCover: this.album?.album_coverPath_high
    }
  }

  get filteredSongList() {
    return this.songList.filter((val) => {
      for (const [key, value] of Object.entries(this.activeProviders)) {
        if (this.optionalSongList[key]) {
          if (value) {
            if (this.optionalSongList[key].includes(val._id)) return true
          } else {
            if (!this.optionalSongList[key].includes(val._id)) return true
          }
        }
      }
      return false
    })
  }

  get hasRemoteSongs() {
    return Object.keys(this.activeProviders).some((val) => val !== 'local' && this.activeProviders[val])
  }

  async created() {
    this.fetchAlbum()
    this.fetchAlbumCover()
    this.fetchSongList()

    this.onProvidersChanged(() => this.fetchAlbumCover())
  }

  private fetchAlbum() {
    this.album = {
      album_id: this.$route.query.id as string,
      album_name: this.$route.query.name as string,
      album_coverPath_high: this.$route.query.cover_high as string,
      album_coverPath_low: this.$route.query.cover_low as string,
      album_artist: this.$route.query.album_artist as string,
      year: parseInt(this.$route.query.year as string)
    }
  }

  private async fetchAlbumCover() {
    if (this.album) {
      if (!(this.album.album_coverPath_high ?? this.album.album_coverPath_low) && this.album.album_name) {
        const providers = this.getProvidersByScope(ProviderScopes.SEARCH_ALBUM)
        for (const p of providers) {
          const res = (await p.searchAlbum(this.album.album_name))[0]
          if (res) {
            this.album.album_coverPath_high = res.album_coverPath_high
            this.album.album_coverPath_low = res.album_coverPath_low

            window.DBUtils.updateAlbum({
              ...this.album,
              album_coverPath_high: res.album_coverPath_high,
              album_coverPath_low: res.album_coverPath_low,
              album_extra_info: res.album_extra_info
            })

            return
          }
        }
      }
    }
  }

  private async fetchSongList() {
    Vue.set(this.loadingMap, 'local', true)
    this.songList = await window.SearchUtils.searchSongsByOptions({
      album: {
        album_id: this.$route.query.id as string
      },
      sortBy: vxm.themes.songSortBy
    })
    Vue.set(
      this.optionalSongList,
      'local',
      this.songList.map((val) => val._id)
    )
    Vue.set(this.loadingMap, 'local', false)
  }

  private playAlbum() {
    this.playTop(this.songList)
  }

  private addAlbumToQueue() {
    this.queueSong(this.songList)
  }

  private async playRandom() {
    const randomSongs = getRandomFromArray(this.songList, 100)
    this.queueSong(randomSongs)
  }

  private async fetchProviderSongs(provider: GenericProvider) {
    Vue.set(this.loadingMap, provider.key, true)
    if (this.album) {
      for await (const items of provider.getAlbumSongs(this.album, this.nextPageToken)) {
        this.nextPageToken = items.nextPageToken

        for (const s of items.songs) {
          if (!this.songList.find((val) => val._id === s._id)) {
            this.songList.push(s)

            if (!this.optionalSongList[provider.key]) {
              this.optionalSongList[provider.key] = []
            }

            this.optionalSongList[provider.key].push(s._id)
          }
        }
      }
    }
    Vue.set(this.loadingMap, provider.key, false)
  }

  private onAlbumProviderChanged({ key, checked }: { key: string; checked: boolean }) {
    Vue.set(this.activeProviders, key, checked)
    if (checked) {
      const provider = this.getProviderByKey(key)
      if (provider) {
        this.fetchProviderSongs(provider)
        return
      }
    }
  }
}
</script>
