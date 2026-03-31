import {useEffect, useMemo, useRef, useState} from 'react'
import {Pressable, useWindowDimensions, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Plural, Trans} from '@lingui/react/macro'

import {uploadBlob} from '#/lib/api'
import {HITSLOP_10} from '#/lib/constants'
import {
  ALTER_EGO_COLLECTION,
  type AlterEgoRecord,
  parseAlterEgoUri,
  validateAlterEgoRecord,
} from '#/lib/crack/alter-ego'
import {compressIfNeeded} from '#/lib/media/manip'
import {type PickerImage} from '#/lib/media/picker.shared'
import {cleanError} from '#/lib/strings/errors'
import {isOverMaxGraphemeCount} from '#/lib/strings/helpers'
import {isValidWebsiteFormat} from '#/lib/strings/website'
import {logger} from '#/logger'
import {
  fetchAlterEgoProfile,
  primeAlterEgoOverlay,
  resolveAlterEgoBlobRefToUrl,
} from '#/state/crack/alter-ego'
import {useCrackSettings, useCrackSettingsApi} from '#/state/preferences'
import {useAgent, useSession} from '#/state/session'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import * as Toast from '#/view/com/util/Toast'
import {EditableUserAvatar} from '#/view/com/util/UserAvatar'
import {UserBanner} from '#/view/com/util/UserBanner'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {CircleX_Stroke2_Corner0_Rounded as CircleX} from '#/components/icons/CircleX'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

const MAX_IMAGE_SIZE = 1024 * 1024
const MAX_HANDLE_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 3000
const MAX_DISPLAY_NAME_LENGTH = 64
const PRONOUNS_MAX_GRAPHEMES = 20
const WEBSITE_MAX_GRAPHEMES = 28

type InitialValues = {
  displayName: string
  handle: string
  description: string
  pronouns: string
  website: string
  avatar: string | null
  banner: string | null
}

