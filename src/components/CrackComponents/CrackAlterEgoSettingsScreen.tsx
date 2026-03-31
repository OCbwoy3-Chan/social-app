import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {getAlterEgoDisplayLabel, parseAlterEgoUri} from '#/lib/crack/alter-ego'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {logger} from '#/logger'
import {
  fetchAlterEgoProfile,
  useSetActiveAlterEgo,
} from '#/state/crack/alter-ego'
import {useCrackSettings, useCrackSettingsApi} from '#/state/preferences'
import {useAgent} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {AlterEgoEditorDialog} from '#/components/crack/AlterEgoEditorDialog'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '../icons/Pencil'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'CrackAlterEgoSettings'
>

export function CrackAlterEgoSettingsScreen({}: Props) {
  const t = useTheme()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
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

  const alterEgoEnabled = Boolean(settings.alterEgoEnabled)
  const activeByDid = useMemo(
    () => settings.alterEgoByDid ?? {},
    [settings.alterEgoByDid],
  )
  const activeDid = useMemo(
    () => Object.entries(activeByDid).find(([, uri]) => uri)?.[0] ?? undefined,
    [activeByDid],
  )
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
      if (alterEgoEnabled) {
        setActiveAlterEgo(parsed.repo, nextUri)
        Toast.show(_(msg`Alter ego applied.`))
      } else {
        Toast.show(_(msg`Alter ego saved.`))
      }
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
    clearAlterEgo()
    setDraftUri('')
    setError(null)
    setShowAddForm(false)
    Toast.show(_(msg`Alter egos reset.`))
  }

  return (
    <Layout.Screen testID="crackAlterEgoSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Alter ego</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.pt_2xl, a.px_lg, gtMobile && a.px_2xl]}>
          <Text
            style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_high]}>
            <Trans>Alter Ego</Trans>
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
              title={_(msg`Enable alter ego`)}
              description={''}
              name="alterEgoEnabled"
              value={alterEgoEnabled}
              onChange={next => update({alterEgoEnabled: next})}
            />
          </View>

          <View style={[a.pt_2xl]}>
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.justify_between,
                a.gap_sm,
                {flexWrap: 'wrap'},
              ]}>
              <Text
                style={[
                  a.text_md,
                  a.font_semi_bold,
                  t.atoms.text_contrast_high,
                ]}>
                <Trans>Your Alter Egos</Trans>
              </Text>
              <View style={[a.flex_row, a.gap_sm, {flexWrap: 'wrap'}]}>
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
                  a.mt_lg,
                ]}>
                <TextField.LabelText>
                  <Trans>Alter ego record URI</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={Boolean(error)}>
                  <TextField.Input
                    label={_(msg`Alter ego record URI`)}
                    value={draftUri}
                    onChangeText={value => {
                      setDraftUri(value)
                      setError(null)
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={_(
                      // at://did:plc:s7cesz7cr6ybltaryy4meb6y/dev.ocbwoy3.crack.alterego/kris
                      msg`at://did:.../dev.ocbwoy3.crack.alterego/kris`,
                    )}
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

            {!showAddForm && storedRecords.length === 0 && (
              <View
                style={[
                  a.rounded_md,
                  a.border,
                  a.p_md,
                  t.atoms.border_contrast_low,
                  a.mt_lg,
                ]}>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>No alter egos saved yet.</Trans>
                </Text>
              </View>
            )}

            {storedRecords.length > 0 && (
              <View style={[a.gap_sm, a.mt_lg]}>
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
                        t.atoms.border_contrast_low,
                        isActive && t.atoms.bg_contrast_25,
                      ]}>
                      <View
                        style={[
                          a.flex_row,
                          a.align_center,
                          a.justify_between,
                          a.p_sm,
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
                            size={36}
                            avatar={record.avatar}
                            type="user"
                          />
                          <View style={[a.flex_1]}>
                            <Text style={[a.text_sm, a.font_semi_bold]}>
                              {getAlterEgoDisplayLabel(record)}
                            </Text>
                            {record.handle && (
                              <Text
                                style={[
                                  a.text_xs,
                                  t.atoms.text_contrast_medium,
                                ]}>
                                @{record.handle}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={[a.flex_row, a.gap_sm]}>
                          <Button
                            variant="ghost"
                            color="primary"
                            size="tiny"
                            shape="round"
                            label={_(msg`Edit ego`)}
                            disabled={isSaving}
                            onPress={() => {
                              if (!recordDid) return
                              setEditorUri(record.uri)
                              editorControl.open()
                            }}>
                            <ButtonIcon icon={PencilIcon} />
                          </Button>
                          <Button
                            variant="solid"
                            color={isActive ? 'secondary' : 'primary'}
                            size="tiny"
                            shape="rectangular"
                            label={
                              isActive
                                ? _(msg`Unset alter ego`)
                                : _(msg`Use alter ego`)
                            }
                            disabled={
                              !recordDid || isSaving || !alterEgoEnabled
                            }
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
                              {isActive ? _(msg`Unset`) : _(msg`Apply`)}
                            </ButtonText>
                          </Button>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      </Layout.Content>
      <AlterEgoEditorDialog
        control={editorControl}
        uri={editorUri}
        onDismiss={() => {
          setEditorUri(null)
        }}
      />
    </Layout.Screen>
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
        {Boolean(description) && (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {description}
          </Text>
        )}
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
