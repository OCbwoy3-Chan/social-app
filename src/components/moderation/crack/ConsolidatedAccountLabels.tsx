import {useMemo} from 'react'
import {View} from 'react-native'
import {type ComAtprotoLabelDefs} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import type * as Pills from '#/components/Pills'
import {Text} from '#/components/Typography'
import {AccountLabelsDialog} from './AccountLabelsDialog'

const MAX_VISIBLE_ACCOUNT_LABELS = 3

export function isAccountLabelCause(
  cause: Pills.AppModerationCause,
): cause is Extract<Pills.AppModerationCause, {type: 'label'}> {
  return cause.type === 'label' && cause.label.uri.startsWith('did:')
}

export function ConsolidatedAccountLabels({
  causes,
  labels,
  visibleCount = MAX_VISIBLE_ACCOUNT_LABELS,
  size = 'sm',
}: {
  causes: Pills.AppModerationCause[]
  labels?: ComAtprotoLabelDefs.Label[]
  visibleCount?: number
  size?: Pills.CommonProps['size']
}) {
  const {_} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogControl()
  const hiddenCount = (labels?.length || causes.length) - visibleCount
  const {outer, text} = useMemo(() => {
    switch (size) {
      case 'lg':
        return {
          outer: [
            t.atoms.bg_contrast_25,
            {
              gap: 5,
              paddingHorizontal: 5,
              paddingVertical: 5,
            },
          ],
          text: [a.text_sm],
        }
      case 'sm':
      default:
        return {
          outer: [
            {
              paddingHorizontal: 3,
              paddingVertical: 3,
            },
          ],
          text: [a.text_xs],
        }
    }
  }, [size, t])

  if (hiddenCount <= 0) {
    return null
  }

  return (
    <>
      <Button
        label={_(msg`View labels on this account`)}
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
              outer,
              (hovered || pressed) && t.atoms.bg_contrast_50,
            ]}>
            <Text
              emoji
              style={[
                text,
                a.font_semi_bold,
                a.leading_tight,
                t.atoms.text_contrast_medium,
                {paddingHorizontal: size === 'sm' ? 3 : 5},
              ]}>
              +{hiddenCount}
            </Text>
          </View>
        )}
      </Button>

      <AccountLabelsDialog
        control={control}
        labels={
          labels || causes.filter(isAccountLabelCause).map(cause => cause.label)
        }
      />
    </>
  )
}
