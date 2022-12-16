<!-- 
  IconHandler.vue is a part of Moosync.
  
  Copyright 2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div class="d-flex provider-icon">
    <YoutubeIcon v-if="iconType === 'YOUTUBE'" :color="'#E62017'" :filled="true" :dropShadow="true" />
    <SpotifyIcon v-else-if="iconType === 'SPOTIFY'" :color="'#1ED760'" :filled="true" :dropShadow="true" />

    <inline-svg v-else-if="iconURL && iconType === 'URL' && iconURL.endsWith('svg')" :src="iconURL" />
    <img
      referrerPolicy="no-referrer"
      v-else-if="iconURL && iconType === 'URL' && !iconURL.endsWith('svg')"
      :src="iconURL"
      alt="provider icon"
    />
  </div>
</template>

<script lang="ts">
import ImgLoader from '@/utils/ui/mixins/ImageLoader'
import Component, { mixins } from 'vue-class-component'
import YoutubeIcon from '@/icons/YoutubeIcon.vue'
import SpotifyIcon from '@/icons/SpotifyIcon.vue'
import { Prop } from 'vue-property-decorator'

@Component({
  components: {
    YoutubeIcon,
    SpotifyIcon
  }
})
export default class IconHandler extends mixins(ImgLoader) {
  @Prop({ default: () => ({}) })
  public song!: Song

  public iconURL = ''

  public get iconType() {
    this.iconURL = ''

    if (this.song.icon) {
      this.iconURL = 'media://' + this.song.icon
      return 'URL'
    }

    if (this.song.providerExtension) {
      window.ExtensionUtils.getExtensionIcon(this.song.providerExtension).then((val) => {
        if (val) {
          this.iconURL = 'media://' + val
        }
      })
      return 'URL'
    }

    return this.song.type
  }
}
</script>
