import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/Home.vue') },
  { path: '/docs', name: 'docs', component: () => import('@/pages/docs/Overview.vue') },
  { path: '/docs/commands', name: 'docs-commands', component: () => import('@/pages/docs/Commands.vue') },
  { path: '/docs/flags', name: 'docs-flags', component: () => import('@/pages/docs/Flags.vue') },
  { path: '/docs/install', name: 'docs-install', component: () => import('@/pages/docs/Install.vue') },
  { path: '/docs/platforms', name: 'docs-platforms', component: () => import('@/pages/docs/Platforms.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFound.vue') },
]
