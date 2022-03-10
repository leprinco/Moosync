/*
 *  playerState.ts is a part of Moosync.
 *
 *  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
 *  Licensed under the GNU General Public License.
 *
 *  See LICENSE in the project root for license information.
 */

import { action, mutation } from 'vuex-class-component'

import { VuexModule } from './module'
import { v1 } from 'uuid'

class Queue implements GenericQueue<Song> {
  data: QueueData<Song> = {}
  order: QueueOrder = []
  index = -1
}

export class PlayerStore extends VuexModule.With({ namespaced: 'player' }) {
  private state: PlayerState = 'PAUSED'
  public currentSong: Song | null | undefined | undefined = null
  private songQueue = new Queue()
  private repeat = false
  public volume = 50
  public timestamp = 0
  public loading = false

  get currentTime() {
    return this.timestamp
  }

  set currentTime(time: number) {
    this.timestamp = time
  }

  get playerState() {
    return this.state
  }

  set playerState(state: PlayerState) {
    this.state = state
  }

  get queue() {
    return this.songQueue
  }

  get queueData() {
    return this.songQueue.data
  }

  get Repeat() {
    return this.repeat
  }

  set Repeat(repeat: boolean) {
    this.repeat = repeat
  }

  get queueOrder() {
    return this.songQueue.order
  }

  get queueIndex() {
    return this.songQueue.index
  }

  set queueIndex(value: number) {
    this.songQueue.index = value
  }

  @mutation
  private clearCurrentSong() {
    this.currentSong = null
  }

  @mutation
  private _setSongQueueOrder(order: QueueOrder) {
    this.songQueue.order = order
  }

  @action
  async setQueueOrder(order: QueueOrder) {
    if (order.length === 0) {
      this.clearCurrentSong()
    }

    const oldOrder = this.songQueue.order
    this._setSongQueueOrder(order)

    const diff = oldOrder.filter((x) => !order.includes(x))
    for (const item of diff) {
      this.removeFromQueueData(item)
    }
  }

  get queueTop(): Song | null | undefined {
    if (this.songQueue.index > -1 && this.songQueue.data) {
      const songID = this.songQueue.order[this.songQueue.index]
      if (songID) return this.songQueue.data[songID.songID]
    }
    return null
  }

  @mutation
  private addSong(item: Song[]) {
    for (const s of item) {
      if (s && !this.songQueue.data[s._id]) {
        this.songQueue.data[s._id] = s
      }
    }
  }

  @mutation
  private removeFromQueueData(orderData: QueueOrder[0] | undefined) {
    if (orderData) {
      if (this.songQueue.order.findIndex((val) => val.songID === orderData.songID) === -1) {
        delete this.songQueue.data[orderData.songID]
      }
    }
  }

  @mutation
  private removeFromQueue(index: number) {
    if (index > -1) {
      this.songQueue.order.splice(index, 1)
      if (this.songQueue.order.length === 0) {
        this.currentSong = null
      }
    }
  }

  @action
  public async pop(index: number) {
    if (index > -1) {
      this.removeFromQueue(index)
      this.removeFromQueueData(this.songQueue.order[index])

      if (this.songQueue.index === index) {
        await this.loadSong(this.queueTop)
      }
    }
  }

  @mutation
  private addInSongQueue(item: Song[]) {
    this.songQueue.order.push(
      ...item.map((obj) => {
        return { id: v1(), songID: obj._id }
      })
    )
  }

  @action
  async pushInQueue(payload: { item: Song[]; top: boolean }) {
    if (payload.item.length > 0) {
      if (!this.currentSong) {
        // Add first item immediately to start playing
        this.addSong([payload.item[0]])
        payload.top ? this.addInQueueTop([payload.item[0]]) : this.addInSongQueue([payload.item[0]])
        payload.item.splice(0, 1)
        await this.nextSong()
      }

      this.addSong(payload.item)
      payload.top ? this.addInQueueTop(payload.item) : this.addInSongQueue(payload.item)

      payload.top && (await this.nextSong())
    }
  }

  @mutation
  private addInQueueTop(item: Song[]) {
    this.songQueue.order.splice(
      this.songQueue.index + 1,
      0,
      ...item.map((obj) => {
        return { id: v1(), songID: obj._id }
      })
    )
  }

  @mutation
  private incrementQueue() {
    if (this.songQueue.index < this.songQueue.order.length - 1) this.songQueue.index += 1
    else this.songQueue.index = 0
  }

  @action
  async nextSong() {
    this.timestamp = 0
    this.incrementQueue()
    this.loadSong(this.queueTop)
  }

  @mutation
  private decrementQueue() {
    if (this.songQueue.index > 0) this.songQueue.index -= 1
    else this.songQueue.index = this.songQueue.order.length - 1
  }

  @action
  async prevSong() {
    this.decrementQueue()
    this.loadSong(this.queueTop)
  }

  @mutation
  shuffle() {
    const currentSong = this.songQueue.order[this.songQueue.index]
    this.songQueue.order.splice(this.songQueue.index, 1)

    // https://stackoverflow.com/a/12646864
    for (let i: number = this.songQueue.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = this.songQueue.order[i]
      this.songQueue.order[i] = this.songQueue.order[j]
      this.songQueue.order[j] = temp
    }

    this.songQueue.order.unshift(currentSong)
    this.songQueue.index = 0
  }

  @mutation
  private setPlayerState(state: PlayerState) {
    this.state = state
  }

  @mutation loadSong(song: Song | null | undefined) {
    this.currentSong = song
  }

  @mutation
  private moveIndexTo(index: number) {
    if (index >= 0) this.songQueue.index = index
  }

  @action async playQueueSong(index: number) {
    this.moveIndexTo(index)
    this.loadSong(this.queueTop)
  }

  @mutation
  setSongIndex({ oldIndex, newIndex, ignoreMove }: { oldIndex: number; newIndex: number; ignoreMove: boolean }) {
    if (newIndex < 0) {
      newIndex = this.songQueue.order.length - -newIndex
    }

    if (newIndex >= this.songQueue.order.length) {
      newIndex = this.songQueue.order.length - 1
    }

    if (!ignoreMove) {
      const data = this.songQueue.order[oldIndex]
      this.songQueue.order.splice(oldIndex, 1)
      this.songQueue.order.splice(newIndex, 0, data)
    }

    if (oldIndex === this.songQueue.index) {
      this.songQueue.index = newIndex
      return
    }

    if (oldIndex < this.songQueue.index) {
      if (newIndex >= this.songQueue.index) this.songQueue.index -= 1
    } else if (oldIndex > this.songQueue.index) {
      if (newIndex <= this.songQueue.index) this.songQueue.index += 1
    }
  }
}
