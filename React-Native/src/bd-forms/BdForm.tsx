import {
  type AutocompleteConfig,
  type CollectionOptionsLookup,
  concurrentRevealCount,
  createFormController,
  evalCondition,
  type FieldError,
  type FormController,
  type FormCoreField,
  type FormSchema,
  type FormSnapshot,
  type FormSubmitOptions,
  type FormSubmitResult,
  flattenValueFields,
} from '@businessdash/sdk/forms'
import { createBdClient } from '@businessdash/sdk/native'
import {
  type ComponentRef,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native'

import { BdFieldControl } from './controls'
import { BdKeyboardRevealContext, useAndroidKeyboardReveal } from './keyboard'
import { BdButton, BdCheckGlyph, BdText } from './primitives'
import {
  type BdFieldContext,
  type BdFieldRenderers,
  type BdFilePicker,
  type BdFormClient,
  BdFormRuntimeContext,
  type BdPaymentHandler,
} from './runtime'
import {
  BdFormContext,
  type BdFormStrings,
  type BdFormStyle,
  type BdIconRenderer,
  defaultStrings,
  fmt,
  resolveTheme,
  useBdForm,
} from './theme'

/** BD's production host. The apex: `www` redirects, and a redirect to another host drops the Authorization header. */
export const BD_DEFAULT_HOST = 'https://businessdash.us'

type SubmitSuccess = Extract<FormSubmitResult, { ok: true }>
type SubmitFailure = Extract<FormSubmitResult, { ok: false }>

export interface BdFormProps {
  /** The form's slug (Forms → Share in BusinessDash). */
  form?: string
  /** A schema you already have; skips the fetch. */
  schema?: FormSchema
  /** Your SDK client (`createBdClient` from `@businessdash/sdk/native`). */
  client?: BdFormClient
  /** Or a publishable `pk_…` key and site id, and the form builds its own client. */
  publishableKey?: string
  siteId?: string
  /** BD host for the built-in client and icons. */
  host?: string
  /** Provenance / recipient passthrough merged into the submit. */
  submitOptions?: FormSubmitOptions
  /** Validate against the live form server-side, but store nothing. */
  dryRun?: boolean
  style?: BdFormStyle
  strings?: Partial<BdFormStrings>
  /** Replace how any field type renders. */
  renderers?: BdFieldRenderers
  /**
   * Draws Lucide icons (choice cards, option icons, `icon_select`) from
   * `{host}/api/icons/{name}.svg`. The starter's `src/bd/forms.tsx` has one
   * built on `react-native-svg`. Without it, those spots show no icon.
   */
  renderIcon?: BdIconRenderer
  /** Opens a document or photo picker for file and image fields. */
  pickFiles?: BdFilePicker
  /** Collects a card for `credit_card` fields (Stripe). */
  collectPayment?: BdPaymentHandler
  /** Offer autofill (default true). */
  autoComplete?: boolean
  /** Per-field autofill overrides by field id: a token, `true` or `false`. */
  fieldAutoComplete?: Record<string, string | boolean>
  /** The form scrolls itself (default). Pass false inside your own ScrollView. */
  scrollable?: boolean
  /**
   * Called with the leave warning while the visitor has unsent answers and
   * the author turned on "Confirm before leaving", and with null once they
   * don't. Wire it to your navigator (`usePreventRemove`).
   */
  onExitGuardChange?: (
    guard: { title: string; message: string; leave: string; stay: string } | null,
  ) => void
  onSubmitted?: (result: SubmitSuccess) => void
  onSubmitError?: (result: SubmitFailure) => void
  /** Replaces the thank-you screen. `reset` starts a new response. */
  successContent?: (result: SubmitSuccess, reset: () => void) => ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * A BusinessDash form, rendered with native React Native views: validation,
 * conditions, steps, uploads and submit all run through the SDK's form
 * controller, the same one every web binding uses.
 */
export function BdForm(props: BdFormProps) {
  const host = (props.host ?? BD_DEFAULT_HOST).replace(/\/+$/, '')
  const [clientError, setClientError] = useState<string | null>(null)
  const builtClient = useMemo<BdFormClient | undefined>(() => {
    if (props.client || !props.publishableKey) return undefined
    if (!props.siteId) return undefined
    try {
      return createBdClient({
        apiKey: props.publishableKey,
        siteId: props.siteId,
        baseUrl: `${host}/api/package/v1`,
      }) as unknown as BdFormClient
    } catch (e) {
      setClientError(e instanceof Error ? e.message : String(e))
      return undefined
    }
  }, [props.client, props.publishableKey, props.siteId, host])
  const client = props.client ?? builtClient

  const callbacks = useRef(props)
  callbacks.current = props

  const submitKey = JSON.stringify(props.submitOptions ?? {})
  const controller = useMemo(
    () =>
      createFormController({
        ...(client ? { client } : {}),
        ...(props.form ? { slug: props.form } : {}),
        ...(props.schema ? { schema: props.schema } : {}),
        submitOptions: {
          ...props.submitOptions,
          ...(props.dryRun ? { dryRun: true } : {}),
        },
        onSuccess: (r) => callbacks.current.onSubmitted?.(r),
        onError: (r) => callbacks.current.onSubmitError?.(r),
      }),
    // submitOptions is compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, props.form, props.schema, props.dryRun, submitKey],
  )
  useEffect(() => {
    void controller.load()
    return () => controller.destroy()
  }, [controller])

  const snap = useSyncExternalStore(controller.subscribe, controller.snapshot)

  const dark = useColorScheme() === 'dark'
  const theme = useMemo(() => resolveTheme(props.style, dark), [props.style, dark])
  const strings = useMemo(() => ({ ...defaultStrings, ...props.strings }), [props.strings])
  const ctx = useMemo(
    () => ({ theme, strings, renderIcon: props.renderIcon }),
    [theme, strings, props.renderIcon],
  )

  const autoKey = JSON.stringify(props.fieldAutoComplete ?? null)
  const autocomplete = useMemo<AutocompleteConfig>(
    () => ({
      ...(props.autoComplete !== undefined ? { enabled: props.autoComplete } : {}),
      ...(props.fieldAutoComplete ? { overrides: props.fieldAutoComplete } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.autoComplete, autoKey],
  )
  const runtime = useMemo(
    () => ({
      controller,
      slug: props.form,
      client,
      collectionOptions: snap.collectionOptions,
      autocomplete,
      pickFiles: props.pickFiles,
      collectPayment: props.collectPayment,
      host,
    }),
    [
      controller,
      props.form,
      client,
      snap.collectionOptions,
      autocomplete,
      props.pickFiles,
      props.collectPayment,
      host,
    ],
  )

  // "Confirm before leaving": the app's navigator decides what leaving means.
  // Dirty means changed from what the form loaded with: a slider starts at its
  // minimum and a repeater with one empty entry, so "has a value" isn't it.
  const exit = snap.settings?.exitConfirm
  const seed = useRef<{ controller: FormController; values: string } | null>(null)
  if (snap.status === 'ready' && seed.current?.controller !== controller) {
    seed.current = { controller, values: JSON.stringify(snap.values) }
  }
  const dirty =
    seed.current?.controller === controller && JSON.stringify(snap.values) !== seed.current.values
  const guarded = !!exit?.enabled && dirty && !snap.submitted
  const exitMessage = exit?.message || strings.exitMessage
  useEffect(() => {
    callbacks.current.onExitGuardChange?.(
      guarded
        ? {
            title: strings.exitTitle,
            message: exitMessage,
            leave: strings.exitLeave,
            stay: strings.exitStay,
          }
        : null,
    )
  }, [guarded, exitMessage, strings])

  const missingClient =
    !client && !props.schema
      ? (clientError ??
        (props.publishableKey && !props.siteId
          ? 'BdForm: pass `siteId` with `publishableKey`.'
          : 'BdForm: pass `client`, or `publishableKey` and `siteId`.'))
      : null

  return (
    <BdFormContext.Provider value={ctx}>
      <BdFormRuntimeContext.Provider value={runtime}>
        <BdFormBody
          snap={snap}
          controller={controller}
          scrollable={props.scrollable !== false}
          renderers={props.renderers}
          successContent={props.successContent}
          containerStyle={props.containerStyle}
          setupError={missingClient}
        />
      </BdFormRuntimeContext.Provider>
    </BdFormContext.Provider>
  )
}

function BdFormBody({
  snap,
  controller,
  scrollable,
  renderers,
  successContent,
  containerStyle,
  setupError,
}: {
  snap: FormSnapshot
  controller: FormController
  scrollable: boolean
  renderers: BdFieldRenderers | undefined
  successContent: BdFormProps['successContent']
  containerStyle: StyleProp<ViewStyle>
  setupError: string | null
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const contentRef = useRef<HostView>(null)
  const keyboard = useAndroidKeyboardReveal(scrollRef, scrollable)
  const rows = useRef(new Map<string, HostView>())
  const register = useCallback((id: string, view: HostView | null) => {
    if (view) rows.current.set(id, view)
    else rows.current.delete(id)
  }, [])

  const scrollToField = useCallback(
    (id: string | undefined) => {
      if (!scrollable || !id) return
      // After the frame that shows the error (and maybe a new step).
      setTimeout(() => {
        const row = rows.current.get(id)
        const content = contentRef.current
        if (!row || !content) return
        row.measureLayout(
          content,
          (_x: number, y: number) =>
            scrollRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true }),
          () => {},
        )
      }, 120)
    },
    [scrollable],
  )

  const reduceMotion = useReduceMotion()
  const consecutive = snap.settings.isConsecutive && snap.stepCount > 1
  const anim = theme.animated && !reduceMotion ? snap.settings.animation : 'none'
  const progress = useRef(new Animated.Value(1)).current
  const lastStep = useRef(snap.step)
  useEffect(() => {
    if (lastStep.current === snap.step) return
    lastStep.current = snap.step
    if (scrollable) scrollRef.current?.scrollTo({ y: 0, animated: anim !== 'none' })
    if (anim === 'none') return
    progress.setValue(0)
    Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: true }).start()
  }, [snap.step, anim, progress, scrollable])

  const wrap = (children: ReactNode) =>
    scrollable ? (
      <ScrollView
        ref={scrollRef}
        style={[{ flex: 1, backgroundColor: c.background }, containerStyle]}
        contentContainerStyle={{
          padding: theme.contentPadding,
          paddingBottom: theme.contentPadding + 24 + keyboard.inset,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        onScroll={keyboard.onScroll}
        onContentSizeChange={keyboard.onContentSizeChange}
        scrollEventThrottle={16}
      >
        <BdKeyboardRevealContext.Provider value={keyboard.reveal}>
          <View ref={contentRef}>{children}</View>
        </BdKeyboardRevealContext.Provider>
      </ScrollView>
    ) : (
      <View ref={contentRef} style={containerStyle}>
        {children}
      </View>
    )

  if (setupError) {
    return wrap(<BdText variant="error">{setupError}</BdText>)
  }
  if (snap.status === 'idle' || snap.status === 'loading') {
    return wrap(
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator color={c.tint} />
        <BdText variant="caption">{strings.loading}</BdText>
      </View>,
    )
  }
  if (snap.status === 'error') {
    return wrap(
      <View style={styles.center}>
        <BdText variant="headline">{strings.loadFailed}</BdText>
        {snap.loadError ? (
          <BdText variant="caption" style={styles.centerText}>
            {snap.loadError}
          </BdText>
        ) : null}
        <BdButton kind="tonal" title={strings.retry} onPress={() => void controller.load()} />
      </View>,
    )
  }
  if (snap.submitted && snap.result?.ok) {
    const ok = snap.result as SubmitSuccess
    const reset = () => controller.reset()
    return wrap(
      successContent ? (
        successContent(ok, reset)
      ) : (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <View style={[styles.successBadge, { backgroundColor: c.tintSoft }]}>
            <BdCheckGlyph color={c.tint} size={28} />
          </View>
          <BdText variant="title" accessibilityRole="header">
            {strings.successTitle}
          </BdText>
          <BdText variant="caption" style={styles.centerText}>
            {strings.successMessage}
          </BdText>
          <BdButton kind="text" title={strings.submitAnother} onPress={reset} />
        </View>
      ),
    )
  }

  const failure = snap.result && !snap.result.ok ? (snap.result as SubmitFailure) : null
  const showSteps = consecutive && snap.settings.showProgress && theme.showsProgress

  // Android reads new errors through their live regions; iOS has no live
  // regions, so VoiceOver is told directly.
  const announceErrors = (first: { message?: string } | undefined) => {
    if (Platform.OS !== 'ios') return
    AccessibilityInfo.announceForAccessibility(
      [strings.errorNotice, first?.message].filter(Boolean).join(' '),
    )
  }
  const handleNext = () => {
    controller.next()
    const after = controller.snapshot()
    if (after.errorList.length > 0) {
      scrollToField(after.errorList[0]?.id)
      announceErrors(after.errorList[0])
    }
  }
  const handleSubmit = async () => {
    const res = await controller.submit()
    if (res.ok) return
    const after = controller.snapshot()
    announceErrors(after.errorList[0] ?? res.issues?.[0])
    const firstId = res.issues?.[0]?.fieldId ?? after.errorList[0]?.id
    if (!firstId) {
      if (scrollable) scrollRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    if (consecutive) {
      const si = after.steps.findIndex((s) => flattenValueFields(s).some((f) => f.id === firstId))
      if (si >= 0 && si !== after.step) controller.goToStep(si)
    }
    scrollToField(firstId)
  }

  const animatedStyle =
    anim === 'none'
      ? undefined
      : {
          opacity: progress,
          transform:
            anim === 'slide'
              ? [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [snap.forward ? 28 : -28, 0],
                    }),
                  },
                ]
              : anim === 'scale'
                ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }]
                : anim === 'scroll'
                  ? [
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [snap.forward ? 20 : -20, 0],
                        }),
                      },
                    ]
                  : [],
        }

  const coupons = (
    !consecutive || snap.isLastStep
      ? (snap.schema?.actions ?? []).filter(
          (a) => a.type === 'grant_coupon' && (a.coupon?.notice || a.coupon?.code),
        )
      : []
  ).map((a) => {
    const code = a.coupon?.code ?? ''
    return {
      text: a.coupon?.notice
        ? a.coupon.notice.replace(/\{code\}/g, code)
        : fmt(strings.couponApplied, code),
      fine: a.coupon?.finePrint,
    }
  })

  return wrap(
    <View style={{ gap: theme.spacing }}>
      {(theme.showsTitle && snap.title) || (theme.showsDescription && snap.description) ? (
        <View style={styles.head}>
          {theme.showsTitle && snap.title ? (
            <BdText variant="title" accessibilityRole="header">
              {snap.title}
            </BdText>
          ) : null}
          {theme.showsDescription && snap.description ? (
            <BdText variant="caption">{snap.description}</BdText>
          ) : null}
        </View>
      ) : null}

      {showSteps ? <BdProgress snap={snap} onStep={(i) => controller.goToStep(i)} /> : null}

      {snap.errorList.length > 0 ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.notice, { borderColor: c.error, borderRadius: theme.cornerRadius }]}
        >
          <BdText variant="label" color={c.error}>
            {strings.errorNotice}
          </BdText>
          <BdText variant="caption">{snap.errorList.map((e) => e.label).join(', ')}</BdText>
        </View>
      ) : failure?.message ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.notice, { borderColor: c.error, borderRadius: theme.cornerRadius }]}
        >
          <BdText variant="caption" color={c.error}>
            {failure.message}
          </BdText>
        </View>
      ) : null}

      <Animated.View style={animatedStyle}>
        <BdTree
          fields={snap.visibleFields}
          values={snap.values}
          errors={snap.errors}
          setValue={(id, v) => controller.setValue(id, v)}
          renderers={renderers}
          register={register}
          collections={snap.collectionOptions}
        />
      </Animated.View>

      {coupons.map((cp, i) => (
        <View
          key={`coupon-${i}`}
          style={[styles.coupon, { backgroundColor: c.tintSoft, borderRadius: theme.cornerRadius }]}
        >
          <BdText>{cp.text}</BdText>
          {cp.fine ? <BdText variant="caption">{cp.fine}</BdText> : null}
        </View>
      ))}

      <View style={styles.nav}>
        {consecutive && !snap.isFirstStep ? (
          <BdButton
            kind="tonal"
            title={strings.back}
            onPress={() => controller.back()}
            style={styles.navButton}
          />
        ) : null}
        {consecutive && !snap.isLastStep ? (
          <BdButton title={strings.next} onPress={handleNext} style={styles.navButton} />
        ) : (
          <BdButton
            title={
              snap.submitting
                ? strings.sending
                : (snap.schema as { submitLabel?: string } | null)?.submitLabel || strings.submit
            }
            busy={snap.submitting}
            onPress={() => void handleSubmit()}
            style={styles.navButton}
          />
        )}
      </View>
    </View>,
  )
}

