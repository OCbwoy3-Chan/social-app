import {useCallback, useMemo} from 'react'
import {AtUri} from '@atproto/api'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {useCrackSettings} from '#/state/preferences'
import {useAgent, useSession} from '#/state/session'
import {clearCustomVerificationCache} from '#/state/verification/custom-verification'
import {account, useStorage} from '#/storage'

const FALLBACK_ACCOUNT_SCOPE = 'pwi'
const CANCELLATION_COLLECTION = 'app.bsky.graph.cancellation'
const QUERY_KEY_ROOT = 'custom-verification-cancellations'

export type CustomVerificationCancellation = {
  issuer: string
  subject: string
  uri?: string
  createdAt?: string
  handle?: string
  displayName?: string
}

export function useCustomVerificationCancellersEnabled() {
  const {trustedCancellersEnabled} = useCrackSettings()
  return Boolean(trustedCancellersEnabled)
}

function getCancellationKey({issuer, subject}: CustomVerificationCancellation) {
  return `${issuer}:${subject}`
}

function dedupeCancellations(
  cancellations: CustomVerificationCancellation[],
): CustomVerificationCancellation[] {
  const map = new Map<string, CustomVerificationCancellation>()

  for (const cancellation of cancellations) {
    if (!cancellation.issuer || !cancellation.subject) continue
    map.set(getCancellationKey(cancellation), cancellation)
  }

  return Array.from(map.values())
}

export function useCustomVerificationTrustedCancellerList() {
  const {currentAccount} = useSession()
  const scope = currentAccount?.did ?? FALLBACK_ACCOUNT_SCOPE
  const [trusted = [], setTrusted] = useStorage(account, [
    scope,
    'trustedCancellers',
  ] as const)

  const addTrusted = useCallback(
    (did: string) => {
      if (!did) return
      const next = new Set(trusted)
      next.add(did)
      setTrusted(Array.from(next))
      clearCustomVerificationCache()
    },
    [setTrusted, trusted],
  )

  const removeTrusted = useCallback(
    (did: string) => {
      setTrusted(trusted.filter(entry => entry !== did))
      clearCustomVerificationCache()
    },
    [setTrusted, trusted],
  )

  const toggleTrusted = useCallback(
    (did: string) => {
      if (trusted.includes(did)) {
        removeTrusted(did)
      } else {
        addTrusted(did)
      }
    },
    [addTrusted, removeTrusted, trusted],
  )

  const setTrustedList = useCallback(
    (next: string[]) => {
      setTrusted(next)
      clearCustomVerificationCache()
    },
    [setTrusted],
  )

  const clearTrusted = useCallback(() => {
    setTrustedList([])
  }, [setTrustedList])

  const trustedSet = useMemo(() => new Set(trusted), [trusted])

  return {
    trusted,
    trustedSet,
    addTrusted,
    removeTrusted,
    toggleTrusted,
    setTrustedList,
    clearTrusted,
  }
}

export function useCustomVerificationTrustedCancellers(mandatoryDid?: string) {
  const {trustedSet} = useCustomVerificationTrustedCancellerList()

  return useMemo(() => {
    const next = new Set(trustedSet)
    if (mandatoryDid) {
      next.add(mandatoryDid)
    }
    return next
  }, [mandatoryDid, trustedSet])
}

export function useCustomVerificationCancellations() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const qc = useQueryClient()
  const scope = currentAccount?.did ?? FALLBACK_ACCOUNT_SCOPE
  const [cancellations = [], setCancellations] = useStorage(account, [
    scope,
    'verificationCancellations',
  ] as const)
  const query = useQuery<CustomVerificationCancellation[]>({
    enabled: Boolean(currentAccount?.did),
    queryKey: [QUERY_KEY_ROOT, currentAccount?.did],
    queryFn: async () => {
      if (!currentAccount?.did) return []

      const next: CustomVerificationCancellation[] = []
      let cursor: string | undefined

      do {
        const res = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: CANCELLATION_COLLECTION,
          cursor,
          limit: 100,
        })

        for (const record of res.data.records) {
          const value = record.value as {
            subject?: unknown
            createdAt?: unknown
            handle?: unknown
            displayName?: unknown
          }
          if (typeof value.subject !== 'string') continue
          next.push({
            issuer: currentAccount.did,
            subject: value.subject,
            uri: record.uri,
            createdAt:
              typeof value.createdAt === 'string' ? value.createdAt : undefined,
            handle: typeof value.handle === 'string' ? value.handle : undefined,
            displayName:
              typeof value.displayName === 'string'
                ? value.displayName
                : undefined,
          })
        }

        cursor = res.data.cursor
      } while (cursor)

      return dedupeCancellations(next)
    },
    initialData: cancellations,
  })

  const setCancellationList = useCallback(
    (next: CustomVerificationCancellation[]) => {
      const deduped = dedupeCancellations(next)
      setCancellations(deduped)
      qc.setQueryData([QUERY_KEY_ROOT, currentAccount?.did], deduped)
      clearCustomVerificationCache()
    },
    [currentAccount?.did, qc, setCancellations],
  )

  const addCancellation = useCallback(
    async (next: CustomVerificationCancellation) => {
      if (!currentAccount?.did) {
        throw new Error('User not logged in')
      }

      const createdAt = new Date().toISOString()
      const res = await agent.com.atproto.repo.createRecord({
        repo: currentAccount.did,
        collection: CANCELLATION_COLLECTION,
        validate: false,
        record: {
          $type: CANCELLATION_COLLECTION,
          subject: next.subject,
          createdAt,
          handle: next.handle ?? '',
          displayName: next.displayName ?? '',
        },
      })

      setCancellationList([
        ...query.data,
        {
          ...next,
          issuer: currentAccount.did,
          uri: res.data.uri,
          createdAt,
        },
      ])
    },
    [agent, currentAccount, query.data, setCancellationList],
  )

  const removeCancellation = useCallback(
    async (target: CustomVerificationCancellation) => {
      if (!currentAccount?.did) {
        throw new Error('User not logged in')
      }

      const existing = query.data.find(
        cancellation =>
          getCancellationKey(cancellation) === getCancellationKey(target),
      )
      const uri = target.uri ?? existing?.uri
      if (!uri) {
        setCancellationList(
          query.data.filter(
            cancellation =>
              getCancellationKey(cancellation) !== getCancellationKey(target),
          ),
        )
        return
      }

      await agent.com.atproto.repo.deleteRecord({
        repo: currentAccount.did,
        collection: CANCELLATION_COLLECTION,
        rkey: new AtUri(uri).rkey,
      })

      setCancellationList(
        query.data.filter(
          cancellation =>
            getCancellationKey(cancellation) !== getCancellationKey(target),
        ),
      )
    },
    [agent, currentAccount, query.data, setCancellationList],
  )

  const cancellationSet = useMemo(
    () => new Set(query.data.map(getCancellationKey)),
    [query.data],
  )

  const hasCancellation = useCallback(
    (target: CustomVerificationCancellation) => {
      return cancellationSet.has(getCancellationKey(target))
    },
    [cancellationSet],
  )

  return {
    cancellations: query.data,
    cancellationSet,
    hasCancellation,
    addCancellation,
    removeCancellation,
    setCancellationList,
    isLoading: query.isLoading,
  }
}
