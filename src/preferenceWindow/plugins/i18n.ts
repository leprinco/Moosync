import { createI18n } from 'vue-i18n'
import { messages } from '@/utils/ui/i18n'

export const i18n = createI18n({
  locale: 'en_US',
  fallbackLocale: 'en_US',
  messages,
  legacy: false
})