function BdProgress({ snap, onStep }: { snap: FormSnapshot; onStep: (i: number) => void }) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  if (snap.settings.progressStyle === 'bar') {
    return (
      <View
        style={styles.gap6}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: snap.stepCount, now: snap.step + 1 }}
      >
        <BdText variant="caption">{fmt(strings.stepOf, snap.step + 1, snap.stepCount)}</BdText>
        <View style={[styles.track, { backgroundColor: c.surface }]}>
          <View
            style={[styles.fill, { width: `${snap.progressPercent}%`, backgroundColor: c.tint }]}
          />
        </View>
      </View>
    )
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.steps}
    >
      {snap.steps.map((s, i) => {
        const f = s[0]
        const title = f?.stepTitle || f?.label || `${i + 1}`
        const done = i < snap.step
        const current = i === snap.step
        return (
          <Fragment key={`step-${i}`}>
            {i > 0 ? (
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: i <= snap.step ? c.tint : c.separator },
                ]}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${fmt(strings.stepOf, i + 1, snap.stepCount)}: ${title}`}
              accessibilityState={{ selected: current }}
              onPress={() => onStep(i)}
              style={styles.step}
            >
              <View
                style={[
                  styles.stepNum,
                  {
                    backgroundColor: done || current ? c.tint : 'transparent',
                    borderColor: done || current ? c.tint : c.border,
                  },
                ]}
              >
                {done ? (
                  <BdCheckGlyph color={c.onTint} size={12} />
                ) : (
                  <BdText variant="caption" color={current ? c.onTint : c.textSecondary}>
                    {i + 1}
                  </BdText>
                )}
              </View>
              <BdText
                variant="caption"
                numberOfLines={1}
                color={current ? c.text : c.textSecondary}
                style={styles.stepTitle}
              >
                {title}
              </BdText>
            </Pressable>
          </Fragment>
        )
      })}
    </ScrollView>
  )
}

const NO_LABEL = new Set([
  'title',
  'subtitle',
  'separator',
  'richtext',
  'body_text',
  'bullet_list',
  'table',
])

type SetValue = (id: string, value: unknown) => void
type HostView = ComponentRef<typeof View>

/** A field's label, with the required marker. */
function BdFieldLabel({ text, required }: { text: string; required?: boolean | undefined }) {
  const { theme } = useBdForm()
  return (
    <BdText variant="label">
      {text}
      {required ? (
        <BdText variant="label" color={theme.colors.error}>
          {theme.requiredMarker}
        </BdText>
      ) : null}
    </BdText>
  )
}

function BdFieldRow({
  field,
  value,
  error,
  setValue,
  renderers,
  register,
}: {
  field: FormCoreField
  value: unknown
  error: FieldError | undefined
  setValue: SetValue
  renderers: BdFieldRenderers | undefined
  register: (id: string, v: HostView | null) => void
}) {
  const set = useCallback((v: unknown) => setValue(field.id, v), [setValue, field.id])
  const ctx: BdFieldContext = { field, value, error, set }
  const custom = renderers?.[field.type]?.(ctx)
  const label = !NO_LABEL.has(field.type) && field.label ? field.label : null
  return (
    <View ref={(v) => register(field.id, v)} style={styles.field}>
      {label ? <BdFieldLabel text={label} required={field.required} /> : null}
      {custom !== undefined ? custom : <BdFieldControl {...ctx} />}
      {error ? (
        <BdText variant="error" accessibilityLiveRegion="polite">
          {error.message}
        </BdText>
      ) : null}
      {field.helpText ? <BdText variant="caption">{field.helpText}</BdText> : null}
    </View>
  )
}

/** A field subtree: groups (with concurrent reveal), conditions, OR branches, rows, repeaters. */
function BdTree({
  fields,
  values,
  errors,
  setValue,
  renderers,
  register,
  collections,
}: {
  fields: FormCoreField[]
  values: Record<string, unknown>
  errors: Record<string, FieldError>
  setValue: SetValue
  renderers: BdFieldRenderers | undefined
  register: (id: string, v: HostView | null) => void
  collections: CollectionOptionsLookup
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const sub = (fs: FormCoreField[], vals = values, set = setValue) => (
    <BdTree
      fields={fs}
      values={vals}
      errors={errors}
      setValue={set}
      renderers={renderers}
      register={register}
      collections={collections}
    />
  )
  return (
    <View style={{ gap: theme.spacing }}>
      {fields.map((f) => {
        const children = (f.children ?? []) as FormCoreField[]
        switch (f.type) {
          case 'multi_populator': {
            const cfg = f.populatorConfig ?? {}
            const max = cfg.maxInstances ?? 10
            const raw = values[f.id]
            const instances: Record<string, unknown>[] =
              Array.isArray(raw) && raw.length > 0 ? (raw as Record<string, unknown>[]) : [{}]
            const write = (next: Record<string, unknown>[]) => setValue(f.id, next)
            return (
              <View key={f.id} ref={(v) => register(f.id, v)} style={styles.gap12}>
                {f.label ? <BdFieldLabel text={f.label} required={f.required} /> : null}
                {instances.map((inst, idx) => {
                  const scoped: SetValue = (childId, v) => {
                    const next = instances.map((x) => ({ ...x }))
                    next[idx] = { ...next[idx], [childId]: v }
                    write(next)
                  }
                  return (
                    <View
                      key={`${f.id}-${idx}`}
                      style={[
                        styles.instance,
                        { borderColor: c.separator, borderRadius: theme.cornerRadius },
                      ]}
                    >
                      <View style={styles.instanceHead}>
                        <BdText variant="label" style={styles.flex}>
                          {cfg.itemLabel || f.label || strings.entry} {idx + 1}
                        </BdText>
                        {instances.length > 1 ? (
                          <BdButton
                            kind="text"
                            title="✕"
                            accessibilityLabel={strings.removeEntry}
                            onPress={() => write(instances.filter((_, i) => i !== idx))}
                          />
                        ) : null}
                      </View>
                      {sub(children, inst, scoped)}
                    </View>
                  )
                })}
                {instances.length < max ? (
                  <BdButton
                    kind="outlined"
                    title={`+ ${cfg.addButtonLabel || strings.addAnother}`}
                    onPress={() => write([...instances, {}])}
                    style={styles.start}
                  />
                ) : null}
              </View>
            )
          }
          case 'input_group': {
            const shown = f.concurrentReveal
              ? children.slice(0, concurrentRevealCount(children, values, collections))
              : children
            return (
              <View key={f.id} style={styles.gap8}>
                {f.label && f.showGroupLabel ? (
                  <BdText variant="headline" accessibilityRole="header">
                    {f.label}
                  </BdText>
                ) : null}
                {sub(shown)}
              </View>
            )
          }
          case 'condition_block':
            return evalCondition(f.conditionRule, values, collections) ? (
              <Fragment key={f.id}>{sub(children)}</Fragment>
            ) : null
          case 'or_condition': {
            const errored = !!errors[f.id]
            const label = (i: number) =>
              (i === 0 && f.orConditionConfig?.leftLabel) ||
              (i === 1 && f.orConditionConfig?.rightLabel) ||
              children[i]?.label ||
              `Option ${String.fromCharCode(65 + i)}`
            return (
              <View key={f.id} ref={(v) => register(f.id, v)} style={styles.gap8}>
                {f.label ? (
                  <View>
                    <BdText variant="label">{f.label}</BdText>
                    <BdText variant="caption">{strings.fillOneSide}</BdText>
                  </View>
                ) : null}
                {children.map((child, i) => (
                  <Fragment key={child.id}>
                    {i > 0 ? (
                      <View style={styles.orRow}>
                        <View style={[styles.orLine, { backgroundColor: c.separator }]} />
                        <BdText variant="caption">{strings.or}</BdText>
                        <View style={[styles.orLine, { backgroundColor: c.separator }]} />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.orSide,
                        {
                          borderColor: errored ? c.error : c.separator,
                          borderRadius: theme.cornerRadius,
                        },
                      ]}
                    >
                      <BdText variant="caption">{label(i)}</BdText>
                      {sub([child])}
                    </View>
                  </Fragment>
                ))}
                {errored ? <BdText variant="error">{strings.fillOneSideError}</BdText> : null}
              </View>
            )
          }
          case 'flex_row': {
            const cfg = (f['flexConfig'] ?? {}) as {
              justify?: string
              align?: string
              gap?: number
            }
            return (
              <View
                key={f.id}
                style={[
                  styles.flexRow,
                  {
                    gap: cfg.gap ?? 12,
                    justifyContent:
                      cfg.justify === 'center'
                        ? 'center'
                        : cfg.justify === 'end'
                          ? 'flex-end'
                          : cfg.justify === 'between'
                            ? 'space-between'
                            : cfg.justify === 'around'
                              ? 'space-around'
                              : 'flex-start',
                    alignItems:
                      cfg.align === 'start'
                        ? 'flex-start'
                        : cfg.align === 'end'
                          ? 'flex-end'
                          : 'center',
                  },
                ]}
              >
                {children.map((child) => (
                  <View key={child.id} style={styles.flexCell}>
                    {sub([child])}
                  </View>
                ))}
              </View>
            )
          }
          default:
            return (
              <BdFieldRow
                key={f.id}
                field={f}
                value={values[f.id]}
                error={errors[f.id]}
                setValue={setValue}
                renderers={renderers}
                register={register}
              />
            )
        }
      })}
    </View>
  )
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v))
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => {
      live = false
      sub.remove()
    }
  }, [])
  return reduce
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  centerText: { textAlign: 'center' },
  head: { gap: 6 },
  notice: { borderWidth: 1, padding: 12, gap: 4 },
  coupon: { padding: 12, gap: 4 },
  nav: { flexDirection: 'row', gap: 12, marginTop: 4 },
  navButton: { flex: 1 },
  field: { gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  steps: { alignItems: 'center', paddingVertical: 2 },
  step: { alignItems: 'center', gap: 4, maxWidth: 96 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { maxWidth: 96 },
  stepLine: { width: 24, height: 2, marginHorizontal: 6, marginBottom: 20 },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instance: { borderWidth: 1, padding: 12, gap: 12 },
  instanceHead: { flexDirection: 'row', alignItems: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orSide: { borderWidth: 1, padding: 12, gap: 8 },
  flexRow: { flexDirection: 'row', flexWrap: 'wrap' },
  flexCell: { flexGrow: 1, flexBasis: 140 },
})
