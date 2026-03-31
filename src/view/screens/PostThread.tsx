import {useCallback, useMemo} from 'react'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'

import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {useActiveAlterEgo} from '#/state/crack/alter-ego'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {PostThread} from '#/screens/PostThread'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PostThread'>
export function PostThreadScreen({route}: Props) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const setMinimalShellMode = useSetMinimalShellMode()

  const {name, rkey} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)

  const activeAlterEgo = useActiveAlterEgo(currentAccount?.did ?? '')
  const customTitle = useMemo(() => {
    const isMe =
      name === 'me' ||
      name === currentAccount?.handle ||
      name === currentAccount?.did
    if (isMe && activeAlterEgo) {
      return _(msg`Post by @${activeAlterEgo.handle ?? ''}`)
    }
    return undefined
  }, [name, currentAccount, activeAlterEgo, _])

  useSetTitle(customTitle)

  useFocusEffect(
    useCallback(() => {
      setMinimalShellMode(false)
    }, [setMinimalShellMode]),
  )

  return (
    <Layout.Screen testID="postThreadScreen">
      <PostThread uri={uri} />
    </Layout.Screen>
  )
}
