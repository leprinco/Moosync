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
import { Component } from 'vue-property-decorator'
import Vue, { DirectiveBinding } from 'vue'
import { bus } from '@/mainWindow/main'
import { EventBus } from '@/utils/main/ipc/constants'
import 'vue-context-menu-popup/dist/vue-context-menu-popup.css'
import ContextMenu from 'vue-context-menu-popup'
import { ContextMenuComponent, MenuItem } from 'vue-context-menu-popup'

function isImage(e: HTMLElement) {
  const tagName = e.tagName.toLowerCase()
  const parentTagName = e.parentElement?.tagName.toLowerCase()
  return tagName === 'img' || tagName === 'svg' || parentTagName === 'svg'
}

Vue.directive('click-outside', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bind: function (el: HTMLElement, binding: DirectiveBinding<(e: Event) => void>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      if (el !== e.target && !el.contains(e.target) && !isImage(e.target)) {
        binding.value(e)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any)['__vueClickOutside__'] = handler
    // add Event Listeners
    document.addEventListener('click', handler)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unbind: function (el: any) {
    // Remove Event Listeners
    document.removeEventListener('click', el.__vueClickOutside__)
    el.__vueClickOutside__ = null
  }
})

@Component({
  components: {
    ContextMenu
  }
})
export default class Context extends Vue {
  menu: MenuItem[] = []
  mounted() {
    bus.$on(EventBus.SHOW_CONTEXT, (event: Event, items: MenuItem[]) => {
      this.menu = items
      ;(this.$refs.contextMenu as ContextMenuComponent).open(event)
    })
  }

  hideContextMenu() {
    null
    ;(this.$refs.contextMenu as ContextMenuComponent).close()
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
      color: var(--textInverse)
</style>