export function AlterEgoEditorDialog({
  control,
  uri,
  onDismiss,
}: {
  control: Dialog.DialogOuterProps['control']
  uri: string | null
  onDismiss?: () => void
}) {
  const {_} = useLingui()
  const cancelControl = Dialog.useDialogControl()
  const [dirty, setDirty] = useState(false)
  const {height} = useWindowDimensions()

  const onPressCancel = () => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close(() => onDismiss?.())
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{
        preventDismiss: dirty,
        minHeight: height,
      }}
      webOptions={{
        onBackgroundPress: () => {
          if (dirty) {
            cancelControl.open()
          } else {
            control.close(() => onDismiss?.())
          }
        },
      }}>
      <DialogInner
        uri={uri}
        setDirty={setDirty}
        onDismiss={onDismiss}
        onPressCancel={onPressCancel}
      />

      <Prompt.Basic
        control={cancelControl}
        title={_(msg`Discard changes?`)}
        description={_(msg`Are you sure you want to discard your changes?`)}
        onConfirm={() => control.close(() => onDismiss?.())}
        confirmButtonCta={_(msg`Discard`)}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  uri,
  setDirty,
  onDismiss,
  onPressCancel,
}: {
  uri: string | null
  setDirty: (dirty: boolean) => void
  onDismiss?: () => void
  onPressCancel: () => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const agent = useAgent()
  const control = Dialog.useDialogContext()
  const {currentAccount} = useSession()
  const settings = useCrackSettings()
  const {update} = useCrackSettingsApi()
  const [record, setRecord] = useState<AlterEgoRecord | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [website, setWebsite] = useState('')
  const websiteInputRef = useRef<any>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [newAvatar, setNewAvatar] = useState<PickerImage | null | undefined>()
  const [newBanner, setNewBanner] = useState<PickerImage | null | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initialValues, setInitialValues] = useState<InitialValues>({
    displayName: '',
    handle: '',
    description: '',
    pronouns: '',
    website: '',
    avatar: null,
    banner: null,
  })

  const parsed = useMemo(() => (uri ? parseAlterEgoUri(uri) : null), [uri])

  useEffect(() => {
    const loadRecord = async () => {
      if (!uri || !parsed) {
        setRecord(null)
        setDisplayName('')
        setHandle('')
        setDescription('')
        setPronouns('')
        setWebsite('')
        setAvatarPreview(null)
        setBannerPreview(null)
        setNewAvatar(undefined)
        setNewBanner(undefined)
        setError(null)
        setInitialValues({
          displayName: '',
          handle: '',
          description: '',
          pronouns: '',
          website: '',
          avatar: null,
          banner: null,
        })
        return
      }
      setError(null)
      try {
        const res = await agent.com.atproto.repo.getRecord({
          repo: parsed.repo,
          collection: ALTER_EGO_COLLECTION,
          rkey: parsed.rkey,
        })
        const value = res.data.value
        if (!validateAlterEgoRecord(value)) {
          throw new Error(_(msg`Alter ego record failed client validation.`))
        }
        setRecord(value)
        setDisplayName(value.displayName ?? '')
        setHandle(value.handle ?? '')
        setDescription(value.description ?? '')
        setPronouns(value.pronouns ?? '')
        setWebsite(value.website ?? '')
        let resolvedAvatar: string | null = null
        let resolvedBanner: string | null = null
        try {
          resolvedAvatar =
            resolveAlterEgoBlobRefToUrl({
              agent,
              did: parsed.repo,
              blob: value.avatar,
            }) ?? null
        } catch (avatarError) {
          logger.error('Failed to resolve alter ego avatar', {
            error: avatarError,
          })
        }
        try {
          resolvedBanner =
            resolveAlterEgoBlobRefToUrl({
              agent,
              did: parsed.repo,
              blob: value.banner,
            }) ?? null
        } catch (bannerError) {
          logger.error('Failed to resolve alter ego banner', {
            error: bannerError,
          })
        }
        setAvatarPreview(resolvedAvatar)
        setBannerPreview(resolvedBanner)
        setNewAvatar(undefined)
        setNewBanner(undefined)
        setInitialValues({
          displayName: value.displayName ?? '',
          handle: value.handle ?? '',
          description: value.description ?? '',
          pronouns: value.pronouns ?? '',
          website: value.website ?? '',
          avatar: resolvedAvatar,
          banner: resolvedBanner,
        })
      } catch (loadError: any) {
        logger.error('Failed to load alter ego record', {error: loadError})
        setError(loadError?.message ?? _(msg`Failed to load alter ego record.`))
      }
    }

    loadRecord()
  }, [agent, parsed, uri, _])

  const onSelectNewAvatar = async (img: PickerImage | null) => {
    setError(null)
    if (!img) {
      setNewAvatar(null)
      setAvatarPreview(null)
      return
    }
    if (img.size > MAX_IMAGE_SIZE) {
      setError(_(msg`Avatar must be 1MB or less.`))
      return
    }
    try {
      const compressed = await compressIfNeeded(img, MAX_IMAGE_SIZE)
      setNewAvatar(compressed)
      setAvatarPreview(compressed.path)
    } catch (e: any) {
      setError(cleanError(e))
    }
  }

  const onSelectNewBanner = async (img: PickerImage | null) => {
    setError(null)
    if (!img) {
      setNewBanner(null)
      setBannerPreview(null)
      return
    }
    if (img.size > MAX_IMAGE_SIZE) {
      setError(_(msg`Banner must be 1MB or less.`))
      return
    }
    try {
      const compressed = await compressIfNeeded(img, MAX_IMAGE_SIZE)
      setNewBanner(compressed)
      setBannerPreview(compressed.path)
    } catch (e: any) {
      setError(cleanError(e))
    }
  }

  const onSave = async () => {
    if (!uri || !parsed || !record) {
      setError(_(msg`Select a valid alter ego record.`))
      return
    }
    if (!currentAccount || currentAccount.did !== parsed.repo) {
      setError(_(msg`You can only edit your own alter ego records.`))
      return
    }
    const nextDisplayName = displayName.trimEnd()
    const nextHandle = handle.trimEnd()
    const nextDescription = description.trimEnd()
    const nextPronouns = pronouns.trimEnd().toLowerCase()
    const nextWebsiteRaw = website.trimEnd().toLowerCase()
    const nextWebsite = nextWebsiteRaw || undefined

    if (nextHandle.length > MAX_HANDLE_LENGTH) {
      setError(_(msg`Handle must be 64 characters or less.`))
      return
    }
    if (nextDescription.length > MAX_DESCRIPTION_LENGTH) {
      setError(_(msg`Description must be 3000 characters or less.`))
      return
    }
    if (nextDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(_(msg`Display name must be 64 characters or less.`))
      return
    }
    if (
      isOverMaxGraphemeCount({
        text: nextPronouns,
        maxCount: PRONOUNS_MAX_GRAPHEMES,
      })
    ) {
      setError(_(msg`Pronouns are too long.`))
      return
    }
    if (
      isOverMaxGraphemeCount({
        text: nextWebsiteRaw,
        maxCount: WEBSITE_MAX_GRAPHEMES,
      })
    ) {
      setError(_(msg`Website is too long.`))
      return
    }
    if (!isValidWebsiteFormat(nextWebsiteRaw)) {
      setError(_(msg`Website must be a valid URL.`))
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const nextRecord: AlterEgoRecord = {
        ...record,
        displayName: nextDisplayName || undefined,
        handle: nextHandle || undefined,
        description: nextDescription || undefined,
        pronouns: nextPronouns || undefined,
        website: nextWebsite,
      }

      if (newAvatar) {
        const avatarRes = await uploadBlob(
          agent,
          newAvatar.path,
          newAvatar.mime,
        )
        // @ts-expect-error
        nextRecord.avatar = avatarRes.data.blob
      } else if (newAvatar === null) {
        nextRecord.avatar = undefined
      }

      if (newBanner) {
        const bannerRes = await uploadBlob(
          agent,
          newBanner.path,
          newBanner.mime,
        )
        // @ts-expect-error
        nextRecord.banner = bannerRes.data.blob
      } else if (newBanner === null) {
        nextRecord.banner = undefined
      }

      if (!validateAlterEgoRecord(nextRecord)) {
        throw new Error(_(msg`Alter ego record failed client validation.`))
      }

      await agent.com.atproto.repo.putRecord({
        repo: parsed.repo,
        collection: ALTER_EGO_COLLECTION,
        rkey: parsed.rkey,
        record: nextRecord,
      })

      const updatedOverlay = await fetchAlterEgoProfile({agent, uri})
      primeAlterEgoOverlay(updatedOverlay)
      update({
        alterEgoRecords: {
          ...(settings.alterEgoRecords ?? {}),
          [updatedOverlay.uri]: updatedOverlay,
        },
      })

      control.close(() => {
        Toast.show(_(msg`Alter ego saved.`))
        onDismiss?.()
      })
    } catch (saveError: any) {
      logger.error('Failed to save alter ego', {error: saveError})
      setError(saveError?.message ?? _(msg`Failed to save alter ego.`))
    } finally {
      setIsSaving(false)
    }
  }

  const dirty =
    displayName !== initialValues.displayName ||
    handle !== initialValues.handle ||
    description !== initialValues.description ||
    pronouns !== initialValues.pronouns ||
    website !== initialValues.website ||
    avatarPreview !== initialValues.avatar ||
    bannerPreview !== initialValues.banner

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])

  const displayNameTooLong = isOverMaxGraphemeCount({
    text: displayName,
    maxCount: MAX_DISPLAY_NAME_LENGTH,
  })
  const descriptionTooLong = isOverMaxGraphemeCount({
    text: description,
    maxCount: MAX_DESCRIPTION_LENGTH,
  })
  const pronounsTooLong = isOverMaxGraphemeCount({
    text: pronouns,
    maxCount: PRONOUNS_MAX_GRAPHEMES,
  })
  const handleTooLong = handle.length > MAX_HANDLE_LENGTH
  const websiteTooLong = isOverMaxGraphemeCount({
    text: website,
    maxCount: WEBSITE_MAX_GRAPHEMES,
  })
  const websiteInvalidFormat = !isValidWebsiteFormat(website)
  const onClearWebsite = () => {
    setWebsite('')
    if (websiteInputRef.current) {
      websiteInputRef.current.clear()
    }
  }

  return (
    <Dialog.ScrollableInner
      label={_(msg`Edit alter ego`)}
      style={[a.overflow_hidden, web({maxWidth: 520})]}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header
          renderLeft={() => (
            <Button
              label={_(msg`Cancel`)}
              onPress={onPressCancel}
              size="small"
              color="primary"
              variant="ghost"
              style={[a.rounded_full]}>
              <ButtonText style={[a.text_md]}>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          )}
          renderRight={() => (
            <Button
              label={_(msg`Save`)}
              onPress={onSave}
              disabled={
                !dirty ||
                isSaving ||
                displayNameTooLong ||
                descriptionTooLong ||
                pronounsTooLong ||
                handleTooLong ||
                websiteTooLong ||
                websiteInvalidFormat
              }
              size="small"
              color="primary"
              variant="ghost"
              style={[a.rounded_full]}>
              <ButtonText
                style={[a.text_md, !dirty && t.atoms.text_contrast_low]}>
                <Trans>Save</Trans>
              </ButtonText>
              {isSaving && <ButtonIcon icon={Loader} />}
            </Button>
          )}>
          <Dialog.HeaderText>
            <Trans>Edit alter ego</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.relative]}>
        <UserBanner
          banner={bannerPreview}
          onSelectNewBanner={onSelectNewBanner}
        />
        <View
          style={[
            a.absolute,
            {
              top: 80,
              left: 20,
              width: 84,
              height: 84,
              borderWidth: 2,
              borderRadius: 42,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <EditableUserAvatar
            size={80}
            avatar={avatarPreview}
            onSelectNewAvatar={onSelectNewAvatar}
          />
        </View>
      </View>

      {error && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={error} />
        </View>
      )}

      <View style={[a.mt_4xl, a.px_xl, a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Display name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={displayNameTooLong}>
            <Dialog.Input
              defaultValue={displayName}
              onChangeText={setDisplayName}
              label={_(msg`Display name`)}
              placeholder={_(msg`e.g. Kris Dreemurr`)}
            />
          </TextField.Root>
          {displayNameTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DISPLAY_NAME_LENGTH}
                other="Display name is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Handle</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={handleTooLong}>
            <Dialog.Input
              defaultValue={handle}
              onChangeText={setHandle}
              label={_(msg`Handle`)}
              placeholder={_(msg`e.g. kris.darkworld`)}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </TextField.Root>
          {handleTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Trans>Handle must be 64 characters or less.</Trans>
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={descriptionTooLong}>
            <Dialog.Input
              defaultValue={description}
              onChangeText={setDescription}
              multiline
              label={_(msg`Description`)}
              placeholder={_(msg`Tell us a bit about yourself`)}
            />
          </TextField.Root>
          {descriptionTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DESCRIPTION_LENGTH}
                other="Description is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Pronouns</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={pronounsTooLong}>
            <Dialog.Input
              defaultValue={pronouns}
              onChangeText={setPronouns}
              label={_(msg`Pronouns`)}
              placeholder={_(msg`Pronouns`)}
            />
          </TextField.Root>
          {pronounsTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={PRONOUNS_MAX_GRAPHEMES}
                other="Pronouns are too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Website</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative]}>
            <TextField.Root isInvalid={websiteTooLong || websiteInvalidFormat}>
              {website && <TextField.Icon icon={Globe} />}
              <Dialog.Input
                inputRef={websiteInputRef}
                defaultValue={website}
                onChangeText={setWebsite}
                label={_(msg`EditWebsite`)}
                placeholder={_(msg`URL`)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[
                  website
                    ? {
                        paddingRight: tokens.space._5xl,
                      }
                    : {},
                ]}
              />
            </TextField.Root>

            {website && (
              <View
                style={[
                  a.absolute,
                  a.z_10,
                  a.my_auto,
                  a.inset_0,
                  a.justify_center,
                  a.pr_sm,
                  {left: 'auto'},
                ]}>
                <Pressable
                  onPress={onClearWebsite}
                  accessibilityLabel={_(msg`Clear website`)}
                  accessibilityHint={_(msg`Removes the website URL`)}
                  hitSlop={HITSLOP_10}
                  style={[
                    a.flex_row,
                    a.align_center,
                    a.justify_center,
                    {
                      width: tokens.space._2xl,
                      height: tokens.space._2xl,
                    },
                    a.rounded_full,
                  ]}>
                  <CircleX
                    width={tokens.space.lg}
                    style={{color: t.palette.contrast_600}}
                  />
                </Pressable>
              </View>
            )}
          </View>

          {websiteTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={WEBSITE_MAX_GRAPHEMES}
                other="Website is too long. The maximum number of characters is #."
              />
            </Text>
          )}

          {websiteInvalidFormat && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Trans>
                Website must be a valid URL (e.g., https://bsky.app)
              </Trans>
            </Text>
          )}
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}
