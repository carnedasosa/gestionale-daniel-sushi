import { describe, expect, it } from 'vitest'
import { testoBannerAllergeni } from './testo-banner'

describe('testoBannerAllergeni', () => {
  it('singolare per un solo piatto', () => {
    expect(testoBannerAllergeni(1)).toEqual({ evidenza: '1 piatto', resto: 'ha gli allergeni da confermare.' })
  })
  it('plurale negli altri casi', () => {
    expect(testoBannerAllergeni(2)).toEqual({ evidenza: '2 piatti', resto: 'hanno gli allergeni da confermare.' })
    expect(testoBannerAllergeni(14)).toEqual({ evidenza: '14 piatti', resto: 'hanno gli allergeni da confermare.' })
  })
})
