<!-- 
  Context.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <ContextMenu ref="contextMenu" v-click-outside="hideContextMenu" :menu-items="menu" />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-facing-decorator'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'

@Component({
  components: {
    // ContextMenu
  }
})
export default class Context extends Vue {
  mounted() {
    bus.on(EventBus.SHOW_CONTEXT, (event: Event, items: unknown[]) => {
      console.log('showing context menu', event, items)
      // this.menu = items
      // ;(this.$refs.contextMenu as ContextMenuComponent).open(event)
    })
  }

  hideContextMenu() {
    console.log('hiding context menu')
    // ;(this.$refs.contextMenu as ContextMenuComponent).close()
  }
}
</script>

<style lang="sass">
.context-menu
  background: var(--secondary)
  border-radius: 16px
  ul li
    &:hover
      background: var(--accent)
</style>
