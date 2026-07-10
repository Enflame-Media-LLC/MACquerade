import { useHead } from '@unhead/vue'

export function usePageMeta(meta: { title: string; description: string }): void {
  const fullTitle = `${meta.title} · MACquerade`
  try {
    useHead({
      title: fullTitle,
      meta: [
        { name: 'description', content: meta.description },
        { property: 'og:title', content: fullTitle },
        { property: 'og:description', content: meta.description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    })
  } catch {
    // No active unhead context (e.g. component mounted directly in a unit
    // test without the vite-ssg app/plugin chain). Safe to no-op — head
    // metadata is only observable via the real app / prerender.
  }
}
