<!-- 
  SongView.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <b-container fluid class="song-container h-100" @contextmenu="onGeneralContextMenu">
    <transition
      name="custom-classes-transition"
      enter-active-class="animate__animated animate__slideInLeft animate__delay-1s animate__slideInLeft_delay"
      leave-active-class="animate__animated animate__slideOutRight animate__slideOutRight_faster"
    >
      <component
        v-bind:is="songView"
        :songList="filteredSongList"
        :currentSong="currentSong"
        :defaultDetails="defaultDetails"
        :detailsButtonGroup="detailsButtonGroup"
        :optionalProviders="optionalProviders"
        :isLoading="isLoading"
        @onItemsChanged="onOptionalProviderChanged"
        @onRowDoubleClicked="queueSong([arguments[0]])"
        @onRowContext="onSongContextMenu"
        @onRowSelected="updateCoverDetails"
        @onRowSelectionClear="clearSelection"
        @onRowPlayNowClicked="playTop([arguments[0]])"
        @onArtistClicked="gotoArtist"
        @onAlbumClicked="gotoAlbum"
        @playAll="playAll"
        @addToQueue="addToQueue"
        @addToLibrary="addToLibrary"
        @onSortClicked="showSortMenu"
        @onSearchChange="onSearchChange"
        @playRandom="playRandom"
        @scroll="onScroll"
      ></component>
    </transition>
  </b-container>
</template>

<script lang="ts">
import { Component, Prop, Watch } from 'vue-property-decorator'
import { mixins } from 'vue-class-component'
import PlayerControls from '@/utils/ui/mixins/PlayerControls'
import ModelHelper from '@/utils/ui/mixins/ModelHelper'
import RemoteSong from '@/utils/ui/mixins/remoteSongMixin'
import ImgLoader from '@/utils/ui/mixins/ImageLoader'
import { vxm } from '@/mainWindow/store'
import SongViewClassic from '@/mainWindow/components/songView/components/SongViewClassic.vue'
import SongViewCompact from '@/mainWindow/components/songView/components/SongViewCompact.vue'
import { arrayDiff, sortSongList } from '@/utils/common'
import RouterPushes from '@/utils/ui/mixins/RouterPushes'
import ContextMenuMixin from '@/utils/ui/mixins/ContextMenuMixin'

@Component({
  components: {
    SongViewClassic,
    SongViewCompact
  }
})
export default class AllSongs extends mixins(
  PlayerControls,
  ModelHelper,
  RemoteSong,
  ImgLoader,
  RouterPushes,
  ContextMenuMixin
) {
  @Prop({ default: () => [] })
  private songList!: Song[]

  private ignoreSort = false

  @Prop({ default: false })
  private isLoading!: boolean

  @Prop({ default: () => [] })
  private optionalProviders!: TabCarouselItem[]

  @Prop()
  private afterSongAddRefreshCallback!: ((showHidden?: boolean) => void) | undefined

  @Prop()
  private isRemote!: ((songs: Song[]) => boolean) | undefined

  private searchText = ''

  private get filteredSongList(): Song[] {
    let songList = this.songList.filter((val) => !!val.title.match(new RegExp(this.searchText, 'i')))
    songList = vxm.themes.songSortBy && sortSongList(songList, vxm.themes.songSortBy)
    return songList
  }

  @Watch('songList', { immediate: true })
  private async onSongListChanged(newVal: Song[], oldVal: Song[]) {
    const difference = newVal.filter((x) => {
      return (oldVal ?? []).findIndex((val) => val._id === x._id) === -1
    })

    const playCounts = await window.SearchUtils.getPlayCount(...difference.map((val) => val._id))
    for (const song of difference) {
      this.$set(song, 'playCount', playCounts[song._id] ?? 0)
    }
  }

  private get songView() {
    return vxm.themes.songView === 'compact' ? 'SongViewCompact' : 'SongViewClassic'
  }

  private selected: Song[] | null = null
  private selectedCopy: Song[] | null = null

  private currentSong: Song | null | undefined = null

  @Prop({
    default: () => {
      return { defaultTitle: '', defaultSubtitle: '', defaultCover: '' }
    }
  })
  private defaultDetails!: SongDetailDefaults

  @Prop({
    default: () => {
      return {
        enableContainer: false,
        enableLibraryStore: false,
        playRandom: false
      }
    }
  })
  private detailsButtonGroup!: SongDetailButtons

  @Prop({ default: null })
  private onSongContextMenuOverride!: ((event: PointerEvent, songs: Song[]) => void) | null

  @Prop({ default: null })
  private onGeneralSongContextMenuOverride!: ((event: PointerEvent) => void) | null

  private clearSelection() {
    this.currentSong = null
    this.selected = this.selectedCopy
    this.selectedCopy = null
  }

  private updateCoverDetails(items: Song[]) {
    if (items) this.currentSong = items[items.length - 1]
    this.selected = items
    this.selectedCopy = items
  }

  private sort(options: SongSortOptions) {
    vxm.themes.songSortBy = options
  }

  private onSongContextMenu(event: PointerEvent, songs: Song[]) {
    if (this.onSongContextMenuOverride) {
      this.onSongContextMenuOverride(event, songs)
    } else {
      this.getContextMenu(event, {
        type: 'SONGS',
        args: {
          songs,
          isRemote: typeof this.isRemote === 'function' && this.isRemote(songs),
          refreshCallback: () => this.songList.splice(0, this.songList.length, ...arrayDiff(this.songList, songs))
        }
      })
    }
  }

  private showSortMenu(event: Event) {
    this.getContextMenu(event, {
      type: 'SONG_SORT',
      args: {
        sortOptions: { callback: this.sort, current: vxm.themes.songSortBy }
      }
    })
  }

  private onGeneralContextMenu(event: PointerEvent) {
    if (this.onGeneralSongContextMenuOverride) {
      this.onGeneralSongContextMenuOverride(event)
    } else {
      this.getContextMenu(event, {
        type: 'GENERAL_SONGS',
        args: {
          refreshCallback: this.afterSongAddRefreshCallback,
          sortOptions: {
            callback: (options) => (vxm.themes.songSortBy = options),
            current: vxm.themes.songSortBy
          }
        }
      })
    }
  }

  private playAll() {
    if (this.selected) {
      this.playTop(this.selected)
      this.selected = this.selectedCopy
      return
    }
    this.$emit('playAll')
  }

  private addToQueue() {
    if (this.selected) {
      this.queueSong(this.selected)
      this.selected = this.selectedCopy
      return
    }
    this.$emit('addToQueue')
  }

  private addToLibrary() {
    if (this.selected) {
      this.addSongsToLibrary(...this.selected)
      this.selected = this.selectedCopy
      return
    }
    this.$emit('addToLibrary')
  }

  private playRandom() {
    this.$emit('playRandom')
  }

  private onOptionalProviderChanged(...args: unknown[]) {
    this.$emit('onOptionalProviderChanged', ...args)
  }

  private onSearchChange(text: string) {
    this.searchText = text
    this.$emit('onSearchChange', text)
  }

  private onScroll(e: MouseEvent) {
    const { scrollTop, clientHeight, scrollHeight } = e.target as HTMLDivElement
    if (scrollTop + clientHeight >= scrollHeight - 1) {
      this.$emit('onScrollEnd')
    }
  }
}
</script>

<style lang="sass" scoped>
.song-container
  padding-top: 10px
  overflow: hidden

.compact-container
  padding-top: 25px

.song-list-compact
  padding-right: 30px
</style>
