/*
 *  SongListMixin.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { Component, Prop, Vue, Ref } from 'vue-property-decorator'
import { bus } from '@/mainWindow/main'
import { HotkeyEvents } from '@/utils/commonConstants'
import RecycleScroller from 'vue-virtual-scroller'

@Component
export default class SongListMixin extends Vue {
  private lastSelect = ''
  selected: number[] = []

  @Ref('scroller')
  scroller!: typeof RecycleScroller

  @Prop({ default: () => [] })
  songList!: Song[]

  songsPerRow = 1

  // Clear selection after table loses focus
  clearSelection() {
    this.$emit('onRowSelectionClear')
    this.selected = []
  }

  selectAll() {
    this.selected = Array.from({ length: this.songList.length }, (_, i) => i)
  }

  onMove(action: HotkeyEvents) {
    console.info('onMove ' + action)
    let sel = 0
    if (this.selected.length > 0) {
      sel = this.selected[0]
      switch (action) {
        case HotkeyEvents.TOP:
          if (sel - this.songsPerRow >= 0) {
            sel -= 1 * this.songsPerRow
          }
          break
        case HotkeyEvents.BOTTOM:
          if (sel + this.songsPerRow < this.songList.length) {
            sel += 1 * this.songsPerRow
          }
          break
        case HotkeyEvents.LEFT:
          if (sel % this.songsPerRow > 0) {
            sel -= 1
          }
          break
        case HotkeyEvents.RIGHT:
          if (sel % this.songsPerRow < this.songsPerRow - 1 && sel + 1 < this.songList.length) {
            sel += 1
          }
          break
      }
    }
    this.selected = [sel]
    this.scrollToItem(sel)
    // notify components that a song has been selected
    this.$emit(
      'onRowSelected',
      this.selected.map((val) => this.songList[val])
    )
  }

  scrollToItem(index: number) {
    let scrollDistance
    if (this.scroller.itemSize === null) {
      scrollDistance = index > 0 ? this.scroller.sizes[index - 1].accumulator : 0
    } else {
      scrollDistance = Math.floor(index / (this.scroller.gridItems | 1)) * this.scroller.itemSize
    }

    const viewport = this.scroller.$el
    // always vertical direction ?
    if (scrollDistance < viewport.scrollTop) {
      this.scroller.scrollToPosition(scrollDistance)
    } else if (scrollDistance + this.scroller.itemSize > viewport.clientHeight + viewport.scrollTop) {
      this.scroller.scrollToPosition(scrollDistance + this.scroller.itemSize - viewport.clientHeight)
    }
  }

  onRowSelected(index: number, keyPressed: 'Control' | 'Shift' | undefined) {
    if (keyPressed === 'Control') {
      const i = this.selected.findIndex((val) => val === index)
      if (i === -1) {
        this.selected.push(index)
      } else {
        this.selected.splice(i, 1)
      }
    } else if (keyPressed === 'Shift') {
      if (this.selected.length > 0) {
        const lastSelected = this.selected[0]
        const min = Math.min(lastSelected, index)
        const max = Math.max(lastSelected, index)
        this.selected = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      }
    } else {
      this.selected = [index]
    }
    this.$emit(
      'onRowSelected',
      this.selected.map((val) => this.songList[val])
    )
  }

  playNowSelection() {
    this.selected.map((val) => this.$emit('onRowPlayNowClicked', this.songList[val]))
  }

  queueSelection() {
    this.selected.map((val) => this.$emit('onRowDoubleClicked', this.songList[val]))
  }

  mounted() {
    bus.$on('onMove', (direction: number) => {
      this.onMove(direction)
    })
    bus.$on('onSelectAll', () => {
      this.selectAll()
    })
    bus.$on('onPlayNowSelection', () => {
      this.playNowSelection()
    })
    bus.$on('onQueueSelection', () => {
      this.queueSelection()
    })
  }
}
