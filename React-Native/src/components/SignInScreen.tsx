import {
  type BdOAuthProvider,
  type BdSignInField,
  type BdSignInSession,
  type BdSignInStart,
  BdSignInError,
  DEFAULT_SIGN_IN_STRINGS,
  type SignInController,
  createSignInController,
  signInPalette,
} from '@businessdash/sdk/sign-in-core'
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  ActivityIndicator,
  type ColorValue,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInput,
  type TextInputProps,
  View,
  useColorScheme,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { appSignInBackend, continueWithProvider } from '@/bd/auth'
import { BdButton, BdText, BdTextField } from '@/bd-forms'
import { BdFormContext, defaultStrings, resolveTheme } from '@/bd-forms/theme'

/**
 * The business's own sign-in screen — the same screen as `<BdSignIn>` on the
 * web, the Swift `BdSignInView` and the Kotlin `BdSignIn`, drawn with this
 * app's BdForm controls:
 *
 * - its name, logo and brand colours from BD (Settings → Branding): the
 *   primary on the main button, the secondary on links;
 * - each box checked when the person leaves it, and every box when they press
 *   the button — the SDK's checks, the same rules BD runs again;
 * - password sign-in, create account and reset with an emailed code, and
 *   "Continue with Google / Apple / GitHub / Discord" — whichever the business
 *   offers — all through WorkOS, behind BD's `auth/customer/*` routes.
 */
