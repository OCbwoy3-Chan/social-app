import {Fragment, type ReactNode, useMemo} from 'react'
import {View} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import {type AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQuery} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {makeProfileLink} from '#/lib/routes/links'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useAlterEgoProfileFields} from '#/state/crack/alter-ego'
import {useCrackSettings, useCrackSettingsApi} from '#/state/preferences'
import {
  APPVIEW_DEFAULT_VERIFIERS,
  LABELER_NEG_VERIFIERS,
} from '#/state/preferences/crack-settings-api'
import {useMyLabelersQuery} from '#/state/queries/preferences/moderation'
import {useAgent, useSession} from '#/state/session'
import {
  useCustomVerificationCancellations,
  useCustomVerificationCancellersEnabled,
  useCustomVerificationTrustedCancellerList,
} from '#/state/verification/crack/custom-cancellers'
import {useCustomVerificationTrustedList} from '#/state/verification/custom-verifiers'
import * as Toast from '#/view/com/util/Toast'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {AgField} from '../crack/AgField'

type VerificationProps = NativeStackScreenProps<
  CommonNavigatorParams,
  'CrackVerificationSettings'
>

type TrustedCancellersProps = NativeStackScreenProps<
  CommonNavigatorParams,
  'CrackTrustedCancellersSettings'
>

type ProfileMap = Map<string, AppBskyActorDefs.ProfileViewDetailed>

const QUERY_KEY_ROOT = 'custom-verifier-profiles'

export function CrackVerificationSettingsScreen({}: VerificationProps) {
  const {_} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const {trusted, setTrustedList, addTrusted, removeTrusted} =
    useCustomVerificationTrustedList()
  const {customVerificationsEnabled} = useCrackSettings()
  const {update} = useCrackSettingsApi()
  const labelers = useMyLabelersQuery()

  const orderedVerifierDids = useMemo(() => trusted, [trusted])
  const profilesQuery = useProfilesQuery({agent, dids: orderedVerifierDids})
  const negatedByMap = useVerifierNegatedByMap(labelers.data)
  const canCopy = trusted.length > 0

  const onCopyDids = async () => {
    if (!trusted.length) return
    await Clipboard.setStringAsync(trusted.join('\n'))
    Toast.show(_(msg`Copied verifier DIDs to clipboard`))
  }

  const onResetList = () => {
    setTrustedList([...APPVIEW_DEFAULT_VERIFIERS])
    Toast.show(_(msg`Reset trusted verifiers to defaults`))
  }

  return (
    <Layout.Screen testID="crackVerificationSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Verification settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <View style={[a.pt_2xl, a.px_lg, gtMobile && a.px_2xl]}>
          <Text
            style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_high]}>
            <Trans>Verification settings</Trans>
          </Text>

          <View
            style={[
              a.w_full,
              a.rounded_md,
              a.overflow_hidden,
              t.atoms.bg_contrast_25,
              a.mt_lg,
            ]}>
            <ToggleRow
              title={_(msg`Use custom verifiers`)}
              description={_(
                msg`Use your own trusted verifiers instead of defaults.`,
              )}
              name="customVerificationsEnabled"
              value={Boolean(customVerificationsEnabled)}
              onChange={next => update({customVerificationsEnabled: next})}
            />
            <Divider />
            <ToggleRow
              title={_(msg`Become a trusted verifier`)}
              description={_(
                msg`Add your account to your trusted verifier list.`,
              )}
              name="becomeTrustedVerifier"
              value={Boolean(
                currentAccount?.did && trusted.includes(currentAccount.did),
              )}
              disabled={!currentAccount?.did}
              onChange={next => {
                if (!currentAccount?.did) return
                next
                  ? addTrusted(currentAccount.did)
                  : removeTrusted(currentAccount.did)
              }}
            />
          </View>

          <SectionHeader
            title={_(msg`Trusted verifiers`)}
            actions={
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Button
                  label="Copy DIDs"
                  size="tiny"
                  shape="rectangular"
                  variant="outline"
                  color="secondary"
                  disabled={!canCopy}
                  onPress={() => void onCopyDids()}>
                  <ButtonText>
                    <Trans>Copy DIDs</Trans>
                  </ButtonText>
                </Button>
                <Button
                  label="Reset to AppView defaults"
                  size="tiny"
                  shape="rectangular"
                  variant="outline"
                  color="secondary"
                  onPress={onResetList}>
                  <ButtonText>
                    <Trans>Reset</Trans>
                  </ButtonText>
                </Button>
              </View>
            }
          />

          <View
            style={[
              a.w_full,
              a.rounded_md,
              a.overflow_hidden,
              t.atoms.bg_contrast_25,
              a.mt_lg,
            ]}>
            {orderedVerifierDids.length === 0 ? (
              <View style={[a.p_lg]}>
                <Text style={[t.atoms.text_contrast_medium]}>
                  <Trans>No trusted verifiers yet.</Trans>
                </Text>
              </View>
            ) : (
              orderedVerifierDids.map((did, index) => (
                <TrustedProfileRow
                  key={did}
                  did={did}
                  index={index}
                  profilesQuery={profilesQuery}
                  negatedByMap={negatedByMap}
                />
              ))
            )}
          </View>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

