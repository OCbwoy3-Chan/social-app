import {
  type ComponentType,
  Fragment,
  useCallback,
  useEffect,
  useReducer,
} from 'react'
import {View} from 'react-native'
import * as Device from 'expo-device'
import {isNative} from '@bsky.app/alf'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {
  useSetStatsigGateOverride,
  useStatsigGateOverrides,
} from '#/state/crack/statsig-overrides'
import {emitOpenNuxDialog, emitOpenWelcomeModal} from '#/state/events'
import {
  type CrackSettings,
  type CrackSettingsButtonItem,
  type CrackSettingsSection,
  crackSettingsSections,
  useCrackSettings,
  useCrackSettingsApi,
} from '#/state/preferences'
import {type CrackSettingsPickerItem} from '#/state/preferences/crack-settings-api'
import {type Nux, nuxNames} from '#/state/queries/nuxs/definitions'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRight} from '#/components/icons/Chevron'
import {CircleX_Stroke2_Corner0_Rounded as CircleXIcon} from '#/components/icons/CircleX'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Filter_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/Filter'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {VerifierCheck as VerifierCheckIcon} from '#/components/icons/VerifierCheck'
import {Window_Stroke2_Corner2_Rounded as WindowIcon} from '#/components/icons/Window'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {
  Features as GrowthbookFeatures,
  features as growthbook,
} from '#/analytics/features'
import packageJson from '../../../package.json'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldIcon} from '../icons/Shield'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'CrackSettings'>

export function CrackSettingsScreen({}: Props) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const settings = useCrackSettings()
  const {update} = useCrackSettingsApi()
  const navigation = useNavigation<NavigationProp>()

  const onToggleSetting = (key: keyof CrackSettings, value: boolean) => {
    update({[key]: value} as Partial<CrackSettings>)
  }

  const onPickerChange = (key: keyof CrackSettings, value: string) => {
    update({[key]: value} as Partial<CrackSettings>)
  }

  const onPressButton = (item: CrackSettingsButtonItem) => {
    switch (item.id) {
      case 'openWelcomeModal':
        emitOpenWelcomeModal()
        break
      case 'openVerificationSettings':
        navigation.navigate('CrackVerificationSettings')
        break
      case 'openTrustedCancellersSettings':
        navigation.navigate('CrackTrustedCancellersSettings')
        break
      case 'openAlterEgo':
        navigation.navigate('CrackAlterEgoSettings')
        break
      default: {
        if (item.id.startsWith('openNux:')) {
          const rawId = item.id.replace('openNux:', '') as Nux
          if (nuxNames.has(rawId)) {
            emitOpenNuxDialog(rawId)
          }
        }
      }
    }
  }

  return (
    <Layout.Screen testID="crackSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>TV Time</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.pt_2xl, a.px_lg, gtMobile && a.px_2xl]}>
          {crackSettingsSections.map((section, sectionIndex) => {
            const visibleItems = section.items.filter(
              item => !item.predicate || item.predicate(),
            )
            if (!visibleItems.length && section.id !== 'statsig') return null
            return (
              <View key={section.id} style={[sectionIndex > 0 && a.pt_2xl]}>
                <Text
                  style={[
                    a.text_md,
                    a.font_semi_bold,
                    a.pb_md,
                    t.atoms.text_contrast_high,
                  ]}>
                  {section.title}
                </Text>
                <View
                  style={[
                    a.w_full,
                    a.rounded_md,
                    a.overflow_hidden,
                    t.atoms.bg_contrast_25,
                  ]}>
                  {section.id === 'statsig' ? (
                    <FeatureGateOverrides />
                  ) : (
                    visibleItems.map((item, itemIndex) => (
                      <Fragment
                        key={
                          item.type === 'button'
                            ? item.id
                            : item.type === 'toggle'
                              ? item.key
                              : item.key
                        }>
                        {itemIndex > 0 && <Divider />}
                        {item.type === 'toggle' ? (
                          <ToggleRow
                            icon={getItemIcon(item)}
                            title={item.label}
                            description={item.description}
                            name={item.key}
                            //@ts-expect-error
                            value={settings[item.key]!}
                            onChange={next => onToggleSetting(item.key, next)}
                          />
                        ) : item.type === 'picker' ? (
                          <PickerRow
                            title={item.label}
                            description={item.description}
                            name={item.key}
                            //@ts-expect-error
                            value={settings[item.key]!}
                            options={item.options}
                            onChange={next => onPickerChange(item.key, next)}
                          />
                        ) : (
                          <ActionRow
                            icon={getItemIcon(item)}
                            title={item.label}
                            description={item.description}
                            onPress={() => onPressButton(item)}
                          />
                        )}
                      </Fragment>
                    ))
                  )}
                </View>
              </View>
            )
          })}
          {isNative ? (
            <View style={[a.pt_lg]}>
              <Text style={[a.text_center]}>
                Expo SDK {packageJson.dependencies.expo}, React Native{' '}
                {packageJson.dependencies['react-native']}
              </Text>
              <Text style={[a.text_center]}>
                Running on {Device.brand === 'Apple' ? 'iOS' : 'Android'}{' '}
                {Device.osVersion} ({Device.osInternalBuildId})
              </Text>
              <Text style={[a.text_center]}>
                {Device.modelId} {Device.supportedCpuArchitectures}
              </Text>
            </View>
          ) : (
            <View style={[a.pt_lg]}>
              <Text style={[a.text_center]}>
                No React Native? ({Device.osName} {Device.osVersion})
              </Text>
            </View>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

function getItemIcon(
  item: CrackSettingsSection['items'][number],
): ComponentType<SVGIconProps> {
  if (item.type === 'toggle') {
    if (item.key === 'kawaiiMode') return SparkleIcon
    if (item.key === 'customVerificationsEnabled') return VerifierCheckIcon
    if (item.key === 'trustedCancellersEnabled') return ShieldIcon
    if (item.key === 'hijackHideLabels') return CircleXIcon
    if (item.key === 'uncapLabelerLimit') return ShieldIcon
    if (item.key === 'removeAppLabelers') return ShieldIcon

    return FilterIcon
  }
  if (item.type === 'button') {
    if (item.id === 'openVerificationSettings') return VerifierCheckIcon
    if (item.id === 'openTrustedCancellersSettings') return ShieldIcon
    if (item.id === 'openAlterEgo') return SparkleIcon
    return WindowIcon
  }
  return FilterIcon
}

function PickerRow({
  title,
  description,
  name,
  value,
  options,
  onChange,
}: {
  title: string
  description: string
  name: string
  value: string
  options: CrackSettingsPickerItem['options']
  onChange: (next: string) => void
}) {
  const t = useTheme()
  const {_} = useLingui()

  return (
    <View style={[a.w_full, a.p_lg, a.gap_sm]}>
      <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
      {description && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {description}
        </Text>
      )}
      <Toggle.Group
        label={_(msg`Choose an option for ${name}`)}
        type="radio"
        values={[value]}
        onChange={vals => onChange(vals[0])}>
        <View style={[a.flex_row, a.gap_sm]}>
          {options.map(option => (
            <Toggle.Item
              key={option.value}
              name={option.value}
              label={option.label}
              style={[a.flex_1]}>
              {({selected}) => (
                <Toggle.Panel active={selected}>
                  <Toggle.Radio />
                  <Toggle.PanelText>{option.label}</Toggle.PanelText>
                </Toggle.Panel>
              )}
            </Toggle.Item>
          ))}
        </View>
      </Toggle.Group>
    </View>
  )
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  name,
  value,
  onChange,
  disabled = false,
  status,
}: {
  icon: ComponentType<SVGIconProps>
  title: string
  description: string
  name: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  status?: string
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
      <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_1]}>
        <Icon size="md" style={[t.atoms.text_contrast_medium]} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
          {description && (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {description}
            </Text>
          )}
          {status && (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {status}
            </Text>
          )}
        </View>
      </View>
      <Toggle.Item
        label={title}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}>
        <Toggle.Switch />
      </Toggle.Item>
    </View>
  )
}

