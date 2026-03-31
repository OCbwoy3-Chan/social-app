import {Fragment} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {type ComAtprotoLabelDefs, type ModerationUI} from '@atproto/api'

import {getModerationCauseKey, unique} from '#/lib/moderation'
import {useModerationCauseDescription} from '#/lib/moderation/useModerationCauseDescription'
import {useCrackSettings} from '#/state/preferences'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {
  ConsolidatedAccountLabels,
  isAccountLabelCause,
} from '#/components/moderation/crack/ConsolidatedAccountLabels'
import {
  ModerationDetailsDialog,
  useModerationDetailsDialogControl,
} from '#/components/moderation/ModerationDetailsDialog'
import * as Pills from '#/components/Pills'
import {Text} from '#/components/Typography'

function LabelerConsolidatedPill({
  causes,
  size,
}: {
  causes: Pills.AppModerationCause[]
  size?: Pills.CommonProps['size']
}) {
  const t = useTheme()
  const control = useModerationDetailsDialogControl()
  const desc = useModerationCauseDescription(causes[0])
  const count = causes.length

  return (
    <>
      <Button
        label={`View ${count} labels from ${desc.sourceDisplayName ?? desc.source ?? 'labeler'}`}
        onPress={e => {
          e.preventDefault()
          e.stopPropagation()
          control.open()
        }}>
        {({hovered, pressed}) => (
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.rounded_full,
              t.atoms.bg_contrast_25,
              {padding: 3, gap: 3},
              (hovered || pressed) && t.atoms.bg_contrast_50,
            ]}>
            <UserAvatar
              avatar={desc.sourceAvi}
              type={desc.sourceType === 'labeler' ? 'labeler' : 'user'}
              size={size === 'sm' ? 12 : 16}
            />
            <Text
              style={[
                size === 'sm' ? a.text_xs : a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
                {paddingRight: 3},
              ]}>
              +{count}
            </Text>
          </View>
        )}
      </Button>
      <ModerationDetailsDialog control={control} modcause={causes[0]} />
    </>
  )
}

