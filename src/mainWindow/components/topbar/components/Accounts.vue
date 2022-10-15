<!-- 
  Accounts.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <div>
    <Person id="account" class="accounts-icon" />
    <b-popover :target="`account`" placement="bottom" triggers="click blur" custom-class="accounts-popover">
      <div class="buttons">
        <div v-for="p in providers" :key="`${p.provider.Title}-${p.username}`">
          <IconButton
            v-if="p.provider.canLogin"
            :bgColor="p.provider.BgColor"
            :hoverText="p.provider.loggedIn ? 'Sign out' : p.provider.Title"
            :title="p.username ? p.username : 'Connect'"
            @click.native="handleClick(p)"
          >
            <template slot="icon">
              <component v-if="isIconComponent(p.provider.IconComponent)" :is="p.provider.IconComponent" />
              <inline-svg
                class="provider-icon"
                v-else-if="p.provider.IconComponent.endsWith('svg')"
                :src="`media://${p.provider.IconComponent}`"
              />
              <img v-else referrerPolicy="no-referrer" :src="a.icon" alt="provider icon" class="provider-icon" />
            </template>
          </IconButton>
        </div>
      </div>
    </b-popover>
    <ConfirmationModal keyword="signout from" :itemName="activeSignout" id="signoutModal" @confirm="signout" />
  </div>
</template>
<script lang="ts">
import IconButton from '@/mainWindow/components/generic/IconButton.vue'
import YoutubeIcon from '@/icons/YoutubeIcon.vue'
import SpotifyIcon from '@/icons/SpotifyIcon.vue'
import LastFMIcon from '@/icons/LastFMIcon.vue'
import Person from '@/icons/PersonIcon.vue'
import { Component } from 'vue-property-decorator'
import ConfirmationModal from '@/commonComponents/ConfirmationModal.vue'
import { mixins } from 'vue-class-component'
import AccountsMixin from '@/utils/ui/mixins/AccountsMixin'
import InvidiousIcon from '@/icons/InvidiousIcon.vue'
import { vxm } from '@/mainWindow/store'

@Component({
  components: {
    IconButton,
    YoutubeIcon,
    InvidiousIcon,
    SpotifyIcon,
    LastFMIcon,
    Person,
    ConfirmationModal
  }
})
export default class TopBar extends mixins(AccountsMixin) {
  protected activeSignout: Provider | null = null

  private isIconComponent(src: string) {
    switch (src) {
      case vxm.providers.youtubeProvider.IconComponent:
      case vxm.providers.spotifyProvider.IconComponent:
      case vxm.providers.lastfmProvider.IconComponent:
        return true
      default:
        return false
    }
  }

  async mounted() {
    this.signoutMethod = this.showSignoutModal
  }

  protected async signout() {
    if (this.activeSignout) {
      if (this.activeSignout) {
        this.activeSignout.provider.signOut()

        this.$set(this.activeSignout, 'username', '')
        this.activeSignout = null
      }
    }
  }

  protected showSignoutModal(signout: Provider) {
    this.activeSignout = signout
    this.$bvModal.show('signoutModal')
  }
}
</script>

<style lang="sass" scoped>
.accounts-icon
  height: 22px
  width: 22px
  margin-left: 0.5rem

.buttons
  > div
    margin-bottom: 8px
    &:first-child
      margin-top: 15px
</style>
