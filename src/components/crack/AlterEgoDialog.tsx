import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {getAlterEgoDisplayLabel, parseAlterEgoUri} from '#/lib/crack/alter-ego'
import {logger} from '#/logger'
import {
  fetchAlterEgoProfile,
  useSetActiveAlterEgo,
} from '#/state/crack/alter-ego'
import {useCrackSettings, useCrackSettingsApi} from '#/state/preferences'
import {useAgent} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {AlterEgoEditorDialog} from '#/components/crack/AlterEgoEditorDialog'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Text} from '#/components/Typography'

export function AlterEgoDialog({
  control,
}: {
  control: Dialog.DialogOuterProps['control']
}) {
  const t = useTheme()
  const {_} = useLingui()
  const agent = useAgent()
  const settings = useCrackSettings()
  const {update} = useCrackSettingsApi()
  const setActiveAlterEgo = useSetActiveAlterEgo()
  const [draftUri, setDraftUri] = useState(settings.alterEgoUri ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const editorControl = Dialog.useDialogControl()
  const [editorUri, setEditorUri] = useState<string | null>(null)

  useEffect(() => {
    setDraftUri(settings.alterEgoUri ?? '')
  }, [settings.alterEgoUri])

  const activeByDid = useMemo(
    () => settings.alterEgoByDid ?? {},
    [settings.alterEgoByDid],
  )
  const activeDid = useMemo(
    () => Object.entries(activeByDid).find(([, uri]) => uri)?.[0] ?? undefined,
    [activeByDid],
  )
  const activeUri = activeDid ? activeByDid[activeDid] : undefined
  const activeRecord = activeUri ? settings.alterEgoRecords?.[activeUri] : null
  const storedRecords = useMemo(
    () => Object.values(settings.alterEgoRecords ?? {}),
    [settings.alterEgoRecords],
  )

  const applyAlterEgo = async () => {
    const nextUri = draftUri.trim()
    if (!nextUri) {
      setError(_(msg`Enter an at:// URI for an alter ego record.`))
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const parsed = parseAlterEgoUri(nextUri)
      if (!parsed) {
        throw new Error(_(msg`Invalid alter ego URI.`))
      }
      const overlayProfile = await fetchAlterEgoProfile({agent, uri: nextUri})
      update({
        alterEgoRecords: {
          ...(settings.alterEgoRecords ?? {}),
          [overlayProfile.uri]: overlayProfile,
        },
      })
      setActiveAlterEgo(parsed.repo, nextUri)
      Toast.show(_(msg`Alter ego applied.`))
      setShowAddForm(false)
    } catch (err: any) {
      logger.error('Failed to apply alter ego', {err})
      setError(err?.message || _(msg`Failed to apply alter ego.`))
    } finally {
      setIsSaving(false)
    }
  }

  const clearAlterEgo = () => {
    if (!activeDid) {
      update({alterEgoUri: undefined})
      return
    }
    setActiveAlterEgo(activeDid, null)
    setDraftUri('')
    setError(null)
    Toast.show(_(msg`Alter ego cleared.`))
  }

  const resetAlterEgos = () => {
    update({
      alterEgoUri: undefined,
      alterEgoByDid: {},
      alterEgoRecords: {},
    })
    setDraftUri('')
    setError(null)
    setShowAddForm(false)
    Toast.show(_(msg`Alter egos reset.`))
  }

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={_(msg`Alter ego`)}
        style={web({maxWidth: 520})}>
        <View style={[a.gap_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Alter ego</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Add an at:// URI for a dev.ocbwoy3.crack.alterego record. The
              record will override your profile display data for this device.
            </Trans>
          </Text>

          {activeUri && (
            <View style={[a.gap_sm, a.rounded_md, a.p_md, t.atoms.bg]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Alter Ego</Trans>
              </Text>
              <Text style={[a.text_md, a.font_semi_bold]}>
                {activeRecord
                  ? getAlterEgoDisplayLabel(activeRecord)
                  : activeUri || draftUri}
              </Text>
              <Button
                variant="solid"
                color="secondary"
                size="small"
                label={_(msg`Unset alter ego`)}
                disabled={!activeUri || isSaving}
                onPress={clearAlterEgo}>
                <ButtonText>{_(msg`Unset alter ego`)}</ButtonText>
              </Button>
            </View>
          )}

          <View style={[a.gap_md]}>
            <View style={[a.flex_row, a.align_center, a.justify_between]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Your alter egos</Trans>
              </Text>
              <View style={[a.flex_row, a.gap_sm]}>
                <Button
                  variant="solid"
                  color="primary"
                  size="tiny"
                  label={_(msg`Add alter ego`)}
                  onPress={() => {
                    setDraftUri('')
                    setError(null)
                    setShowAddForm(true)
                  }}>
                  <ButtonText>{_(msg`Add alter ego`)}</ButtonText>
                </Button>
                <Button
                  variant="solid"
                  color="secondary"
                  size="tiny"
                  label={_(msg`Reset alter egos`)}
                  onPress={resetAlterEgos}>
                  <ButtonText>{_(msg`Reset alter egos`)}</ButtonText>
                </Button>
              </View>
            </View>

            {showAddForm && (
              <View
                style={[
                  a.rounded_md,
                  a.border,
                  a.p_md,
                  a.gap_sm,
                  t.atoms.border_contrast_low,
                ]}>
                <TextField.LabelText>
                  <Trans>Alter ego record URI</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={Boolean(error)}>
                  <Dialog.Input
                    value={draftUri}
                    onChangeText={value => {
                      setDraftUri(value)
                      setError(null)
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    label="at://did:plc:example/dev.ocbwoy3.crack.alterego/..."
                  />
                </TextField.Root>
                {error && (
                  <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
                    {error}
                  </Text>
                )}
                <View style={[a.flex_row, a.justify_end, a.gap_sm]}>
                  <Button
                    variant="solid"
                    color="secondary"
                    size="small"
                    label={_(msg`Cancel`)}
                    onPress={() => {
                      setShowAddForm(false)
                      setDraftUri('')
                      setError(null)
                    }}>
                    <ButtonText>{_(msg`Cancel`)}</ButtonText>
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    size="small"
                    label={_(msg`Add alter ego`)}
                    disabled={isSaving}
                    onPress={applyAlterEgo}>
                    <ButtonIcon icon={CheckIcon} />
                    <ButtonText>
                      {isSaving ? _(msg`Adding...`) : _(msg`Add alter ego`)}
                    </ButtonText>
                  </Button>
                </View>
              </View>
            )}

            {storedRecords.length === 0 && !showAddForm && (
              <View
                style={[
                  a.rounded_md,
                  a.border,
                  a.p_md,
                  t.atoms.border_contrast_low,
                ]}>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>No alter egos saved yet.</Trans>
                </Text>
              </View>
            )}

            {storedRecords.length > 0 && (
              <View style={[a.gap_sm]}>
                {storedRecords.map(record => {
                  const recordDid = parseAlterEgoUri(record.uri)?.repo
                  const isActive = Boolean(
                    recordDid && activeByDid[recordDid] === record.uri,
                  )
                  return (
                    <View
                      key={record.uri}
                      style={[
                        a.rounded_md,
                        a.border,
                        a.gap_sm,
                        t.atoms.border_contrast_low,
                        isActive && t.atoms.bg_contrast_25,
                      ]}>
                      <Button
                        label={_(msg`Edit alter ego`)}
                        variant="ghost"
                        color="secondary"
                        style={[a.w_full, {backgroundColor: 'transparent'}]}
                        onPress={() => {
                          setEditorUri(record.uri)
                          control.close(() => editorControl.open())
                        }}>
                        {state => (
                          <View
                            style={[
                              a.w_full,
                              a.flex_row,
                              a.align_center,
                              a.justify_between,
                              a.p_md,
                              a.gap_sm,
                              (state.hovered || state.pressed) && [
                                t.atoms.bg_contrast_50,
                              ],
                            ]}>
                            <View
                              style={[a.flex_row, a.align_center, a.gap_sm]}>
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
                                    style={[
                                      a.text_sm,
                                      t.atoms.text_contrast_medium,
                                    ]}>
                                    @{record.handle}
                                  </Text>
                                )}
                              </View>
                            </View>
                            <Text
                              style={[
                                a.text_sm,
                                a.font_semi_bold,
                                t.atoms.text_contrast_medium,
                              ]}>
                              <Trans>Edit</Trans>
                            </Text>
                          </View>
                        )}
                      </Button>
                      {record.description && (
                        <Text
                          style={[
                            a.px_md,
                            a.text_sm,
                            t.atoms.text_contrast_medium,
                          ]}
                          numberOfLines={2}>
                          {record.description}
                        </Text>
                      )}
                      <View
                        style={[
                          a.flex_row,
                          a.align_center,
                          a.justify_between,
                          a.px_md,
                          a.pb_md,
                          a.gap_sm,
                        ]}>
                        {isActive ? (
                          <Text style={[a.text_sm, t.atoms.text_contrast_low]}>
                            <Trans>Active</Trans>
                          </Text>
                        ) : (
                          <Text style={[a.text_sm, t.atoms.text_contrast_low]}>
                            <Trans>Not active</Trans>
                          </Text>
                        )}
                        <Button
                          variant="solid"
                          color={isActive ? 'secondary' : 'primary'}
                          size="small"
                          label={
                            isActive
                              ? _(msg`Unset alter ego`)
                              : _(msg`Use alter ego`)
                          }
                          disabled={!recordDid || isSaving}
                          onPress={() => {
                            if (!recordDid) return
                            if (isActive) {
                              setActiveAlterEgo(recordDid, null)
                              Toast.show(_(msg`Alter ego cleared.`))
                            } else {
                              setActiveAlterEgo(recordDid, record.uri)
                              Toast.show(_(msg`Alter ego applied.`))
                            }
                          }}>
                          <ButtonIcon icon={CheckIcon} />
                          <ButtonText>
                            {isActive ? _(msg`Unset`) : _(msg`Use alter ego`)}
                          </ButtonText>
                        </Button>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      </Dialog.ScrollableInner>
      <AlterEgoEditorDialog
        control={editorControl}
        uri={editorUri}
        onDismiss={() => {
          setEditorUri(null)
        }}
      />
    </Dialog.Outer>
  )
}
