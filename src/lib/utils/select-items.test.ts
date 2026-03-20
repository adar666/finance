import { describe, expect, it } from 'vitest'
import {
  selectItemsFromCurrencies,
  selectItemsFromEntities,
  selectItemsFromMap,
  selectItemsWithNone,
} from './select-items'

describe('selectItemsFromEntities', () => {
  it('maps id/name to value/label', () => {
    expect(
      selectItemsFromEntities([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ])
    ).toEqual([
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ])
  })
})

describe('selectItemsWithNone', () => {
  it('prepends a sentinel row', () => {
    expect(selectItemsWithNone('__x__', '—', [{ id: '1', name: 'One' }])).toEqual([
      { value: '__x__', label: '—' },
      { value: '1', label: 'One' },
    ])
  })
})

describe('selectItemsFromMap', () => {
  it('uses ordered keys and label map', () => {
    expect(
      selectItemsFromMap(['a', 'b'], {
        a: 'Aye',
        b: 'Bee',
      })
    ).toEqual([
      { value: 'a', label: 'Aye' },
      { value: 'b', label: 'Bee' },
    ])
  })

  it('falls back to value when label missing', () => {
    expect(selectItemsFromMap(['x'], {})).toEqual([{ value: 'x', label: 'x' }])
  })
})

describe('selectItemsFromCurrencies', () => {
  it('builds rich labels', () => {
    expect(
      selectItemsFromCurrencies([{ code: 'USD', symbol: '$', name: 'US Dollar' }])
    ).toEqual([{ value: 'USD', label: '$ USD — US Dollar' }])
  })
})
