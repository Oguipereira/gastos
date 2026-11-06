import { describe, expect, it } from 'vitest'
import { suggestEmail } from './email'

describe('suggestEmail', () => {
  it('sugere gmail.com para gmail.com.br', () => {
    expect(suggestEmail('fulano@gmail.com.br')).toBe('fulano@gmail.com')
  })
  it('não mexe em domínios válidos', () => {
    expect(suggestEmail('fulano@gmail.com')).toBeNull()
    expect(suggestEmail('fulano@empresa.com.br')).toBeNull()
  })
  it('ignora texto sem @', () => {
    expect(suggestEmail('fulano')).toBeNull()
  })
})
