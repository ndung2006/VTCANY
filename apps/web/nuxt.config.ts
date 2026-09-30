// Bước 3/8 — Nuxt 3 + Vue 3 + PrimeVue + Tailwind SSR (clone vtcplay.vn).
// API base lấy từ runtime config: NUXT_PUBLIC_API_BASE (prod trỏ api.vtcany.vn).
export default defineNuxtConfig({
  modules: ['@primevue/nuxt-module', '@nuxtjs/tailwindcss'],
  primevue: {
    options: { ripple: true },
    components: {
      include: ['Carousel', 'Button', 'InputText', 'Skeleton', 'Accordion', 'AccordionTab'],
    },
  },
  css: ['primeicons/primeicons.css', '@/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api/v1',
    },
  },
  app: {
    head: {
      title: 'VTC ANY',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    },
  },
  compatibilityDate: '2024-11-01',
});