function ActionRow({
  icon: Icon,
  title,
  description,
  onPress,
  disabled = false,
}: {
  icon: ComponentType<SVGIconProps>
  title: string
  description: string
  onPress: () => void
  disabled?: boolean
}) {
  const t = useTheme()

  return (
    <Button
      label={title}
      variant="ghost"
      color="secondary"
      style={[a.w_full, {backgroundColor: 'transparent'}]}
      onPress={onPress}
      disabled={disabled}>
      {state => (
        <View
          style={[
            a.w_full,
            a.flex_row,
            a.align_center,
            a.justify_between,
            a.p_lg,
            a.gap_sm,
            !state.disabled &&
              (state.hovered || state.pressed) && [t.atoms.bg_contrast_50],
          ]}>
          <View style={[a.flex_row, a.align_center, a.gap_md, a.flex_1]}>
            <Icon size="md" style={[t.atoms.text_contrast_medium]} />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {description}
              </Text>
            </View>
          </View>
          <ChevronRight
            size="sm"
            style={[t.atoms.text_contrast_low, a.self_end, {paddingBottom: 2}]}
          />
        </View>
      )}
    </Button>
  )
}

// DO NOT ADD DESCRIPTION OR LABEL. USE RAW LABEL ONLY
const FEATURE_GATES: GrowthbookFeatures[] = [
  GrowthbookFeatures.DebugFeedContext,
  GrowthbookFeatures.IsBskyTeam,
  GrowthbookFeatures.ImportContactsOnboardingDisable,
  GrowthbookFeatures.ImportContactsSettingsDisable,
  GrowthbookFeatures.LiveNowBetaDisable,
]

function FeatureGateOverrides() {
  const {_} = useLingui()
  const overrides = useStatsigGateOverrides()
  const setOverride = useSetStatsigGateOverride()
  const {update} = useCrackSettingsApi()
  const [, forceUpdate] = useReducer(count => count + 1, 0)

  useEffect(() => {
    return growthbook.subscribe(() => {
      forceUpdate()
    })
  }, [])

  const gateOverrides = overrides ?? {}
  const hasOverrides = Object.keys(gateOverrides).length > 0

  const handleClearOverrides = useCallback(() => {
    update({statsigGateOverrides: {}})
  }, [update])

  const ax = useAnalytics()

  return (
    <View>
      {FEATURE_GATES.map((gate, index) => {
        const value = ax.features.enabled(gate)
        // const status = value ? _(msg`Enabled`) : _(msg`Disabled`)

        return (
          <Fragment key={gate}>
            {index > 0 && <Divider />}
            <ToggleRow
              icon={FilterIcon}
              title={gate}
              description={''}
              // status={status}
              name={gate}
              value={value}
              onChange={next => setOverride(gate, next)}
            />
          </Fragment>
        )
      })}
      <Divider />
      <ActionRow
        icon={FilterIcon}
        title={_(msg`Clear gate overrides`)}
        description={_(msg`Revert to remote gate values.`)}
        onPress={handleClearOverrides}
        disabled={!hasOverrides}
      />
    </View>
  )
}
