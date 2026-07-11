import './assets/main.css'
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes } from './router/routes'

export const createApp = ViteSSG(App, {
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    return { left: 0, top: 0 }
  },
})
