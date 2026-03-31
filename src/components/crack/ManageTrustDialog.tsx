import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import type * as bsky from '#/types/bsky'

export function ManageTrustDialog({
  control,
  profile,
  canManageVerifiers,
  canManageCancellers,
  canToggleCancellation,
  isTrustedVerifier,
  isTrustedCanceller,
  hasIssuedCancellation,
  onToggleVerifier,
  onToggleCanceller,
  onToggleCancellation,
}: {
  control: Dialog.DialogOuterProps['control']
  profile: bsky.profile.AnyProfileView
  canManageVerifiers: boolean
  canManageCancellers: boolean
  canToggleCancellation: boolean
  isTrustedVerifier: boolean
  isTrustedCanceller: boolean
  hasIssuedCancellation: boolean
  onToggleVerifier: () => void
  onToggleCanceller: () => void
  onToggleCancellation: () => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const displayName =
    profile.displayName?.trim() || profile.handle || profile.did

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={_(msg`Manage trust for ${displayName}`)}
        style={[web({maxWidth: 420}), a.w_full]}>
        <View style={[a.gap_lg]}>
          <View style={[a.gap_2xs]}>
            <Text style={[a.text_2xl, a.font_semi_bold]}>
              <Trans>Manage trust</Trans>
            </Text>
          </View>

          <View
            style={[a.rounded_md, a.overflow_hidden, t.atoms.bg_contrast_25]}>
            {canManageVerifiers && (
              <ToggleActionRow
                title={_(msg`Trusted verifier`)}
                description={_(
                  msg`Can issue custom verifications in your crack settings.`,
                )}
                value={isTrustedVerifier}
                onPress={onToggleVerifier}
              />
            )}

            {canManageVerifiers && canManageCancellers && <Divider />}

            {canManageCancellers && (
              <ToggleActionRow
                title={_(msg`Trusted canceller`)}
                description={_(
                  msg`Can locally revoke blue checks in your crack settings.`,
                )}
                value={isTrustedCanceller}
                onPress={onToggleCanceller}
              />
            )}
          </View>

          {canToggleCancellation && (
            <View
              style={[a.rounded_md, a.p_lg, a.gap_md, t.atoms.bg_contrast_25]}>
              <View style={[a.gap_2xs]}>
                <Text style={[a.text_md, a.font_semi_bold]}>
                  <Trans>Blue check</Trans>
                </Text>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {hasIssuedCancellation ? (
                    <Trans>
                      This profile is currently locally cancelled for you.
                    </Trans>
                  ) : (
                    <Trans>This profile currently keeps its blue check.</Trans>
                  )}
                </Text>
              </View>

              <View style={[a.flex_row, a.justify_start]}>
                <Button
                  label={
                    hasIssuedCancellation
                      ? _(msg`Restore blue check`)
                      : _(msg`Cancel blue check`)
                  }
                  color={hasIssuedCancellation ? 'secondary' : 'negative'}
                  variant={hasIssuedCancellation ? 'outline' : 'solid'}
                  size="small"
                  onPress={onToggleCancellation}>
                  <ButtonText>
                    {hasIssuedCancellation ? (
                      <Trans>Restore blue check</Trans>
                    ) : (
                      <Trans>Cancel blue check</Trans>
                    )}
                  </ButtonText>
                </Button>
              </View>
            </View>
          )}

          <View style={[a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Done`)}
              color="primary"
              size="small"
              onPress={() => control.close()}>
              <ButtonText>
                <Trans>Done</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function ToggleActionRow({
  title,
  description,
  value,
  onPress,
}: {
  title: string
  description: string
  value: boolean
  onPress: () => void
}) {
  const t = useTheme()

  return (
    <View style={[a.gap_sm]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.gap_md,
          a.p_lg,
        ]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {description}
          </Text>
        </View>
        <Toggle.Item
          label={title}
          name={title}
          value={value}
          onChange={onPress}>
          <Toggle.Switch />
        </Toggle.Item>
      </View>
    </View>
  )
}