export function PostAlerts({
  modui,
  size = 'sm',
  style,
  additionalCauses,
  accountLabels,
}: {
  modui: ModerationUI
  size?: Pills.CommonProps['size']
  includeMute?: boolean
  style?: StyleProp<ViewStyle>
  additionalCauses?: Pills.AppModerationCause[]
  accountLabels?: ComAtprotoLabelDefs.Label[]
}) {
  const {consolidateAccountLabels, consolidationMethod} = useCrackSettings()
  const causes: Pills.AppModerationCause[] = [
    ...modui.alerts.filter(unique),
    ...modui.informs.filter(unique),
    ...(additionalCauses ?? []),
  ]

  if (!causes.length) {
    return null
  }

  const accountLabelCauses = causes.filter(
    (
      cause,
    ): cause is Extract<Pills.AppModerationCause, {type: 'label'}> =>
      isAccountLabelCause(cause),
  )
  const seenAccountLabelerDids = new Set<string>()
  const uniqueAccountLabelCauses = accountLabelCauses.filter(cause => {
    if (seenAccountLabelerDids.has(cause.label.src)) {
      return false
    }
    seenAccountLabelerDids.add(cause.label.src)
    return true
  })
  const renderedCauses = causes.filter(cause => {
    if (!isAccountLabelCause(cause)) {
      return true
    }
    return uniqueAccountLabelCauses.includes(cause)
  })

  if (consolidateAccountLabels) {
    if (consolidationMethod === 'by_labeler') {
      const otherCauses = causes.filter(c => !isAccountLabelCause(c))
      const labelsByLabeler = new Map<
        string,
        Extract<Pills.AppModerationCause, {type: 'label'}>[]
      >()

      for (const cause of accountLabelCauses) {
        const key = cause.label.src
        if (!labelsByLabeler.has(key)) {
          labelsByLabeler.set(key, [])
        }
        labelsByLabeler.get(key)!.push(cause)
      }

      return (
        <Pills.Row
          size={size}
          style={[size === 'sm' && {marginLeft: -3}, style]}>
          {otherCauses.map(cause => (
            <Pills.Label
              key={getModerationCauseKey(cause)}
              cause={cause}
              size={size}
              noBg={size === 'sm'}
            />
          ))}
          {Array.from(labelsByLabeler.entries()).map(([, labelerCauses]) => {
            if (labelerCauses.length === 1) {
              return (
                <Pills.Label
                  key={getModerationCauseKey(labelerCauses[0])}
                  cause={labelerCauses[0]}
                  size={size}
                  noBg={size === 'sm'}
                />
              )
            } else {
              return (
                <LabelerConsolidatedPill
                  key={labelerCauses[0].label.src}
                  causes={labelerCauses}
                  size={size}
                />
              )
            }
          })}
        </Pills.Row>
      )
    } else {
      const previewAccountLabelCauses = uniqueAccountLabelCauses.slice(0, 2)
      const previewAccountLabelDids = previewAccountLabelCauses.map(
        cause => cause.label.src,
      )
      const normalizedAccountLabels = accountLabels?.filter(
        label => !label.val.startsWith('!'),
      )
      const accountLabelsForOverflow =
        normalizedAccountLabels && normalizedAccountLabels.length > 0
          ? normalizedAccountLabels
          : accountLabelCauses.map(cause => cause.label)
      const shouldConsolidate =
        causes.length > 3 && accountLabelsForOverflow.length > 0

      if (shouldConsolidate) {
        return (
          <Pills.Row
            size={size}
            style={[size === 'sm' && {marginLeft: -3}, style]}>
            {(() => {
              const renderedPreviewDids = new Set<string>()
              const overflowCount =
                accountLabelsForOverflow.length - previewAccountLabelDids.length
              let renderedOverflow = false

              const items = causes.map(cause => {
                if (!isAccountLabelCause(cause)) {
                  return (
                    <Pills.Label
                      key={getModerationCauseKey(cause)}
                      cause={cause}
                      size={size}
                      noBg={size === 'sm'}
                    />
                  )
                }

                if (
                  previewAccountLabelDids.includes(cause.label.src) &&
                  !renderedPreviewDids.has(cause.label.src)
                ) {
                  renderedPreviewDids.add(cause.label.src)
                  const shouldRenderOverflowAfterPreview =
                    !renderedOverflow &&
                    overflowCount > 0 &&
                    renderedPreviewDids.size === previewAccountLabelDids.length
                  if (shouldRenderOverflowAfterPreview) {
                    renderedOverflow = true
                  }
                  return (
                    <Fragment key={getModerationCauseKey(cause)}>
                      <Pills.Label
                        cause={cause}
                        size={size}
                        noBg={size === 'sm'}
                      />
                      {shouldRenderOverflowAfterPreview ? (
                        <ConsolidatedAccountLabels
                          causes={previewAccountLabelCauses}
                          labels={accountLabelsForOverflow}
                          visibleCount={previewAccountLabelDids.length}
                          size={size}
                        />
                      ) : null}
                    </Fragment>
                  )
                }

                return null
              })

              if (!renderedOverflow && overflowCount > 0) {
                items.push(
                  <ConsolidatedAccountLabels
                    key="consolidated-account-labels"
                    causes={previewAccountLabelCauses}
                    labels={accountLabelsForOverflow}
                    visibleCount={previewAccountLabelDids.length}
                    size={size}
                  />,
                )
              }

              return items
            })()}
          </Pills.Row>
        )
      }
    }
  }

  return (
    <Pills.Row size={size} style={[size === 'sm' && {marginLeft: -3}, style]}>
      {renderedCauses.map(cause => (
        <Pills.Label
          key={getModerationCauseKey(cause)}
          cause={cause}
          size={size}
          noBg={size === 'sm'}
        />
      ))}
    </Pills.Row>
  )
}
