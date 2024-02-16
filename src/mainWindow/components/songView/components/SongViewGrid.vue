<!-- 
  SongViewGrid.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <b-row no-gutters class="w-100 h-100 list-container">
    <RecycleScroller
      ref="scroller"
      :class="`scroller w-100  ${isLoading ? 'low-height' : 'full-height'}`"
      :items="songList"
      key-field="_id"
      :direction="'vertical'"
      :item-size="80"
      :item-secondary-size="400"
      v-click-outside="clearSelection"
      :grid-items="songsPerRow"
    >
      <template v-slot="{ item, index }">
        <b-container
          fluid
          @dblclick="onRowDoubleClicked(item)"
          @click.exact="onRowSelected(index, undefined)"
          @click.shift="onRowSelected(index, 'Shift')"
          @click.ctrl="onRowSelected(index, 'Control')"
          @contextmenu="onRowContext(arguments[0], item)"
          class="wrapper w-100"
          :class="{ selectedItem: isSelectedIndex(index) }"
        >
          <b-row no-gutters align-content="center" class="w-100">
            <b-col cols="1" align-self="center">
              {{ index + 1 }}
            </b-col>
            <LowImageCol
              @click.native="onPlayNowClicked(item)"
              height="56px"
              width="56px"
              class="col-2 mr-0"
              :src="getValidImageLow(item)"
              :showPlayHoverButton="showPlayHoverButton"
            />
            <b-col cols="9" align-self="center">
              <b-row no-gutters align-v="center">
                <div class="text-truncate">
                  {{ item.title }}
                </div>
              </b-row>
              <b-row no-gutters class="flex-nowrap">
                <div
                  v-for="(artist, index) in item.artists"
                  :key="index"
                  class="subtitle text-truncate"
                  :class="index !== 0 ? 'ml-1' : ''"
                  @click="onSubtitleClicked(artist)"
                >
                  <span> {{ artist.artist_name }}{{ index !== item.artists.length - 1 ? ',' : '' }}</span>
                </div>
              </b-row>
            </b-col>
          </b-row>
        </b-container>
      </template>
    </RecycleScroller>

    <SongDetails
      class="details-container h-100"
      :defaultDetails="defaultDetails"
      :buttonGroup="detailsButtonGroup"
      :currentSong="currentSong"
      :optionalProviders="optionalProviders"
      v-on="$listeners"
    />
  </b-row>
</template>

<script lang="ts">
import { Component, Prop } from 'vue-property-decorator'
import { mixins } from 'vue-class-component'
import ImgLoader from '@/utils/ui/mixins/ImageLoader'
import LowImageCol from '@/mainWindow/components/generic/LowImageCol.vue'
import SongDetails from './SongDetails.vue'
import SongListCompactItem from './SongListCompactItem.vue'
import ModelHelper from '@/utils/ui/mixins/ModelHelper'
import SongListMixin from '@/utils/ui/mixins/SongListMixin'

@Component({
  components: {
    SongListCompactItem,
    SongDetails,
    LowImageCol
  }
})
export default class SongViewGrid extends mixins(ImgLoader, ModelHelper, SongListMixin) {
  @Prop({ default: false })
  currentSong!: Song | undefined | null

  @Prop({ default: 1 })
  songsPerRow!: number

  @Prop({ default: false })
  isLoading!: boolean

  @Prop({ default: () => [] })
  optionalProviders!: TabCarouselItem[]

  @Prop({ default: true })
  showPlayHoverButton!: boolean

  @Prop({
    default: () => {
      return { defaultTitle: '', defaultSubtitle: '', defaultCover: '' }
    }
  })
  defaultDetails!: SongDetailDefaults

  @Prop({
    default: () => {
      return {
        enableContainer: false,
        enableLibraryStore: false,
        playRandom: false
      }
    }
  })
  detailsButtonGroup!: SongDetailButtons

  onRowContext(event: Event, item: Song) {
    this.$emit(
      'onRowContext',
      event,
      this.selected().length > 1 ? this.selected().map((val) => this.songList[val]) : [item]
    )
  }

  onRowDoubleClicked(item: Song) {
    this.$emit('onRowDoubleClicked', item)
  }

  onPlayNowClicked(item: Song) {
    this.$emit('onRowPlayNowClicked', item)
  }

  async onSubtitleClicked(artist: Artists) {
    this.$emit('onArtistClicked', artist)
  }

  async created() {
    this.songsPerRow = 3
  }
}
</script>

<style lang="sass" scoped>
.details-background
  height: 25%
  max-height: 200px
  margin-top: 15px
  margin-left: 15px
  margin-right: 15px
  border-radius: 28px
  background: var(--secondary)

.details-container
  width: 100%

.list-container
  height: 75%
</style>
