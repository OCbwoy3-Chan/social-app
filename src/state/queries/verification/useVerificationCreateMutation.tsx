import {type AppBskyActorDefs, type AppBskyActorGetProfile} from '@atproto/api'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {until} from '#/lib/async/until'
import {updateProfileShadow} from '#/state/cache/profile-shadow'
import {useUpdateProfileVerificationCache} from '#/state/queries/verification/useUpdateProfileVerificationCache'
import {useAgent, useSession} from '#/state/session'
import {
  useCustomVerificationCancellations,
  useCustomVerificationCancellersEnabled,
  useCustomVerificationTrustedCancellers,
} from '#/state/verification/crack/custom-cancellers'
import {
  applyOptimisticCustomVerificationState,
  clearCustomVerificationCacheForProfile,
} from '#/state/verification/custom-verification'
import {
  useCustomVerificationEnabled,
  useCustomVerificationTrusted,
} from '#/state/verification/custom-verifiers'
import {useAnalytics} from '#/analytics'
import type * as bsky from '#/types/bsky'

// ocbwoy3
function buildOptimisticVerificationState_ocbwoy3({
  profile,
  issuerDid,
  uri,
  createdAt,
}: {
  profile: bsky.profile.AnyProfileView
  issuerDid: string
  uri: string
  createdAt: string
}): AppBskyActorDefs.VerificationState {
  const existing = profile.verification?.verifications ?? []
  const next = existing.some(v => v.uri === uri)
    ? existing
    : [
        ...existing,
        {
          issuer: issuerDid,
          isValid: true,
          createdAt,
          uri,
        },
      ]

  next.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    $type: 'app.bsky.actor.defs#verificationState',
    verifications: next,
    verifiedStatus: next.some(v => v.isValid)
      ? 'valid'
      : next.length
        ? 'invalid'
        : 'none',
    trustedVerifierStatus:
      profile.verification?.trustedVerifierStatus ?? 'none',
  }
}

export function useVerificationCreateMutation() {
  const ax = useAnalytics()
  const agent = useAgent()
  const qc = useQueryClient() // <-- ocbwoy3
  const {currentAccount} = useSession()
  const customVerificationEnabled = useCustomVerificationEnabled()
  const cancellersEnabled = useCustomVerificationCancellersEnabled()
  const trusted = useCustomVerificationTrusted(
    customVerificationEnabled ? currentAccount?.did : undefined,
  )
  const trustedCancellers = useCustomVerificationTrustedCancellers(
    cancellersEnabled ? currentAccount?.did : undefined,
  )
  const {removeCancellation, hasCancellation} =
    useCustomVerificationCancellations()
  const updateProfileVerificationCache = useUpdateProfileVerificationCache()

  return useMutation({
    async mutationFn({profile}: {profile: bsky.profile.AnyProfileView}) {
      if (!currentAccount) {
        throw new Error('User not logged in')
      }

      const createdAt = new Date().toISOString()
      const {uri} = await agent.app.bsky.graph.verification.create(
        {repo: currentAccount.did},
        {
          subject: profile.did,
          createdAt,
          handle: profile.handle,
          displayName: profile.displayName || '',
        },
      )
      return {uri, createdAt}
    },
    async onSuccess({uri, createdAt}, {profile}) {
      ax.metric('verification:create', {})
      if (currentAccount) {
        const existingCancellation = hasCancellation({
          issuer: currentAccount.did,
          subject: profile.did,
        })
        if (existingCancellation) {
          await removeCancellation({
            issuer: currentAccount.did,
            subject: profile.did,
          })
        }
        // <-- ocbwoy3 (entire if block)
        const optimisticVerification = buildOptimisticVerificationState_ocbwoy3(
          {
            profile,
            issuerDid: currentAccount.did,
            uri,
            createdAt,
          },
        )
        updateProfileShadow(qc, profile.did, {
          verification: optimisticVerification,
        })
      }
      if (customVerificationEnabled && currentAccount) {
        applyOptimisticCustomVerificationState({
          profile,
          trusted,
          trustedCancellers,
          cancellations: undefined,
          verification: {
            issuer: currentAccount.did,
            isValid: true,
            createdAt,
            uri,
          },
        })
      } else {
        clearCustomVerificationCacheForProfile(profile.did)
      }
      void (async () => {
        // <-- ocbwoy3
        let confirmed = false
        try {
          await until(
            5,
            1e3,
            ({data: updatedProfile}: AppBskyActorGetProfile.Response) =>
              Boolean(
                updatedProfile.verification?.verifications.some(
                  v => v.uri === uri,
                ),
              ),
            () => agent.getProfile({actor: profile.did ?? ''}),
          )
          confirmed = true
        } catch (error) {
          // logger.error('verification:create reconcile failed')
          // Using ax.logger if available or just console.error or ignore as ax.logger might not be in scope here if ax is not used in this scope?
          // ax is available in hook scope.
          ax.logger.error('verification:create reconcile failed', {
            safeMessage: error,
          })
        }
        if (confirmed) {
          await updateProfileVerificationCache({profile})
        }
      })()
    },
  })
}
