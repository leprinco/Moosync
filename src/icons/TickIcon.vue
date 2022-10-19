<template>
  <svg viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M0.75 4.75L4.25 8.25L11.25 0.75"
      :stroke="color"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator'

@Component({})
export default class TickIcon extends Vue {
  @Prop({ default: 'var(--textPrimary)' })
  private color!: string
}
</script>
