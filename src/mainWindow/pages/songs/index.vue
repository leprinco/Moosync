<!-- 
  index.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div class="w-100 h-100" @contextmenu="getGeneralSongsMenu">
    <SongView
      :detailsButtonGroup="buttonGroups"
      :defaultDetails="defaultDetails"
      :songList="songList"
      :afterSongAddRefreshCallback="requestSongs"
      :onGeneralSongContextMenuOverride="getGeneralSongsMenu"
      @playAll="playSongs"
      @addToQueue="addSongsToQueue"
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
import { getRandomFromArray } from '@/utils/common'

@Component({
  components: {
    SongView
  }
})
export default class AllSongs extends mixins(ContextMenuMixin) {
  songList: Song[] = []
  currentSong: Song | null | undefined = null

  get playlists() {
    return vxm.playlist.playlists
  }

  get buttonGroups(): SongDetailButtons {
    return {
      enableContainer: true,
      enableLibraryStore: false,
      playRandom: this.songList.length > 150
    }
  }

  get defaultDetails(): SongDetailDefaults {
    return {
      defaultTitle: this.$tc('songView.details.songCount', this.songList.length)
    }
  }

  mounted() {
    this.requestSongs()
  }

  async requestSongs(showHidden = false) {
    this.songList = await window.SearchUtils.searchSongsByOptions({
      sortBy: vxm.themes.songSortBy,
      song: {
        showInLibrary: !showHidden
      }
    })
    this.showingHidden = showHidden
  }

  private sort(options: SongSortOptions[]) {
    vxm.themes.songSortBy = options
  }

  private showingHidden = false

  getGeneralSongsMenu(event: Event) {
    event.stopPropagation()
    event.preventDefault()
    this.getContextMenu(event, {
      type: 'GENERAL_SONGS',
      args: {
        refreshCallback: this.requestSongs,
        showHiddenToggle: true,
        isShowingHidden: this.showingHidden,
        sortOptions: {
          callback: this.sort,
          current: vxm.themes.songSortBy
        }
      }
    })
  }

  playSongs() {
    this.playTop(this.songList)
  }

  addSongsToQueue() {
    this.queueSong(this.songList)
  }

  async playRandom() {
    const randomSongs = getRandomFromArray(this.songList, 100)
    this.queueSong(randomSongs)
  }
}
</script>
