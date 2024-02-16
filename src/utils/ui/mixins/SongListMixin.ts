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
import RecycleScroller from 'vue-virtual-scroller'
import { KeyboardNavigation } from './KeyboardNavigation'

@Component
export default class SongListMixin extends Vue {
  @Ref('scroller')
  scroller!: typeof RecycleScroller

  // manage selection and react to mouse/keyboard events
  keyboardNavigation!: KeyboardNavigation

  @Prop({ default: () => [] })
  songList!: Song[]

  // notify components that a song has been selected
  onRowSelectedCallback(selected: number[]) {
    console.info('songListMixin.callback')
    this.$emit(
      'onRowSelected',
      selected.map((val) => this.songList[val])
    )
  }

  selected() {
    return this.keyboardNavigation.selection()
  }

  isSelectedIndex(index: number) {
    return this.selected().includes(index)
  }

  // Clear selection after table loses focus
  clearSelection() {
    this.keyboardNavigation.clearSelection()
    this.$emit('onRowSelectionClear')
  }

  selectAll() {
    this.keyboardNavigation.selectAll()
  }

  // triggered by click event on items
  onRowSelected(index: number, keyPressed: 'Control' | 'Shift' | undefined) {
    this.keyboardNavigation.selectIndex(index, keyPressed)
  }

  playNowSelection() {
    this.selected().map((val) => this.$emit('onRowPlayNowClicked', this.songList[val]))
  }

  queueSelection() {
    this.selected().map((val) => this.$emit('onRowDoubleClicked', this.songList[val]))
  }

  mounted() {
    if (this.keyboardNavigation == null) {
      this.keyboardNavigation = new KeyboardNavigation(this.scroller, this.onRowSelectedCallback)
    }
    bus.$emit('activateKeyboardNavigation', this.keyboardNavigation)

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
