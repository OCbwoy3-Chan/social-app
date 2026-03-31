import {useCallback, useMemo} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {getAlterEgoDisplayLabel} from '#/lib/crack/alter-ego'
import {useSetActiveAlterEgo} from '#/state/crack/alter-ego'
import {useCrackSettings} from '#/state/preferences'
import * as Toast from '#/view/com/util/Toast'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {Text} from '#/components/Typography'

export function ForceAlterEgoDialog({
  control,
  targetDid,
  targetHandle,
}: {
  control: Dialog.DialogOuterProps['control']
  targetDid: string
  targetHandle?: string
}) {
  const t = useTheme()
  const {_} = useLingui()
  const settings = useCrackSettings()
  const setActiveAlterEgo = useSetActiveAlterEgo()

  const targetLabel = targetHandle ? `@${targetHandle}` : targetDid
  const storedRecords = useMemo(
    () => Object.values(settings.alterEgoRecords ?? {}),
    [settings.alterEgoRecords],
  )
  const activeUri = settings.alterEgoByDid?.[targetDid]
  const activeRecord = activeUri ? settings.alterEgoRecords?.[activeUri] : null

  const handleApply = useCallback(
    (recordUri: string) => {
      setActiveAlterEgo(targetDid, recordUri, {skipUri: true})
      Toast.show(_(msg`Alter ego forced for ${targetLabel}`))
    },
    [setActiveAlterEgo, targetDid, targetLabel, _],
  )

  const handleClear = useCallback(() => {
    if (!activeUri) return
    setActiveAlterEgo(targetDid, null, {skipUri: true})
    Toast.show(_(msg`Forced alter ego removed for ${targetLabel}`))
  }, [setActiveAlterEgo, targetDid, targetLabel, activeUri, _])

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Force alter on ${targetLabel}`)}>
        <View style={[a.gap_lg]}>
          <View style={[a.gap_md]}>
            <Text style={[a.text_2xl, a.font_bold]}>
              <Trans>Force Alter Ego</Trans>
            </Text>
          </View>

          {activeUri && (
            <View
              style={[
                a.rounded_md,
                a.border,
                a.p_md,
                a.gap_sm,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Currently forced alter ego</Trans>
              </Text>
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.justify_between,
                  a.gap_sm,
                ]}>
                <View
                  style={[
                    a.flex_1,
                    a.flex_row,
                    a.align_center,
                    a.gap_sm,
                    {minWidth: 0},
                  ]}>
                  <UserAvatar
                    size={40}
                    avatar={activeRecord?.avatar}
                    type="user"
                  />
                  <View style={[a.flex_1]}>
                    <Text style={[a.text_md, a.font_semi_bold]}>
                      {activeRecord
                        ? getAlterEgoDisplayLabel(activeRecord)
                        : activeUri}
                    </Text>
                    {activeRecord?.handle && (
                      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                        @{activeRecord.handle}
                      </Text>
                    )}
                  </View>
                </View>
                <Button
                  variant="ghost"
                  color="negative"
                  size="small"
                  label={_(msg`Unset forced alter ego`)}
                  disabled={!activeUri}
                  onPress={handleClear}>
                  <ButtonText>
                    <Trans>Unset</Trans>
                  </ButtonText>
                </Button>
              </View>
            </View>
          )}

          {storedRecords.length === 0 ? (
            <View
              style={[
                a.rounded_md,
                a.border,
                a.p_md,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  Save an alter ego in the Crack settings before forcing it on a
                  profile.
                </Trans>
              </Text>
            </View>
          ) : (
            <View style={[a.gap_sm]}>
              {storedRecords.map(record => {
                const isActive = record.uri === activeUri

                return (
                  <View
                    key={record.uri}
                    style={[
                      a.rounded_md,
                      a.border,
                      a.p_sm,
                      a.gap_sm,
                      t.atoms.border_contrast_low,
                      isActive && t.atoms.bg_contrast_25,
                    ]}>
                    <View
                      style={[
                        a.flex_row,
                        a.align_center,
                        a.justify_between,
                        a.gap_sm,
                      ]}>
                      <View
                        style={[
                          a.flex_1,
                          a.flex_row,
                          a.align_center,
                          a.gap_sm,
                          {minWidth: 0},
                        ]}>
                        <UserAvatar
                          size={40}
                          avatar={record.avatar}
                          type="user"
                        />
                        <View style={[a.flex_1]}>
                          <Text style={[a.text_md, a.font_semi_bold]}>
                            {getAlterEgoDisplayLabel(record)}
                          </Text>
                          {record.handle && (
                            <Text
                              style={[a.text_sm, t.atoms.text_contrast_medium]}>
                              @{record.handle}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Button
                        variant="solid"
                        color={isActive ? 'secondary' : 'primary'}
                        size="small"
                        label={
                          isActive
                            ? _(msg`Unset alter ego`)
                            : _(msg`Use this Alter Ego`)
                        }
                        onPress={() =>
                          isActive ? handleClear() : handleApply(record.uri)
                        }>
                        <ButtonIcon icon={SparkleIcon} />
                        <ButtonText>
                          {isActive ? <Trans>Unset</Trans> : <Trans>Use</Trans>}
                        </ButtonText>
                      </Button>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
