import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/auth/api'
import { authAs, renderWithAuth } from '../../test/renderWithAuth'

vi.mock('../../lib/auth/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/auth/api')>()
  return {
    ...actual,
    fetchBarangays: vi.fn(async () => [
      { id: 6, name: 'Dita' },
      { id: 9, name: 'Ibabao' },
    ]),
    signUpResident: vi.fn(async () => ({ needsEmailConfirmation: false })),
  }
})

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Display name'), 'Maria Santos')
  await user.selectOptions(await screen.findByLabelText('Barangay'), await screen.findByRole('option', { name: 'Dita' }))
  await user.type(screen.getByLabelText('Email'), 'maria@example.test')
  await user.type(screen.getByLabelText(/^Password/), 'longenough1')
  await user.type(screen.getByLabelText('Confirm password'), 'longenough1')
}

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the privacy notice', async () => {
    renderWithAuth('/app/register', authAs(null))
    expect(await screen.findByRole('heading', { name: /privacy notice/i })).toBeInTheDocument()
  })

  it('does not submit without consent', async () => {
    const user = userEvent.setup()
    renderWithAuth('/app/register', authAs(null))
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/must agree to the privacy notice/i)).toBeInTheDocument()
    expect(api.signUpResident).not.toHaveBeenCalled()
  })

  it('submits resident sign-up data once consent is given (never a role)', async () => {
    const user = userEvent.setup()
    renderWithAuth('/app/register', authAs(null))
    await fillForm(user)
    await user.click(screen.getByLabelText(/agree to the privacy notice/i))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(api.signUpResident).toHaveBeenCalledWith({
        email: 'maria@example.test',
        password: 'longenough1',
        displayName: 'Maria Santos',
        barangayId: 6,
      }),
    )
  })

  it('tells the user to check their email when confirmation is required', async () => {
    vi.mocked(api.signUpResident).mockResolvedValueOnce({ needsEmailConfirmation: true })
    const user = userEvent.setup()
    renderWithAuth('/app/register', authAs(null))
    await fillForm(user)
    await user.click(screen.getByLabelText(/agree to the privacy notice/i))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })
})
