import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/reports/api'
import { VoteButtons } from './VoteButtons'

vi.mock('../../lib/reports/api', () => ({
  castVote: vi.fn(),
  withdrawVote: vi.fn(),
}))

const confirmButton = () => screen.getByRole('button', { name: /confirm/i })
const disputeButton = () => screen.getByRole('button', { name: /dispute/i })

describe('VoteButtons (one vote per user per report)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('casts a confirm vote and marks it as pressed', async () => {
    vi.mocked(api.castVote).mockResolvedValueOnce({ confirm_count: 3, dispute_count: 1, my_vote: 'confirm' })
    const onChange = vi.fn()
    render(
      <VoteButtons reportId="r1" initial={{ confirm_count: 2, dispute_count: 1, my_vote: null }} onChange={onChange} />,
    )
    expect(confirmButton()).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(confirmButton())

    expect(api.castVote).toHaveBeenCalledWith('r1', 'confirm')
    await waitFor(() => expect(confirmButton()).toHaveAttribute('aria-pressed', 'true'))
    expect(confirmButton()).toHaveTextContent('3')
    expect(onChange).toHaveBeenCalledWith({ confirm_count: 3, dispute_count: 1, my_vote: 'confirm' })
  })

  it('switches an existing confirm to dispute instead of adding a second vote', async () => {
    vi.mocked(api.castVote).mockResolvedValueOnce({ confirm_count: 2, dispute_count: 2, my_vote: 'dispute' })
    render(<VoteButtons reportId="r1" initial={{ confirm_count: 3, dispute_count: 1, my_vote: 'confirm' }} />)

    await userEvent.click(disputeButton())

    expect(api.castVote).toHaveBeenCalledTimes(1)
    expect(api.castVote).toHaveBeenCalledWith('r1', 'dispute')
    await waitFor(() => expect(disputeButton()).toHaveAttribute('aria-pressed', 'true'))
    expect(confirmButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it('withdraws the vote when the current choice is tapped again', async () => {
    vi.mocked(api.withdrawVote).mockResolvedValueOnce({ confirm_count: 2, dispute_count: 1, my_vote: null })
    render(<VoteButtons reportId="r1" initial={{ confirm_count: 3, dispute_count: 1, my_vote: 'confirm' }} />)

    await userEvent.click(confirmButton())

    expect(api.withdrawVote).toHaveBeenCalledWith('r1')
    expect(api.castVote).not.toHaveBeenCalled()
    await waitFor(() => expect(confirmButton()).toHaveAttribute('aria-pressed', 'false'))
  })

  it('disables voting on the user\'s own report', () => {
    render(
      <VoteButtons
        reportId="r1"
        initial={{ confirm_count: 0, dispute_count: 0, my_vote: null }}
        disabledReason="This is your report. You cannot vote on it."
      />,
    )
    expect(confirmButton()).toBeDisabled()
    expect(disputeButton()).toBeDisabled()
    expect(screen.getByText(/cannot vote on it/i)).toBeInTheDocument()
  })

  it('shows the server message and keeps the previous vote when the database rejects it', async () => {
    vi.mocked(api.castVote).mockRejectedValueOnce(new Error('ID verification is required'))
    render(<VoteButtons reportId="r1" initial={{ confirm_count: 0, dispute_count: 0, my_vote: null }} />)

    await userEvent.click(disputeButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('ID verification is required')
    expect(disputeButton()).toHaveAttribute('aria-pressed', 'false')
  })
})