export function CrackTrustedCancellersSettingsScreen({}: TrustedCancellersProps) {
  const {_} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const {trusted: trustedCancellers, setTrustedList: setTrustedCancellerList} =
    useCustomVerificationTrustedCancellerList()
  const {cancellations} = useCustomVerificationCancellations()
  const trustedCancellersEnabled = useCustomVerificationCancellersEnabled()
  const {update} = useCrackSettingsApi()

  const orderedCancellerDids = useMemo(() => {
    const next = new Set<string>()
    if (currentAccount?.did) {
      next.add(currentAccount.did)
    }
    for (const did of trustedCancellers) {
      next.add(did)
    }
    return Array.from(next)
  }, [currentAccount, trustedCancellers])

  const orderedCancelledProfileDids = useMemo(() => {
    const cancelledSubjects = cancellations
      .filter(cancellation => cancellation.issuer === currentAccount?.did)
      .map(cancellation => cancellation.subject)
    return Array.from(new Set(cancelledSubjects))
  }, [cancellations, currentAccount?.did])

  const orderedProfileDids = useMemo(
    () =>
      Array.from(
        new Set([...orderedCancellerDids, ...orderedCancelledProfileDids]),
      ),
    [orderedCancellerDids, orderedCancelledProfileDids],
  )

  const profilesQuery = useProfilesQuery({agent, dids: orderedProfileDids})
  const canCopyCancellers = orderedCancellerDids.length > 0

  const onCopyCancellerDids = async () => {
    if (!orderedCancellerDids.length) return
    await Clipboard.setStringAsync(orderedCancellerDids.join('\n'))
    Toast.show(_(msg`Copied canceller DIDs to clipboard`))
  }

  const onResetCancellers = () => {
    setTrustedCancellerList([])
    Toast.show(_(msg`Reset trusted cancellers to your account only`))
  }

  return (
    <Layout.Screen testID="crackTrustedCancellersSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Trusted cancellers</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <View style={[a.pt_2xl, a.px_lg, gtMobile && a.px_2xl]}>
          <Text
            style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_high]}>
            <Trans>Trusted cancellers</Trans>
          </Text>

          <View
            style={[
              a.w_full,
              a.rounded_md,
              a.overflow_hidden,
              t.atoms.bg_contrast_25,
              a.mt_lg,
            ]}>
            <ToggleRow
              title={_(msg`Use trusted cancellers`)}
              description={_(
                msg`Allow trusted cancellers to locally revoke blue checks.`,
              )}
              name="trustedCancellersEnabled"
              value={Boolean(trustedCancellersEnabled)}
              onChange={next => update({trustedCancellersEnabled: next})}
            />
          </View>

          <SectionHeader
            title={_(msg`Trusted cancellers`)}
            actions={
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Button
                  label="Copy canceller DIDs"
                  size="tiny"
                  shape="rectangular"
                  variant="outline"
                  color="secondary"
                  disabled={!canCopyCancellers}
                  onPress={() => void onCopyCancellerDids()}>
                  <ButtonText>
                    <Trans>Copy DIDs</Trans>
                  </ButtonText>
                </Button>
                <Button
                  label="Reset trusted cancellers"
                  size="tiny"
                  shape="rectangular"
                  variant="outline"
                  color="secondary"
                  onPress={onResetCancellers}>
                  <ButtonText>
                    <Trans>Reset</Trans>
                  </ButtonText>
                </Button>
              </View>
            }
          />

          <View
            style={[
              a.w_full,
              a.rounded_md,
              a.overflow_hidden,
              t.atoms.bg_contrast_25,
              a.mt_lg,
            ]}>
            {orderedCancellerDids.length === 0 ? (
              <View style={[a.p_lg]}>
                <Text style={[t.atoms.text_contrast_medium]}>
                  <Trans>No trusted cancellers yet.</Trans>
                </Text>
              </View>
            ) : (
              orderedCancellerDids.map((did, index) => (
                <TrustedProfileRow
                  key={did}
                  did={did}
                  index={index}
                  profilesQuery={profilesQuery}
                />
              ))
            )}
          </View>

          <SectionHeader title={_(msg`Unverified users`)} />

          <View
            style={[
              a.w_full,
              a.rounded_md,
              a.overflow_hidden,
              t.atoms.bg_contrast_25,
              a.mt_lg,
            ]}>
            {orderedCancelledProfileDids.length === 0 ? (
              <View style={[a.p_lg]}>
                <Text style={[t.atoms.text_contrast_medium]}>
                  <Trans>You have not unverified any users yet.</Trans>
                </Text>
              </View>
            ) : (
              orderedCancelledProfileDids.map((did, index) => (
                <TrustedProfileRow
                  key={did}
                  did={did}
                  index={index}
                  profilesQuery={profilesQuery}
                />
              ))
            )}
          </View>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function useProfilesQuery({
  agent,
  dids,
}: {
  agent: ReturnType<typeof useAgent>
  dids: string[]
}) {
  return useQuery<ProfileMap>({
    enabled: dids.length > 0,
    queryKey: [QUERY_KEY_ROOT, dids],
    queryFn: async (): Promise<ProfileMap> => {
      const profilesByDid: ProfileMap = new Map()
      for (const didChunk of chunk(dids, 25)) {
        try {
          const res = await agent.getProfiles({actors: didChunk})
          for (const profile of res.data.profiles) {
            profilesByDid.set(profile.did, profile)
          }
        } catch (error) {
          logger.warn('Failed to fetch verifier profile batch', {
            error,
            dids: didChunk,
          })
          const fallback = await Promise.allSettled(
            didChunk.map(async did => {
              const res = await agent.getProfile({actor: did})
              return res.data
            }),
          )
          for (const result of fallback) {
            if (result.status === 'fulfilled') {
              profilesByDid.set(result.value.did, result.value)
            }
          }
        }
      }
      return profilesByDid
    },
  })
}

