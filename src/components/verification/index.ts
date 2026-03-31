import {useMemo} from 'react'

import {usePreferencesQuery} from '#/state/queries/preferences'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {useSession} from '#/state/session'
import {
  useCustomVerificationCancellations,
  useCustomVerificationCancellersEnabled,
} from '#/state/verification/crack/custom-cancellers'
import {useVerificationState} from '#/state/verification/custom-verification'
import {useCustomVerificationTrustedList} from '#/state/verification/custom-verifiers'
import type * as bsky from '#/types/bsky'

export type FullVerificationState = {
  profile: {
    role: 'default' | 'verifier'
    isVerified: boolean
    wasVerified: boolean
    isViewer: boolean
    showBadge: boolean
  }
  viewer: {
    role: 'default' | 'verifier'
    isVerified: boolean
    hasIssuedVerification: boolean
    hasIssuedCancellation: boolean
  }
}

export function useFullVerificationState({
  profile,
}: {
  profile: bsky.profile.AnyProfileView
}): FullVerificationState {
  const {currentAccount} = useSession()
  const currentAccountProfile = useCurrentAccountProfile()
  const profileState = useSimpleVerificationState({profile})
  const viewerState = useSimpleVerificationState({
    profile: currentAccountProfile,
  })
  const cancellersEnabled = useCustomVerificationCancellersEnabled()
  const {hasCancellation} = useCustomVerificationCancellations()
  const {state: verificationState} = useVerificationState(profile)

  return useMemo(() => {
    const verifications = verificationState?.verifications || []
    const wasVerified =
      profileState.role === 'default' &&
      !profileState.isVerified &&
      verifications.length > 0
    const hasIssuedVerification = Boolean(
      viewerState &&
        viewerState.role === 'verifier' &&
        profileState.role === 'default' &&
        verifications.find(v => v.issuer === currentAccount?.did),
    )
    const hasIssuedCancellation = Boolean(
      cancellersEnabled &&
        currentAccount?.did &&
        hasCancellation({
          issuer: currentAccount.did,
          subject: profile.did,
        }),
    )

    return {
      profile: {
        ...profileState,
        wasVerified,
        isViewer: profile.did === currentAccount?.did,
        showBadge: profileState.showBadge,
      },
      viewer: {
        role: viewerState.role,
        isVerified: viewerState.isVerified,
        hasIssuedVerification,
        hasIssuedCancellation,
      },
    }
  }, [
    profile,
    currentAccount,
    profileState,
    viewerState,
    verificationState,
    hasCancellation,
    cancellersEnabled,
  ])
}

export type SimpleVerificationState = {
  role: 'default' | 'verifier'
  isVerified: boolean
  showBadge: boolean
}

export function useSimpleVerificationState({
  profile,
}: {
  profile?: bsky.profile.AnyProfileView
}): SimpleVerificationState {
  const preferences = usePreferencesQuery()
  const {currentAccount} = useSession()
  const {trusted} = useCustomVerificationTrustedList()
  const {state: verificationState} = useVerificationState(profile)
  const prefs = useMemo(
    () => preferences.data?.verificationPrefs || {hideBadges: false},
    [preferences.data?.verificationPrefs],
  )
  return useMemo(() => {
    if (!profile || !verificationState) {
      return {
        role: 'default',
        isVerified: false,
        showBadge: false,
      }
    }

    const {verifiedStatus} = verificationState
    const isVerifiedUser = ['valid', 'invalid'].includes(verifiedStatus)
    const isViewer = profile.did === currentAccount?.did
    const isVerifierUser = Boolean(
      isViewer && currentAccount?.did && trusted.includes(currentAccount.did),
    )
    const isVerified =
      (isVerifiedUser && verifiedStatus === 'valid') || isVerifierUser

    return {
      role: isVerifierUser ? 'verifier' : 'default',
      isVerified,
      showBadge: prefs.hideBadges ? false : isVerified,
    }
  }, [profile, prefs, verificationState, currentAccount, trusted])
}
