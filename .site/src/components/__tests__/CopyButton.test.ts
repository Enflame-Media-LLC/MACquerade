import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CopyButton from '@/components/CopyButton.vue'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copies the provided text on click', async () => {
    const wrapper = mount(CopyButton, { props: { text: 'npm i -g macquerade' } })
    await wrapper.get('button').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm i -g macquerade')
  })

  it('reflects copied state', async () => {
    const wrapper = mount(CopyButton, { props: { text: 'x' } })
    expect(wrapper.get('button').attributes('data-copied')).toBe('false')
    await wrapper.get('button').trigger('click')
    await Promise.resolve()
    expect(wrapper.get('button').attributes('data-copied')).toBe('true')
  })
})
