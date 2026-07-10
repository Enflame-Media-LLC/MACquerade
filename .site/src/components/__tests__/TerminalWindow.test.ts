import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TerminalWindow from '@/components/TerminalWindow.vue'

describe('TerminalWindow', () => {
  it('renders the title and command prompt', () => {
    const wrapper = mount(TerminalWindow, {
      props: { title: 'zsh', command: 'macquerade list' },
      slots: { default: 'output here' },
    })
    expect(wrapper.text()).toContain('zsh')
    expect(wrapper.text()).toContain('macquerade list')
    expect(wrapper.text()).toContain('output here')
  })

  it('shows a copy button when copyText is provided', () => {
    const wrapper = mount(TerminalWindow, {
      props: { title: 'zsh', copyText: 'macquerade list' },
    })
    expect(wrapper.find('button[data-copied]').exists()).toBe(true)
  })
})
