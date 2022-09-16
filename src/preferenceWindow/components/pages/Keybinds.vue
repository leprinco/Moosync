<!-- 
  System.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div class="w-100 h-100">
    <HotkeyGroup
      class="mt-5 mb-3"
      prefKey="hotkeys"
      :isExtension="false"
      title="Hotkeys"
      :defaultValue="defaultKeybinds"
    />
  </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator'
import Vue from 'vue'
import HotkeyGroup from '../HotkeyGroup.vue'
import { defaultKeybinds } from '@/utils/commonConstants'

@Component({
  components: {
    HotkeyGroup
  }
})
export default class Keybinds extends Vue {
  private defaultKeybinds = defaultKeybinds
}
</script>

<style lang="sass" scoped></style>
