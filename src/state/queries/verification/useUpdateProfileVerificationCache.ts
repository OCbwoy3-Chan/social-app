import {useCallback} from 'react'
import {useQueryClient} from '@tanstack/react-query'

import {logger} from '#/logger'
import {updateProfileShadow} from '#/state/cache/profile-shadow'
import {useAgent, useSession} from '#/state/session'
import {
  useCustomVerificationCancellations,
  useCustomVerificationCancellersEnabled,
  useCustomVerificationTrustedCancellers,
} from '#/state/verification/crack/custom-cancellers'
import {fetchCustomVerificationState} from '#/state/verification/custom-verification'
import {
  useCustomVerificationEnabled,
  useCustomVerificationTrusted,
} from '#/state/verification/custom-verifiers'
import type * as bsky from '#/types/bsky'

/**
 * Fetches a fresh verification state from the app view and updates our profile
 * cache. This state is computed using a variety of factors on the server, so
 * we need to get this data from the server.
 */
export function useUpdateProfileVerificationCache() {
  const qc = useQueryClient()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const customVerificationEnabled = useCustomVerificationEnabled()
  const cancellersEnabled = useCustomVerificationCancellersEnabled()
  const trusted = useCustomVerificationTrusted(
    customVerificationEnabled ? currentAccount?.did : undefined,
  )
  const trustedCancellers = useCustomVerificationTrustedCancellers(
    cancellersEnabled ? currentAccount?.did : undefined,
  )
  useCustomVerificationCancellations()

  return useCallback(
    async ({profile}: {profile: bsky.profile.AnyProfileView}) => {
      try {
        if (customVerificationEnabled || cancellersEnabled) {
          try {
            const verification = await fetchCustomVerificationState({
              profile,
              trusted,
              trustedCancellers,
            })
            updateProfileShadow(qc, profile.did, {verification})
            return
          } catch (error) {
            logger.error(`custom verification fetch failed`, {
              safeMessage: error,
            })
          }
        }

        const {data: updated} = await agent.getProfile({
          actor: profile.did ?? '',
        })
        updateProfileShadow(qc, profile.did, {
          verification: updated.verification,
        })
      } catch (e) {
        logger.error(`useUpdateProfileVerificationCache failed`, {
          safeMessage: e,
        })
      }
    },
    [
      agent,
      qc,
      customVerificationEnabled,
      cancellersEnabled,
      trusted,
      trustedCancellers,
    ],
  )
}
