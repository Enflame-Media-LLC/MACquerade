import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import Home from '@/pages/Home.vue'

describe('Home page', () => {
  const wrapper = mount(Home, { global: { stubs: { RouterLink: RouterLinkStub, ClientOnly: true } } })

  it('renders the tagline', () => {
    expect(wrapper.text()).toContain('Every device deserves a disguise')
  })

  it('renders the install command', () => {
    expect(wrapper.text()).toContain('npm install -g macquerade')
  })

  it('mentions the OUI database stats', () => {
    expect(wrapper.text()).toContain('1691 prefixes')
  })
})
