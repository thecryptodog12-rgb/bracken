// SPDX-License-Identifier: LGPL-3.0-only
//
// This file is provided WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE.

import { handleGenericError } from '@/utils/handle-generic-error'
import {
  BroadcastVoteRequest,
  BroadcastVoteResponse,
  CurrentRound,
  EligibleVoter,
  VoteStateLite,
  VoteStatusRequest,
  VoteStatusResponse,
} from '@/model/vote.model'
import { useApi } from '../generic/useFetchApi'
import { PollRequestResult } from '@/model/poll.model'
import { ROUND_REQUESTERS } from '@/utils/constants'

const LOXLEY_API = import.meta.env.VITE_LOXLEY_API

if (!LOXLEY_API) handleGenericError('useLoxleyServer', { name: 'LOXLEY_API', message: 'Missing env VITE_LOXLEY_API' })

const LoxleyEndpoints = {
  GetCurrentRound: `${LOXLEY_API}/rounds/current`,
  GetRoundStateLite: `${LOXLEY_API}/state/lite`,
  GetWebResult: `${LOXLEY_API}/state/result`,
  GetWebAllResult: `${LOXLEY_API}/state/all`,
  BroadcastVote: `${LOXLEY_API}/voting/broadcast`,
  GetVoteStatus: `${LOXLEY_API}/voting/status`,
  GetEligibleVoters: `${LOXLEY_API}/state/eligible-addresses`,
  GetMerkleLeaves: `${LOXLEY_API}/state/token-holders`,
} as const

export const useLoxleyServer = () => {
  const { GetCurrentRound, GetWebAllResult, BroadcastVote, GetRoundStateLite, GetWebResult, GetVoteStatus } = LoxleyEndpoints
  const { fetchData, isLoading } = useApi()
  const getCurrentRound = () => fetchData<CurrentRound, { requesters: string[] }>(GetCurrentRound, 'post', { requesters: ROUND_REQUESTERS })
  const getRoundStateLite = (round_id: string) => fetchData<VoteStateLite, { round_id: string }>(GetRoundStateLite, 'post', { round_id })
  const broadcastVote = (vote: BroadcastVoteRequest) => fetchData<BroadcastVoteResponse, BroadcastVoteRequest>(BroadcastVote, 'post', vote)
  const getWebResult = () =>
    fetchData<PollRequestResult[], { requesters: string[] }>(GetWebAllResult, 'post', { requesters: ROUND_REQUESTERS })
  const getWebResultByRound = (round_id: string) => fetchData<PollRequestResult, { round_id: string }>(GetWebResult, 'post', { round_id })
  const getVoteStatus = (request: VoteStatusRequest) => fetchData<VoteStatusResponse, VoteStatusRequest>(GetVoteStatus, 'post', request)
  const getEligibleVoters = (round_id: string) =>
    fetchData<EligibleVoter[], { round_id: string }>(LoxleyEndpoints.GetEligibleVoters, 'post', { round_id })
  const getMerkleLeaves = (round_id: string) =>
    fetchData<string[], { round_id: string }>(LoxleyEndpoints.GetMerkleLeaves, 'post', { round_id })

  return {
    isLoading,
    getWebResultByRound,
    getWebResult,
    getCurrentRound,
    getRoundStateLite,
    broadcastVote,
    getVoteStatus,
    getEligibleVoters,
    getMerkleLeaves,
  }
}
