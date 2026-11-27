import { describe, expect, it } from 'vitest'
import { homePathForRole, isPathInRoleArea } from './types'

describe('homePathForRole', () => {
  it('maps each role to its area', () => {
    expect(homePathForRole('resident')).toBe('/app')
    expect(homePathForRole('office_staff')).toBe('/office')
    expect(homePathForRole('admin')).toBe('/admin')
  })
})

describe('isPathInRoleArea', () => {
  it('accepts the area root and nested paths', () => {
    expect(isPathInRoleArea('/app', 'resident')).toBe(true)
    expect(isPathInRoleArea('/app/profile', 'resident')).toBe(true)
  })

  it('rejects other areas and look-alike prefixes', () => {
    expect(isPathInRoleArea('/admin', 'resident')).toBe(false)
    expect(isPathInRoleArea('/apple', 'resident')).toBe(false)
    expect(isPathInRoleArea('/app', 'admin')).toBe(false)
  })
})
