import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { RouterLinkStub } from '@vue/test-utils'
import Commands from '@/pages/docs/Commands.vue'

describe('Commands docs page', () => {
  it('lists every command name', () => {
    const wrapper = mount(Commands, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    for (const name of ['randomize', 'lookup', 'vendors', 'reset']) {
      expect(wrapper.text()).toContain(name)
    }
  })
})
