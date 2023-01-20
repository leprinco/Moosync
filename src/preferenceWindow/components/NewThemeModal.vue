<!-- 
  ConfirmationModal.vue is a part of Moosync.
  
  Copyright 2021-2022 by Sahil Gupte <sahilsachingupte@gmail.com>. All rights reserved.
  Licensed under the GNU General Public License. 
  
  See LICENSE in the project root for license information.
-->

<template>
  <b-modal body-class="delete-modal" centered size="lg" :id="id" :ref="id" hide-footer hide-header>
    <div class="modal-content-container">
      <b-container fluid class="p-0">
        <b-row>
          <b-col @click="onCreatePressed">Create new</b-col>
        </b-row>
        <b-row>
          <b-col @click="onImportPressed">Import</b-col>
        </b-row>
      </b-container>
    </div>
  </b-modal>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class NewThemeModal extends Vue {
  @Prop({ default: 'NewThemeModal' })
  private id!: string

  private onImportPressed() {
    this.$emit('import')
    this.$bvModal.hide(this.id)
  }

  private onCreatePressed() {
    this.$emit('create')
    this.$bvModal.hide(this.id)
  }
}
</script>

<style lang="sass" scoped>
.topbar-container
  background: var(--primary)
  height: 70px
  padding-left: calc(261px + 30px + 7.5px)

.confirm-button, .cancel-button
  font-size: 16px
  border-radius: 6px
  margin-bottom: 20px
  margin-top: 15px
  border: 0
  font-weight: 600
  box-shadow: 4px 3px 7px 0px rgb(0 0 0 / 25%)

.confirm-button
  background-color: #E62017
  color: #fff

.cancel-button
  background-color: var(--tertiary)
  color: var(--textPrimary)

.keyword
  font-weight: 700
  color: #E62017

.item
  font-weight: 700
</style>
