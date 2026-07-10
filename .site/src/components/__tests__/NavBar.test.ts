import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import NavBar from '@/components/NavBar.vue'

function mountNav() {
  return mount(NavBar, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('NavBar', () => {
  it('renders the brand name', () => {
    expect(mountNav().text()).toContain('MACquerade')
  })

  it('has a theme toggle button', () => {
    const btn = mountNav().find('button[aria-label="Toggle theme"]')
    expect(btn.exists()).toBe(true)
  })
})
