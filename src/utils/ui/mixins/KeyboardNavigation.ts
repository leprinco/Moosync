/*
 *  KeyboardNavigation.ts is a part of Moosync.
 *
 *  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { HotkeyEvents } from '@/utils/commonConstants'
import { Ref, ref } from 'vue'
import RecycleScroller from 'vue-virtual-scroller'

export class KeyboardNavigation {
  private scroller: typeof RecycleScroller

  private callback!: (selection: number[]) => void

  private lastSelect = ''

  selected: Ref<number[]> = ref([])

  constructor(scroller: typeof RecycleScroller, callback: (selection: number[]) => void) {
    this.scroller = scroller
    this.callback = callback
  }

  selection() {
    return this.selected.value
  }

  clearSelection() {
    this.selected.value = []
  }

  selectAll() {
    this.selected.value = Array.from({ length: this.scroller.items.length }, (_, i) => i)
  }

  selectIndex(index: number, keyPressed: 'Control' | 'Shift' | undefined) {
    console.info('KeyboardNavigation.selectIndex ' + index)

    let sel = this.selected.value

    if (keyPressed === 'Control') {
      const i = sel.findIndex((val) => val === index)
      if (i === -1) {
        sel.push(index)
      } else {
        sel.splice(i, 1)
      }
    } else if (keyPressed === 'Shift') {
      if (sel.length > 0) {
        const lastSelected = sel[0]
        const min = Math.min(lastSelected, index)
        const max = Math.max(lastSelected, index)
        sel = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      }
    } else {
      sel = [index]
    }
    this.selected.value = sel
    this.callback(sel)
  }

  onMove(action: HotkeyEvents) {
    console.info('KeyboardNavigation.onMove ' + action)
    let sel = 0

    const songsPerRow = this.scroller.gridItems | 1

    if (this.selected.value.length > 0) {
      sel = this.selected.value[0]
      switch (action) {
        case HotkeyEvents.TOP:
          if (sel - songsPerRow >= 0) {
            sel -= 1 * songsPerRow
          }
          break
        case HotkeyEvents.BOTTOM:
          if (sel + songsPerRow < this.scroller.items.length) {
            sel += 1 * songsPerRow
          }
          break
        case HotkeyEvents.LEFT:
          if (sel % songsPerRow > 0) {
            sel -= 1
          }
          break
        case HotkeyEvents.RIGHT:
          if (sel % songsPerRow < songsPerRow - 1 && sel + 1 < this.scroller.items.length) {
            sel += 1
          }
          break
      }
    }
    this.selected.value = [sel]
    this.scrollToItem(sel)

    // notify parent of selection change
    this.callback(this.selected.value)
  }

  private scrollToItem(index: number) {
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
}