export function SignInScreen({
  start = 'signIn',
  tagline,
  logo,
  onSignedIn,
}: {
  start?: BdSignInStart
  /** A line under the sign-in title. */
  tagline?: string
  /** The app's own logo. Without one, the logo from BD's branding settings. */
  logo?: ImageSourcePropType
  onSignedIn: (session: BdSignInSession) => void | Promise<void>
}) {
  const backend = useMemo(() => appSignInBackend(), [])
  const signedIn = useRef(onSignedIn)
  signedIn.current = onSignedIn

  const [controller, setController] = useState<SignInController | null>(null)
  useEffect(() => {
    if (!backend) return
    const next = createSignInController({
      backend,
      start,
      tagline: tagline ?? null,
      // No address bar here: provider sign-ins come back through the auth
      // session (continueWithProvider), not through the page's URL.
      currentUrl: null,
      onSignedIn: (session) => signedIn.current(session),
    })
    setController(next)
    void next.load()
    return () => next.destroy()
  }, [backend, start, tagline])

  const subscribe = useCallback(
    (listener: () => void) => controller?.subscribe(listener) ?? (() => {}),
    [controller],
  )
  const snap = useSyncExternalStore(subscribe, () => controller?.getSnapshot() ?? null)

  const dark = useColorScheme() === 'dark'
  const palette = signInPalette(snap?.options.primaryColor, snap?.options.secondaryColor)
  const theme = useMemo(
    () =>
      resolveTheme(
        palette ? { colors: { tint: palette.accent, onTint: palette.onAccent } } : undefined,
        dark,
      ),
    [palette?.accent, palette?.onAccent, dark],
  )
  const linkColor: ColorValue = palette ? (dark ? palette.linkDark : palette.link) : theme.colors.tint

  const [oauthBusy, setOauthBusy] = useState<BdOAuthProvider | null>(null)
  const [oauthProblem, setOauthProblem] = useState<string | null>(null)

  const inputs = useRef<Partial<Record<BdSignInField, ComponentRef<typeof TextInput> | null>>>({})
  useEffect(() => {
    if (snap?.focus) inputs.current[snap.focus]?.focus()
  }, [snap?.focusTick])

  if (!backend) {
    return (
      <View style={styles.center}>
        <BdText variant="caption" style={styles.centerText}>
          Sign-in needs EXPO_PUBLIC_BD_PK (a publishable key) — see .env.example.
        </BdText>
      </View>
    )
  }
  if (!controller || !snap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  const c = theme.colors
  const strings = DEFAULT_SIGN_IN_STRINGS
  const busy = snap.busy || oauthBusy !== null
  const creating = snap.step.kind === 'createAccount'
  const problem = oauthProblem ?? snap.problem
  const logoSource = logo ?? (snap.options.logoUrl ? { uri: snap.options.logoUrl } : null)
  const names = snap.fields.filter((f) => f === 'firstName' || f === 'lastName')
  const boxes = snap.fields.filter((f) => f !== 'firstName' && f !== 'lastName')
  const order = [...names, ...boxes]

  async function provider(id: BdOAuthProvider) {
    if (busy || !backend) return
    setOauthBusy(id)
    setOauthProblem(null)
    try {
      const outcome = await continueWithProvider(backend, id)
      if (outcome.status === 'signed-in') await signedIn.current(outcome.session)
    } catch (error) {
      setOauthProblem(
        error instanceof BdSignInError ? error.message : BdSignInError.unavailable().message,
      )
    } finally {
      setOauthBusy(null)
    }
  }

  function submit() {
    setOauthProblem(null)
    void controller?.submit()
  }

  function field(name: BdSignInField) {
    const index = order.indexOf(name)
    const last = index === order.length - 1
    return (
      <View key={name} style={name === 'firstName' || name === 'lastName' ? styles.half : undefined}>
        <BdTextField
          label={label(name)}
          value={snap?.values[name] ?? ''}
          isError={Boolean(snap?.errors[name])}
          editable={!busy}
          inputRef={(node) => {
            inputs.current[name] = node
          }}
          onChangeText={(text) => {
            setOauthProblem(null)
            controller?.setValue(name, text)
          }}
          onBlur={() => controller?.blur(name)}
          returnKeyType={last ? 'go' : 'next'}
          submitBehavior={last ? 'blurAndSubmit' : 'submit'}
          onSubmitEditing={() => {
            const next = order[index + 1]
            if (next) inputs.current[next]?.focus()
            else submit()
          }}
          {...traits(name, creating)}
        />
        {snap?.errors[name] ? (
          <BdText variant="error" style={styles.under}>
            {snap.errors[name]}
          </BdText>
        ) : (name === 'password' || name === 'newPassword') && snap?.hint ? (
          <BdText variant="caption" style={styles.under}>
            {snap.hint}
          </BdText>
        ) : null}
      </View>
    )
  }

  return (
    <BdFormContext.Provider value={{ theme, strings: defaultStrings }}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {logoSource ? (
            <Image source={logoSource} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : null}
          <BdText variant="title" accessibilityRole="header">
            {snap.title}
          </BdText>
          {snap.subtitle ? <BdText variant="caption">{snap.subtitle}</BdText> : null}

          {snap.providers.length > 0 ? (
            <View style={styles.stack}>
              {snap.providers.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy, busy: oauthBusy === p.id }}
                  disabled={busy}
                  onPress={() => void provider(p.id)}
                  style={({ pressed }) => [
                    styles.provider,
                    {
                      borderColor: c.border,
                      borderRadius: theme.variant === 'ios' ? 12 : 22,
                      opacity: busy && oauthBusy !== p.id ? 0.45 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {oauthBusy === p.id ? (
                    <ActivityIndicator size="small" color={c.text} />
                  ) : (
                    <ProviderMark id={p.id} color={c.text} />
                  )}
                  <BdText variant="button">{p.label}</BdText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {snap.providers.length > 0 && snap.fields.length > 0 ? (
            <View style={styles.divider}>
              <View style={[styles.rule, { backgroundColor: c.separator }]} />
              <BdText variant="caption">{strings.or}</BdText>
              <View style={[styles.rule, { backgroundColor: c.separator }]} />
            </View>
          ) : null}

          <View style={styles.stack}>
            {names.length > 0 ? <View style={styles.row}>{names.map(field)}</View> : null}
            {boxes.map(field)}
          </View>

          {problem ? (
            <BdText variant="error" accessibilityLiveRegion="polite" accessibilityRole="alert">
              {problem}
            </BdText>
          ) : null}
          {snap.notice ? (
            <BdText variant="caption" accessibilityLiveRegion="polite">
              {snap.notice}
            </BdText>
          ) : null}

          <BdButton title={snap.primaryLabel} onPress={submit} busy={snap.busy} disabled={busy} />

          <View style={styles.links}>
            {snap.links.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="link"
                disabled={busy}
                hitSlop={8}
                onPress={() => {
                  setOauthProblem(null)
                  controller.follow(l.id)
                }}
              >
                <BdText variant="label" color={linkColor}>
                  {l.label}
                </BdText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BdFormContext.Provider>
  )
}

function label(field: BdSignInField): string {
  const s = DEFAULT_SIGN_IN_STRINGS
  return {
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    password: s.password,
    code: s.code,
    newPassword: s.newPassword,
  }[field]
}

type Traits = Pick<
  TextInputProps,
  | 'autoComplete'
  | 'textContentType'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'keyboardType'
  | 'secureTextEntry'
  | 'maxLength'
>

/** Autofill, keyboard and secure entry for each box. */
function traits(field: BdSignInField, creating: boolean): Traits {
  const plain = { autoCapitalize: 'none', autoCorrect: false } as const
  switch (field) {
    case 'firstName':
      return { autoComplete: 'given-name', textContentType: 'givenName', autoCapitalize: 'words', autoCorrect: false }
    case 'lastName':
      return { autoComplete: 'family-name', textContentType: 'familyName', autoCapitalize: 'words', autoCorrect: false }
    case 'email':
      return { ...plain, autoComplete: 'email', textContentType: 'emailAddress', keyboardType: 'email-address' }
    case 'password':
      return creating
        ? { ...plain, secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' }
        : { ...plain, secureTextEntry: true, autoComplete: 'current-password', textContentType: 'password' }
    case 'newPassword':
      return { ...plain, secureTextEntry: true, autoComplete: 'new-password', textContentType: 'newPassword' }
    case 'code':
      return { autoComplete: 'one-time-code', textContentType: 'oneTimeCode', keyboardType: 'number-pad', maxLength: 6 }
  }
}

/** The providers' own marks (the same as the web screen's). */
function ProviderMark({ id, color }: { id: BdOAuthProvider; color: ColorValue }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {MARKS[id].map((part) => (
        <Path key={part.d.slice(0, 12)} d={part.d} fill={part.fill ?? color} />
      ))}
    </Svg>
  )
}

const MARKS: Record<BdOAuthProvider, Array<{ d: string; fill?: string }>> = {
  apple: [
    {
      d: 'M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z',
    },
  ],
  google: [
    { fill: '#4285F4', d: 'M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z' },
    { fill: '#34A853', d: 'M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z' },
    { fill: '#FBBC05', d: 'M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z' },
    { fill: '#EA4335', d: 'M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z' },
  ],
  github: [
    {
      d: 'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z',
    },
  ],
  discord: [
    {
      fill: '#5865F2',
      d: 'M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z',
    },
  ],
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  content: { padding: 24, paddingTop: 48, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { height: 48, width: 160, marginBottom: 8 },
  stack: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  under: { marginTop: 4 },
  provider: {
    minHeight: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  links: { gap: 12, alignItems: 'center', paddingTop: 4 },
})
