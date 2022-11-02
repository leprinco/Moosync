<!-- 
  index.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div class="h-100 w-100 parent">
    <b-container class="recommendations-container" fluid>
      <b-row no-gutters class="page-title">{{ $t('pages.explore') }}</b-row>
      <b-row v-for="p of providers" :key="p.key">
        <b-col v-if="(recommendationList[p.key] && recommendationList[p.key].length > 0) || loadingMap[p.key]">
          <b-row class="mt-3">
            <b-col cols="auto" class="provider-title">Hot from {{ p.Title }}</b-col>
            <b-col cols="auto" v-if="loadingMap[p.key]">
              <div class="loading-spinner d-flex justify-content-center">
                <b-spinner class="align-self-center" />
              </div>
            </b-col>
          </b-row>
          <b-row class="slider-row">
            <b-col v-if="recommendationList[p.key] && recommendationList[p.key].length > 0">
              <CardCarousel :songList="recommendationList[p.key]" />
            </b-col>
          </b-row>
        </b-col>
      </b-row>
    </b-container>
  </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator'
import { mixins } from 'vue-class-component'
import RouterPushes from '@/utils/ui/mixins/RouterPushes'
import ContextMenuMixin from '@/utils/ui/mixins/ContextMenuMixin'
import CardView from '../../components/generic/CardView.vue'
import CardCarousel from '../../components/generic/CardCarousel.vue'
import ProviderMixin from '@/utils/ui/mixins/ProviderMixin'
import { ProviderScopes } from '@/utils/commonConstants'

@Component({
  components: {
    CardView,
    CardCarousel
  }
})
export default class Albums extends mixins(RouterPushes, ContextMenuMixin, ProviderMixin) {
  private get providers() {
    return this.fetchProviders()
  }

  private recommendationList: Record<string, Song[]> = {}
  private loadingMap: Record<string, boolean> = {}

  private fetchProviders() {
    const providers = this.getProvidersByScope(ProviderScopes.RECOMMENDATIONS)
    return providers
  }

  private fetchRecomsFromProviders() {
    for (const val of this.providers) {
      this.getResults(val.key, val.getRecommendations())
    }
  }

  mounted() {
    this.fetchRecomsFromProviders()
    this.onProvidersChanged(this.fetchRecomsFromProviders)
  }

  private async getResults(key: string, gen: AsyncGenerator<Song[]>) {
    this.$set(this.loadingMap, key, true)
    for await (const s of gen) {
      if (!this.recommendationList[key]) {
        this.recommendationList[key] = []
      }
      this.recommendationList[key].push(...s)
      this.recommendationList = Object.assign({}, this.recommendationList)
    }
    this.$set(this.loadingMap, key, false)
  }
}
</script>

<style lang="sass" scoped>
.title
  font-weight: bold
  font-size: 55px
  text-align: left

.provider-title
  font-weight: bold
  font-size: 26px
  text-align: left

.recommendations-container
  margin-bottom: 50px
  margin-top: 20px

.slider-row
  margin-top: 15px
</style>