function useVerifierNegatedByMap(
  labelers: ReturnType<typeof useMyLabelersQuery>['data'],
) {
  return useMemo(() => {
    const map = new Map<
      string,
      Array<{did: string; handle: string; handleRaw?: string}>
    >()

    for (const labeler of labelers ?? []) {
      const negated = LABELER_NEG_VERIFIERS[labeler.creator.did]
      if (!negated?.length) continue

      const handleRaw = labeler.creator.handle
      const handle = handleRaw
        ? sanitizeHandle(handleRaw, '')
        : labeler.creator.did

      for (const did of negated) {
        const existing = map.get(did) ?? []
        map.set(did, [
          ...existing,
          {did: labeler.creator.did, handle, handleRaw},
        ])
      }
    }

    return map
  }, [labelers])
}

function TrustedProfileRow({
  did,
  index,
  profilesQuery,
  negatedByMap,
}: {
  did: string
  index: number
  profilesQuery: ReturnType<typeof useQuery<ProfileMap>>
  negatedByMap?: Map<
    string,
    Array<{did: string; handle: string; handleRaw?: string}>
  >
}) {
  const t = useTheme()
  const profile = profilesQuery?.data?.get(did)
  const displayProfile = useAlterEgoProfileFields({did})

  const handle = profile?.handle ?? did
  const safeHandle = profile?.handle
    ? sanitizeHandle(profile.handle, '')
    : handle
  const displayName = profile?.displayName?.trim() || safeHandle
  const negatedBy = negatedByMap?.get(did)

  const to = makeProfileLink({
    did,
    handle: profile?.handle ?? did,
  })

  return (
    <Fragment>
      {index > 0 && <Divider />}
      <Link label={displayName} to={to}>
        {state => (
          <View
            style={[
              a.w_full,
              a.flex_row,
              a.align_center,
              a.justify_between,
              a.p_lg,
              a.gap_sm,
              (state.hovered || state.pressed) && t.atoms.bg_contrast_50,
            ]}>
            <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_1]}>
              <UserAvatar
                type="user"
                size={40}
                avatar={displayProfile.avatar ?? profile?.avatar}
              />
              <View style={[a.flex_1, a.gap_2xs]}>
                <Text style={[a.text_md, a.font_semi_bold]}>
                  <AgField field="displayName" value={displayName} did={did} />
                </Text>

                {negatedBy?.length ? (
                  <Text style={[a.text_sm, a.flex_wrap]}>
                    <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                      {safeHandle}
                    </Text>
                    {' · '}
                    <Text
                      style={{color: t.palette.negative_600, paddingRight: 3}}>
                      <Trans>Negated</Trans>
                    </Text>
                  </Text>
                ) : (
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    {safeHandle}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </Link>
    </Fragment>
  )
}

function SectionHeader({title, actions}: {title: string; actions?: ReactNode}) {
  const t = useTheme()

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_md,
        a.pt_2xl,
      ]}>
      <Text style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_high]}>
        {title}
      </Text>
      {actions}
    </View>
  )
}

function ToggleRow({
  title,
  description,
  name,
  value,
  disabled,
  onChange,
}: {
  title: string
  description: string
  name: string
  value: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  const t = useTheme()

  return (
    <View
      style={[
        a.w_full,
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.p_lg,
        a.gap_sm,
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {description}
        </Text>
      </View>
      <Toggle.Item
        label={title}
        name={name}
        value={value}
        disabled={disabled}
        onChange={onChange}>
        <Toggle.Switch />
      </Toggle.Item>
    </View>
  )
}
