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

const BRACKEN_API = import.meta.env.VITE_BRACKEN_API

if (!BRACKEN_API) handleGenericError('useBrackenServer', { name: 'BRACKEN_API', message: 'Missing env VITE_BRACKEN_API' })

const BrackenEndpoints = {
  GetCurrentRound: `${BRACKEN_API}/rounds/current`,
  GetRoundStateLite: `${BRACKEN_API}/state/lite`,
  GetWebResult: `${BRACKEN_API}/state/result`,
  GetWebAllResult: `${BRACKEN_API}/state/all`,
  BroadcastVote: `${BRACKEN_API}/voting/broadcast`,
  GetVoteStatus: `${BRACKEN_API}/voting/status`,
  GetEligibleVoters: `${BRACKEN_API}/state/eligible-addresses`,
  GetMerkleLeaves: `${BRACKEN_API}/state/token-holders`,
} as const

export const useBrackenServer = () => {
  const { GetCurrentRound, GetWebAllResult, BroadcastVote, GetRoundStateLite, GetWebResult, GetVoteStatus } = BrackenEndpoints
  const { fetchData, isLoading } = useApi()
  const getCurrentRound = () => fetchData<CurrentRound, { requesters: string[] }>(GetCurrentRound, 'post', { requesters: ROUND_REQUESTERS })
  const getRoundStateLite = (round_id: string) => fetchData<VoteStateLite, { round_id: string }>(GetRoundStateLite, 'post', { round_id })
  const broadcastVote = (vote: BroadcastVoteRequest) => fetchData<BroadcastVoteResponse, BroadcastVoteRequest>(BroadcastVote, 'post', vote)
  const getWebResult = () =>
    fetchData<PollRequestResult[], { requesters: string[] }>(GetWebAllResult, 'post', { requesters: ROUND_REQUESTERS })
  const getWebResultByRound = (round_id: string) => fetchData<PollRequestResult, { round_id: string }>(GetWebResult, 'post', { round_id })
  const getVoteStatus = (request: VoteStatusRequest) => fetchData<VoteStatusResponse, VoteStatusRequest>(GetVoteStatus, 'post', request)
  const getEligibleVoters = (round_id: string) =>
    fetchData<EligibleVoter[], { round_id: string }>(BrackenEndpoints.GetEligibleVoters, 'post', { round_id })
  const getMerkleLeaves = (round_id: string) =>
    fetchData<string[], { round_id: string }>(BrackenEndpoints.GetMerkleLeaves, 'post', { round_id })

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
