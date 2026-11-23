import {
  baseUnitFor,
  COLLECTION_SELECT_TEXT,
  collectionOptionVisual,
  convertToBase,
  type FormCoreField,
  formatMeasurement,
  isMeasurementCategory,
  isPendingFileValue,
  resolveFieldAutocomplete,
  shouldSearchOptions,
  US_STATES,
  unitsForCategory,
  validateFile,
} from '@businessdash/sdk/forms'
import { useEffect, useMemo, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import {
  addDays,
  formatBytes,
  formatNumber,
  formatPhone,
  formatTime,
  htmlToMarkup,
  markupToHtml,
  parseDay,
  parseNumber,
  record,
  safeHttpUrl,
  sanitizeNumber,
  str,
  stringList,
  timesOfDay,
  today,
  toggled,
  toggleListLine,
  wrapSelection,
} from './logic'
import { BdColorField, BdDateField, BdTimeField, monthNames } from './pickers'
import {
  BdButton,
  BdCheckGlyph,
  BdChip,
  BdChoiceGroup,
  BdChoiceRow,
  BdLoadingRow,
  BdMark,
  type BdOption,
  BdOptionPicker,
  BdRetryRow,
  BdSegmented,
  BdSlider,
  BdText,
  BdTextField,
  BdSwitch,
  inputTraits,
  SIGNED_KEYBOARD,
} from './primitives'
import {
  type BdFieldContext,
  type BdPendingFile,
  type BdPickedFile,
  useBdFormRuntime,
} from './runtime'
import { BdCalculationView, BdIcon, BdStaticContent } from './static'
import { fmt, useBdForm } from './theme'

const STATIC_TYPES = new Set([
  'title',
  'subtitle',
  'separator',
  'richtext',
  'body_text',
  'bullet_list',
  'table',
  'image',
])

/** The built-in control for a field's type. */
export function BdFieldControl(ctx: BdFieldContext) {
  const t = ctx.field.type
  if (STATIC_TYPES.has(t)) return <BdStaticContent field={ctx.field} />
  switch (t) {
    case 'calculation':
      return <BdCalculationView field={ctx.field} value={ctx.value} />
    case 'textarea':
      return <TextAreaControl {...ctx} />
    case 'phone':
      return <PhoneControl {...ctx} />
    case 'url':
      return <UrlControl {...ctx} />
    case 'number':
      return <NumberControl {...ctx} />
    case 'currency':
      return <CurrencyControl {...ctx} />
    case 'measurement':
      return <MeasurementControl {...ctx} />
    case 'name':
      return <NameControl {...ctx} />
    case 'address':
      return <AddressControl {...ctx} />
    case 'tags':
      return <TagsControl {...ctx} />
    case 'rich_text_input':
      return <RichTextControl {...ctx} />
    case 'select':
      return <SelectControl {...ctx} />
    case 'radio':
      return <RadioControl {...ctx} />
    case 'checkbox':
      return <CheckboxControl {...ctx} />
    case 'choice_cards':
      return <ChoiceCardsControl {...ctx} />
    case 'boolean':
      return <BooleanControl {...ctx} />
    case 'icon_select':
      return <IconSelectControl {...ctx} />
    case 'service_selector':
      return <ServiceControl {...ctx} />
    case 'collection_select':
      return <CollectionControl {...ctx} />
    case 'color_picker':
      return (
        <BdColorField value={str(ctx.value)} presets={ctx.field.options ?? []} onChange={ctx.set} />
      )
    case 'slider':
      return <SliderControl {...ctx} />
    case 'star_rating':
      return <StarsControl {...ctx} />
    case 'happiness_rating':
      return <HappinessControl {...ctx} />
    case 'stepper':
      return <StepperControl {...ctx} />
    case 'date':
      return (
        <BdDateField
          value={str(ctx.value)}
          onChange={ctx.set}
          title={ctx.field.label ?? undefined}
          placeholder={ctx.field.placeholder}
          isError={!!ctx.error}
        />
      )
    case 'date_range':
      return <DateRangeControl {...ctx} />
    case 'time_picker':
      return <TimeControl {...ctx} />
    case 'month_year':
      return <MonthYearControl {...ctx} />
    case 'schedule':
      return (ctx.field as { scheduleConfig?: { mode?: string } }).scheduleConfig?.mode ===
        'auto' ? (
        <BookingControl {...ctx} />
      ) : (
        <AvailabilityControl {...ctx} />
      )
    case 'file_upload':
      return <FileControl {...ctx} />
    case 'image_input':
      return <ImageInputControl {...ctx} />
    case 'credit_card':
      return <CardControl {...ctx} />
    default:
      return <TextControl {...ctx} />
  }
}

// ─── Text ────────────────────────────────────────────────────────────────────

function useTraits(field: FormCoreField) {
  const { autocomplete } = useBdFormRuntime()
  return inputTraits(resolveFieldAutocomplete(field, autocomplete))
}

function TextControl({ field, value, error, set }: BdFieldContext) {
  const traits = useTraits(field)
  const email = field.type === 'email'
  return (
    <BdTextField
      value={str(value)}
      onChangeText={set}
      placeholder={field.placeholder || (email ? 'name@example.com' : undefined)}
      isError={!!error}
      returnKeyType="next"
      {...traits}
      {...(email
        ? {
            keyboardType: 'email-address' as const,
            autoCapitalize: 'none' as const,
            autoCorrect: false,
            autoComplete: traits.autoComplete ?? ('email' as const),
          }
        : {})}
    />
  )
}

function TextAreaControl({ field, value, error, set }: BdFieldContext) {
  const rows = Math.max(
    (field as { textareaConfig?: { rows?: number } }).textareaConfig?.rows ?? 4,
    1,
  )
  return (
    <BdTextField
      value={str(value)}
      onChangeText={set}
      placeholder={field.placeholder}
      isError={!!error}
      multiline
      minLines={rows}
    />
  )
}

function PhoneControl({ field, value, error, set }: BdFieldContext) {
  const cfg = field.phoneConfig
  const intl = cfg?.international === true
  const traits = useTraits(field)
  return (
    <BdTextField
      value={str(value)}
      onChangeText={(t) => set(formatPhone(t, intl))}
      placeholder={field.placeholder || (intl ? '+1 555 000 0000' : '(555) 000-0000')}
      keyboardType="phone-pad"
      autoComplete={traits.autoComplete ?? 'tel'}
      textContentType="telephoneNumber"
      leading={cfg?.showFlags ? <BdText>🇺🇸</BdText> : undefined}
      isError={!!error}
    />
  )
}

function UrlControl({ field, value, error, set }: BdFieldContext) {
  return (
    <BdTextField
      value={str(record(value)['url'])}
      onChangeText={(t) => set({ url: t })}
      placeholder={field.placeholder || 'https://example.com'}
      keyboardType="url"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="url"
      textContentType="URL"
      isError={!!error}
    />
  )
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

/**
 * A number typed as text: keeps what the visitor typed ("1.", "-") while the
 * value stays a number, and filters out what the field doesn't allow.
 */
function BdNumericInput({
  value,
  onChange,
  allowDecimal,
  allowNegative,
  placeholder,
  leading,
  isError,
  style,
}: {
  value: number | null
  onChange: (n: number | null) => void
  allowDecimal: boolean
  allowNegative: boolean
  placeholder?: string | undefined
  leading?: React.ReactNode
  isError?: boolean | undefined
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>
}) {
  const [text, setText] = useState(formatNumber(value))
  const [seen, setSeen] = useState(value)
  // A change from outside (reset, a default) replaces the text; the
  // visitor's own keystrokes don't round-trip through it.
  if (value !== seen) {
    setSeen(value)
    if (parseNumber(text) !== value) setText(formatNumber(value))
  }
  return (
    <BdTextField
      style={style}
      value={text}
      onChangeText={(raw) => {
        const clean = sanitizeNumber(raw, allowDecimal, allowNegative)
        setText(clean)
        const n = parseNumber(clean)
        if (n !== value) {
          setSeen(n)
          onChange(n)
        }
      }}
      placeholder={placeholder}
      keyboardType={allowNegative ? SIGNED_KEYBOARD : allowDecimal ? 'decimal-pad' : 'number-pad'}
      leading={leading}
      isError={isError}
    />
  )
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function NumberControl({ field, value, error, set }: BdFieldContext) {
  const allowDecimal = field.allowDecimal !== false
  return (
    <BdNumericInput
      value={num(value)}
      onChange={(n) => set(n == null ? null : allowDecimal ? n : Math.trunc(n))}
      allowDecimal={allowDecimal}
      allowNegative={field.allowNegative !== false}
      placeholder={field.placeholder}
      isError={!!error}
    />
  )
}

function CurrencyControl({ field, value, error, set }: BdFieldContext) {
  const cfg = field.currencyConfig
  const allowDecimal = cfg?.allowDecimal !== false
  const { theme } = useBdForm()
  return (
    <BdNumericInput
      value={num(value)}
      onChange={(n) => set(n == null ? null : allowDecimal ? n : Math.trunc(n))}
      allowDecimal={allowDecimal}
      allowNegative={cfg?.allowNegative === true}
      placeholder={field.placeholder || (allowDecimal ? '0.00' : '0')}
      leading={<BdText color={theme.colors.textSecondary}>{cfg?.symbol || '$'}</BdText>}
      isError={!!error}
    />
  )
}

function MeasurementControl({ field, value, error, set }: BdFieldContext) {
  const { theme } = useBdForm()
  const cfg = field.unitConfig ?? {}
  const category = isMeasurementCategory(cfg.category) ? cfg.category : 'length'
  const units = cfg.units && cfg.units.length > 0 ? cfg.units : unitsForCategory(category)
  const mv = record(value)
  const unit = str(mv['unit']) || cfg.defaultUnit || units[0] || ''
  const n = num(mv['value'])
  const allowDecimal = cfg.allowDecimal !== false
  const emit = (next: number | null, nextUnit: string) => {
    const base = next == null ? null : convertToBase(next, nextUnit, category)
    set({
      value: next ?? '',
      unit: nextUnit,
      ...(base == null ? {} : { base }),
      baseUnit: baseUnitFor(category),
    })
  }
  return (
    <View style={styles.gap6}>
      <View style={styles.row8}>
        <BdNumericInput
          style={styles.flex}
          value={n}
          onChange={(v) => emit(v == null ? null : allowDecimal ? v : Math.trunc(v), unit)}
          allowDecimal={allowDecimal}
          allowNegative={category === 'temperature'}
          placeholder={field.placeholder || '0'}
          isError={!!error}
        />
        {cfg.mode === 'fixed' ? (
          <BdText color={theme.colors.textSecondary}>{unit}</BdText>
        ) : (
          <BdOptionPicker
            style={styles.unitPicker}
            title={field.label || unit}
            placeholder={unit}
            options={units.map((u) => ({ value: u, label: u }))}
            selection={[unit]}
            onSelect={(next) => next[0] && emit(n, next[0])}
            multi={false}
            searchable={false}
          />
        )}
      </View>
      {n != null ? (
        <BdText variant="caption">≈ {formatMeasurement(n, unit, category)}</BdText>
      ) : null}
    </View>
  )
}

// ─── Name & address ──────────────────────────────────────────────────────────

function PartField({
  ctx,
  part,
  label,
  placeholder,
  token,
  filter,
}: {
  ctx: BdFieldContext
  part: string
  label: string
  placeholder?: string
  token?: string
  filter?: (s: string) => string
}) {
  const v = record(ctx.value)[part]
  const text = Array.isArray(v) ? stringList(v).join(', ') : str(v)
  const off = ctx.field.autocomplete === 'off'
  const traits = inputTraits(off ? 'off' : token)
  return (
    <BdTextField
      label={label}
      value={text}
      onChangeText={(t) => ctx.set({ ...record(ctx.value), [part]: filter ? filter(t) : t })}
      placeholder={placeholder}
      isError={!!ctx.error}
      {...traits}
    />
  )
}

function NameControl(ctx: BdFieldContext) {
  const { strings } = useBdForm()
  const cfg = ctx.field.nameConfig
  return (
    <View style={styles.gap10}>
      {cfg?.prefix ? (
        <PartField
          ctx={ctx}
          part="prefix"
          label={strings.namePrefix}
          placeholder="Dr."
          token="honorific-prefix"
        />
      ) : null}
      <PartField
        ctx={ctx}
        part="first"
        label={strings.firstName}
        placeholder="Jane"
        token="given-name"
      />
      {cfg?.middle ? (
        <PartField
          ctx={ctx}
          part="middle"
          label={strings.middleName}
          placeholder="Quinn"
          token="additional-name"
        />
      ) : null}
      <PartField
        ctx={ctx}
        part="last"
        label={strings.lastName}
        placeholder="Doe"
        token="family-name"
      />
      {cfg?.suffix ? (
        <PartField
          ctx={ctx}
          part="suffix"
          label={strings.nameSuffix}
          placeholder="Jr."
          token="honorific-suffix"
        />
      ) : null}
      {cfg?.nicknames ? (
        <PartField
          ctx={ctx}
          part="nicknames"
          label={strings.nicknames}
          placeholder={strings.nicknamesPlaceholder}
          token="nickname"
        />
      ) : null}
    </View>
  )
}

const STATE_OPTIONS: BdOption[] = US_STATES.map((s) => ({ value: s.abbr, label: s.name }))

function AddressControl(ctx: BdFieldContext) {
  const { strings } = useBdForm()
  const v = record(ctx.value)
  return (
    <View style={styles.gap10}>
      <PartField ctx={ctx} part="line1" label={strings.addressLine1} token="address-line1" />
      <PartField ctx={ctx} part="line2" label={strings.addressLine2} token="address-line2" />
      <PartField ctx={ctx} part="city" label={strings.city} token="address-level2" />
      <View style={styles.row8}>
        <View style={styles.flex14}>
          <BdText variant="caption" style={styles.partLabel}>
            {strings.state}
          </BdText>
          <BdOptionPicker
            title={strings.state}
            placeholder={strings.selectState}
            options={STATE_OPTIONS}
            selection={str(v['state']) ? [str(v['state'])] : []}
            onSelect={(next) => ctx.set({ ...v, state: next[0] ?? '' })}
            multi={false}
            isError={!!ctx.error}
          />
        </View>
        <View style={styles.flex}>
          <PartField
            ctx={ctx}
            part="zip"
            label={strings.zip}
            placeholder="90210"
            token="postal-code"
            filter={(s) => s.replace(/[^0-9-]/g, '').slice(0, 10)}
          />
        </View>
      </View>
    </View>
  )
}

// ─── Tags ────────────────────────────────────────────────────────────────────

function TagsControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const [draft, setDraft] = useState('')
  const tags = stringList(value)
  const add = (text: string) => {
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    setDraft('')
    if (parts.length === 0) return
    const next = [...tags]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    set(next)
  }
  return (
    <View style={styles.gap10}>
      <BdTextField
        value={draft}
        onChangeText={(t) => (t.endsWith(',') ? add(t) : setDraft(t))}
        placeholder={field.placeholder || strings.addTag}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={() => add(draft)}
        onBlur={() => draft.trim() && add(draft)}
        isError={!!error}
      />
      {tags.length > 0 ? (
        <View style={styles.wrap}>
          {tags.map((tag) => (
            <BdChip
              key={tag}
              label={`${tag}  ×`}
              selected
              accessibilityLabel={fmt(strings.removeTag, tag)}
              onPress={() => set(tags.filter((t) => t !== tag))}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

// ─── Rich text ───────────────────────────────────────────────────────────────

/**
 * Rich text, stored as the HTML BD keeps (`p strong em s ul ol li`). The
 * editor is light markup the toolbar writes: `**bold**`, `*italic*`,
 * `~~struck~~`, and `• ` / `1. ` lines for lists.
 */
function RichTextControl({ field, value, error, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const html = str(value)
  const [markup, setMarkup] = useState(() => htmlToMarkup(html))
  const [emitted, setEmitted] = useState(html)
  const [sel, setSel] = useState({ start: 0, end: 0 })
  const [forced, setForced] = useState<{ start: number; end: number } | undefined>()
  // A change from outside (reset, a restored draft) replaces the text.
  if (html !== emitted) {
    setEmitted(html)
    if (markupToHtml(markup) !== html) setMarkup(htmlToMarkup(html))
  }
  const update = (text: string) => {
    setMarkup(text)
    const out = markupToHtml(text)
    if (out !== emitted) {
      setEmitted(out)
      set(out)
    }
  }
  const apply = (next: { text: string; start: number; end: number }) => {
    update(next.text)
    setSel({ start: next.start, end: next.end })
    setForced({ start: next.start, end: next.end })
  }
  const minHeight =
    (field as { richTextConfig?: { minHeight?: number } }).richTextConfig?.minHeight ?? 140
  const tool = (label: string, a11y: string, onPress: () => void, extra?: object) => (
    <Pressable
      key={a11y}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.variant === 'ios' ? 8 : 20,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <BdText style={extra}>{label}</BdText>
    </Pressable>
  )
  return (
    <View style={styles.gap8}>
      <View style={styles.row4}>
        {tool('B', strings.bold, () => apply(wrapSelection({ text: markup, ...sel }, '**')), {
          fontWeight: '700',
        })}
        {tool('I', strings.italic, () => apply(wrapSelection({ text: markup, ...sel }, '*')), {
          fontStyle: 'italic',
        })}
        {tool(
          'S',
          strings.strikethrough,
          () => apply(wrapSelection({ text: markup, ...sel }, '~~')),
          {
            textDecorationLine: 'line-through',
          },
        )}
        <View style={[styles.toolDivider, { backgroundColor: theme.colors.separator }]} />
        {tool('•', strings.bulletList, () =>
          apply(toggleListLine({ text: markup, ...sel }, false)),
        )}
        {tool('1.', strings.numberedList, () =>
          apply(toggleListLine({ text: markup, ...sel }, true)),
        )}
      </View>
      <BdTextField
        value={markup}
        onChangeText={update}
        selection={forced}
        onSelectionChange={(e) => {
          setSel(e.nativeEvent.selection)
          if (forced) setForced(undefined)
        }}
        placeholder={field.placeholder}
        multiline
        minLines={Math.max(Math.round((minHeight - 22) / 22), 3)}
        isError={!!error}
      />
    </View>
  )
}

// ─── Choices ─────────────────────────────────────────────────────────────────

function optionIcons(field: FormCoreField): Record<string, string> {
  const raw = (field as { optionIcons?: unknown }).optionIcons
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {}
}

function OptionLabel({ option }: { option: BdOption }) {
  const { theme } = useBdForm()
  const visual = option.image ? collectionOptionVisual(option.image) : null
  const bareIcon = option.image && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(option.image)
  return (
    <View style={styles.optionLabel}>
      {option.icon ? <BdIcon name={option.icon} size={20} color={theme.colors.tint} /> : null}
      {bareIcon ? (
        <BdIcon name={option.image} size={20} color={theme.colors.tint} />
      ) : visual?.kind === 'emoji' ? (
        <BdText>{visual.text}</BdText>
      ) : visual?.kind === 'image' &&
        /^https?:/.test(visual.src) &&
        !/\.svg(\?|$)/i.test(visual.src) ? (
        <Image source={{ uri: visual.src }} style={styles.optionImage} />
      ) : null}
      <BdText style={styles.flex}>{option.label}</BdText>
      {option.detail ? <BdText variant="caption">{option.detail}</BdText> : null}
    </View>
  )
}

function SelectControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const icons = optionIcons(field)
  const options = (field.options ?? []).map((o) => ({ value: o, label: o, icon: icons[o] }))
  const current = str(value)
  return (
    <BdOptionPicker
      title={field.label ?? ''}
      placeholder={field.placeholder || strings.select}
      options={options}
      selection={current ? [current] : []}
      onSelect={(next) => set(next[0] ?? '')}
      multi={false}
      searchable={shouldSearchOptions(options.length, field.display)}
      allowCustom={field.allowCustom === true}
      isError={!!error}
      renderLabel={(o) => <OptionLabel option={o} />}
    />
  )
}

function RadioControl({ field, value, set }: BdFieldContext) {
  const icons = optionIcons(field)
  const opts = field.options ?? []
  return (
    <BdChoiceGroup multi={false}>
      {opts.map((o, i) => (
        <BdChoiceRow
          key={o}
          selected={value === o}
          multi={false}
          last={i === opts.length - 1}
          onPress={() => set(o)}
        >
          <OptionLabel option={{ value: o, label: o, icon: icons[o] }} />
        </BdChoiceRow>
      ))}
    </BdChoiceGroup>
  )
}

function CheckboxControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const icons = optionIcons(field)
  const opts = field.options ?? []
  const selected = stringList(value)
  if (field.display === 'dropdown' || shouldSearchOptions(opts.length, field.display)) {
    return (
      <BdOptionPicker
        title={field.label ?? ''}
        placeholder={field.placeholder || strings.select}
        options={opts.map((o) => ({ value: o, label: o, icon: icons[o] }))}
        selection={selected}
        onSelect={set}
        multi
        allowCustom={field.allowCustom === true}
        isError={!!error}
        renderLabel={(o) => <OptionLabel option={o} />}
      />
    )
  }
  return (
    <BdChoiceGroup multi>
      {opts.map((o, i) => (
        <BdChoiceRow
          key={o}
          selected={selected.includes(o)}
          multi
          last={i === opts.length - 1}
          onPress={() => set(toggled(selected, o))}
        >
          <OptionLabel option={{ value: o, label: o, icon: icons[o] }} />
        </BdChoiceRow>
      ))}
    </BdChoiceGroup>
  )
}

function ChoiceCardsControl({ field, value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const cfg = field.choiceConfig
  const multi = cfg?.mode === 'multi'
  const picked = multi ? stringList(value) : str(value) ? [str(value)] : []
  const toggle = (label: string) =>
    multi ? set(toggled(picked, label)) : set(picked[0] === label ? '' : label)
  return (
    <View style={styles.gap10} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {(cfg?.options ?? []).map((opt) => {
        const on = picked.includes(opt.label)
        const image = safeHttpUrl(opt.imageUrl)
        const href = safeHttpUrl(opt.href)
        return (
          <Pressable
            key={opt.label}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on, selected: on }}
            accessibilityLabel={[opt.label, opt.price, opt.description].filter(Boolean).join(', ')}
            onPress={() => toggle(opt.label)}
            style={({ pressed }) => [
              styles.card,
              {
                borderRadius: theme.cornerRadius,
                borderColor: on ? c.tint : c.separator,
                borderWidth: on ? 2 : 1,
                padding: on ? 11 : 12,
                backgroundColor: on
                  ? c.tintSoft
                  : theme.variant === 'ios'
                    ? c.field
                    : 'transparent',
                opacity: pressed && theme.variant === 'ios' ? 0.7 : 1,
              },
            ]}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={styles.cardImage}
                accessibilityIgnoresInvertColors
              />
            ) : opt.icon ? (
              <View style={styles.cardIcon}>
                <BdIcon name={opt.icon} size={24} color={c.tint} />
              </View>
            ) : null}
            <View style={[styles.flex, styles.gap4]}>
              <View style={styles.row8}>
                <BdText style={[styles.flex, styles.semibold]}>{opt.label}</BdText>
                {opt.price ? <BdText variant="caption">{opt.price}</BdText> : null}
              </View>
              {opt.description ? <BdText variant="caption">{opt.description}</BdText> : null}
              {href ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(href).catch(() => {})}
                  hitSlop={8}
                >
                  <BdText variant="caption" color={c.tint}>
                    {strings.view}
                  </BdText>
                </Pressable>
              ) : null}
            </View>
            <BdMark on={on} multi={multi} />
          </Pressable>
        )
      })}
    </View>
  )
}

function BooleanControl({ field, value, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const on = value === true
  const label = field.placeholder || strings.yesNo
  if (field.display === 'checkbox') {
    return (
      <BdChoiceRow selected={on} multi last onPress={() => set(!on)}>
        <BdText>{label}</BdText>
      </BdChoiceRow>
    )
  }
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={field.label ? `${field.label}, ${label}` : label}
      onPress={() => set(!on)}
      style={styles.switchRow}
    >
      <BdText style={styles.flex}>{label}</BdText>
      <BdSwitch value={on} onValueChange={set} />
    </Pressable>
  )
}

function IconSelectControl({ field, value, set }: BdFieldContext) {
  const { theme, strings, renderIcon } = useBdForm()
  const { host } = useBdFormRuntime()
  const c = theme.colors
  const curated = field.iconConfig?.allowedIcons ?? []
  const [all, setAll] = useState<string[]>([])
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (curated.length > 0) return
    let live = true
    fetch(`${host}/api/icons`)
      .then((r) => (r.ok ? r.json() : { icons: [] }))
      .then((d: { icons?: string[] }) => live && setAll(d.icons ?? []))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [curated.length, host])
  const q = query.trim().toLowerCase()
  const names = (curated.length > 0 ? curated : all)
    .filter((n) => !q || n.includes(q))
    .slice(0, 120)
  const columns = Math.max(field.iconConfig?.columns ?? 6, 2)
  const current = str(value)
  const rows: string[][] = []
  for (let i = 0; i < names.length; i += columns) rows.push(names.slice(i, i + columns))
  return (
    <View style={styles.gap10}>
      {curated.length === 0 ? (
        <BdTextField
          value={query}
          onChangeText={setQuery}
          placeholder={strings.searchIcons}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}
      {rows.map((row, ri) => (
        <View key={`ir-${ri}`} style={styles.row8}>
          {row.map((name) => {
            const on = name === current
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={name.replace(/-/g, ' ')}
                accessibilityState={{ selected: on, checked: on }}
                onPress={() => set(on ? '' : name)}
                style={[
                  styles.iconCell,
                  {
                    borderRadius: theme.cornerRadius * 0.75,
                    backgroundColor: on ? c.tint : c.surface,
                  },
                ]}
              >
                {renderIcon ? (
                  <BdIcon name={name} size={22} color={on ? c.onTint : c.text} />
                ) : (
                  <BdText variant="caption" numberOfLines={1} color={on ? c.onTint : c.text}>
                    {name}
                  </BdText>
                )}
              </Pressable>
            )
          })}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad-${i}`} style={styles.flex} />
          ))}
        </View>
      ))}
      {current ? (
        <View style={styles.row8}>
          <BdText variant="caption" style={styles.flex}>
            {current}
          </BdText>
          <BdButton kind="text" title={strings.clear} onPress={() => set('')} />
        </View>
      ) : null}
    </View>
  )
}

type ServiceOption = { id: string; title: string; estimatedHours?: number }

function ServiceControl({ field, value, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const cfg = (field as { serviceConfig?: { options?: ServiceOption[]; multi?: boolean } })
    .serviceConfig
  const multi = cfg?.multi !== false
  const picked = stringList(value)
  const opts = cfg?.options ?? []
  return (
    <BdChoiceGroup multi={multi}>
      {opts.map((o, i) => {
        const h = o.estimatedHours
        return (
          <BdChoiceRow
            key={o.id}
            selected={picked.includes(o.id)}
            multi={multi}
            last={i === opts.length - 1}
            onPress={() =>
              set(
                multi
                  ? toggled(picked, o.id)
                  : picked.length === 1 && picked[0] === o.id
                    ? []
                    : [o.id],
              )
            }
          >
            <OptionLabel
              option={{
                value: o.id,
                label: o.title,
                detail: h && h > 0 ? `${h} ${h === 1 ? strings.hour : strings.hours}` : undefined,
              }}
            />
          </BdChoiceRow>
        )
      })}
    </BdChoiceGroup>
  )
}

function CollectionControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const { controller, collectionOptions } = useBdFormRuntime()
  const state = collectionOptions[field.id]
  const multi = field.collectionSelectConfig?.multi === true
  useEffect(() => {
    void controller.loadCollectionOptions(field.id)
  }, [controller, field.id])

  if (!state || state.status === 'idle' || state.status === 'loading') {
    return <BdLoadingRow text={strings.loadingOptions} />
  }
  if (state.status === 'error' || state.status === 'unavailable') {
    return (
      <BdRetryRow
        message={state.error ?? COLLECTION_SELECT_TEXT.error}
        onRetry={() => void controller.reloadCollectionOptions(field.id)}
      />
    )
  }
  if (state.status === 'empty' || state.options.length === 0) {
    return <BdText variant="caption">{strings.noRecords}</BdText>
  }
  const options: BdOption[] = state.options.map((o) => ({
    value: o.value,
    label: o.label,
    image: o.image,
  }))
  const selection = multi ? stringList(value) : str(value) ? [str(value)] : []
  const write = (next: string[]) => set(multi ? next : (next[0] ?? ''))
  if (options.length > 10 || field.display === 'combobox') {
    return (
      <BdOptionPicker
        title={field.label ?? ''}
        placeholder={field.placeholder || strings.select}
        options={options}
        selection={selection}
        onSelect={write}
        multi={multi}
        searchable
        isError={!!error}
        renderLabel={(o) => <OptionLabel option={o} />}
      />
    )
  }
  return (
    <BdChoiceGroup multi={multi}>
      {options.map((o, i) => (
        <BdChoiceRow
          key={o.value}
          selected={selection.includes(o.value)}
          multi={multi}
          last={i === options.length - 1}
          onPress={() =>
            write(
              multi
                ? toggled(selection, o.value)
                : selection.length === 1 && selection[0] === o.value
                  ? []
                  : [o.value],
            )
          }
        >
          <OptionLabel option={o} />
        </BdChoiceRow>
      ))}
    </BdChoiceGroup>
  )
}

// ─── Slider, ratings, stepper ────────────────────────────────────────────────

function SliderControl({ field, value, set }: BdFieldContext) {
  const cfg = field.sliderConfig
  const lo = cfg?.min ?? 0
  const hi = Math.max(cfg?.max ?? 100, lo + 1)
  const step = Math.max(cfg?.step ?? 1, Number.EPSILON)
  const v = num(value) ?? lo
  const unit = (cfg as { unit?: string } | undefined)?.unit
  const show = (n: number) =>
    unit === 'currency' ? `$${n}` : unit === 'percent' ? `${n}%` : String(n)
  return (
    <View style={styles.gap4}>
      <View style={styles.row8}>
        <BdText variant="caption">{show(lo)}</BdText>
        <BdText variant="headline" style={[styles.flex, styles.center, styles.tnum]}>
          {show(v)}
        </BdText>
        <BdText variant="caption">{show(hi)}</BdText>
      </View>
      <BdSlider
        value={v}
        min={lo}
        max={hi}
        step={step}
        onChange={set}
        accessibilityLabel={field.label ?? ''}
        valueText={show(v)}
      />
    </View>
  )
}

function StarsControl({ field, value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const max = Math.max(field.starRatingConfig?.maxStars ?? 5, 1)
  const v = Math.trunc(num(value) ?? 0)
  return (
    <View style={styles.row4} accessibilityRole="radiogroup">
      {Array.from({ length: max }, (_, k) => {
        const i = k + 1
        return (
          <Pressable
            key={`star-${i}`}
            accessibilityRole="radio"
            accessibilityLabel={fmt(strings.ratingOf, i, max)}
            accessibilityState={{ selected: i === v, checked: i === v }}
            onPress={() => set(i)}
            hitSlop={4}
            style={styles.star}
          >
            <BdText
              style={styles.starGlyph}
              color={i <= v ? theme.colors.star : theme.colors.separator}
            >
              ★
            </BdText>
          </Pressable>
        )
      })}
    </View>
  )
}

const FACES = ['😞', '😕', '😐', '🙂', '😄']

function HappinessControl({ value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  // 0 is a real answer (😞), so "unanswered" is null, not 0.
  const v = typeof value === 'number' ? value : -1
  return (
    <View style={styles.faces} accessibilityRole="radiogroup">
      {FACES.map((face, i) => {
        const on = i === v
        return (
          <Pressable
            key={face}
            accessibilityRole="radio"
            accessibilityLabel={strings.happinessNames[i] ?? face}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => set(i)}
            style={[styles.face, on && { backgroundColor: theme.colors.tintSoft }]}
          >
            <BdText
              style={[
                styles.faceGlyph,
                { opacity: v < 0 || on ? 1 : 0.45, transform: [{ scale: on ? 1.15 : 1 }] },
              ]}
            >
              {face}
            </BdText>
          </Pressable>
        )
      })}
    </View>
  )
}

function StepperControl({ field, value, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const v = num(value) ?? 0
  const lo = field.validation?.min ?? -1_000_000
  const hi = Math.max(field.validation?.max ?? 1_000_000, lo)
  const write = (n: number) => set(Math.min(Math.max(n, lo), hi))
  return (
    <View style={styles.stepper}>
      <BdButton
        kind="outlined"
        title="−"
        accessibilityLabel={strings.decrease}
        disabled={v - 1 < lo}
        onPress={() => write(v - 1)}
        style={styles.stepperButton}
      />
      <BdText
        variant="title"
        style={styles.tnum}
        accessibilityLabel={`${field.label ?? ''}, ${v}`}
        accessibilityLiveRegion="polite"
      >
        {v}
      </BdText>
      <BdButton
        kind="outlined"
        title="+"
        accessibilityLabel={strings.increase}
        disabled={v + 1 > hi}
        onPress={() => write(v + 1)}
        style={styles.stepperButton}
      />
    </View>
  )
}

// ─── Dates & times ───────────────────────────────────────────────────────────

function DateRangeControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const v = record(value)
  const start = parseDay(str(v['start']))
  const sameDayOk =
    (field as { dateRangeConfig?: { allowSameDay?: boolean } }).dateRangeConfig?.allowSameDay !==
    false
  const minEnd = start ? (sameDayOk ? start : addDays(start, 1)) : null
  return (
    <View style={styles.gap10}>
      <BdDateField
        label={strings.start}
        value={str(v['start'])}
        onChange={(d) => set({ ...v, start: d })}
        isError={!!error}
      />
      <BdDateField
        label={strings.end}
        value={str(v['end'])}
        min={minEnd}
        onChange={(d) => set({ ...v, end: d })}
        isError={!!error}
      />
    </View>
  )
}

function TimeControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const cfg = field.timeConfig
  const twelve = (cfg?.format ?? '12h') !== '24h'
  const mode = cfg?.mode ?? 'simple'
  const v = record(value)
  const step = Math.max(cfg?.stepMinutes ?? 15, 1)
  if (mode === 'time_block') {
    return (
      <View style={styles.gap10}>
        <BdTimeField
          label={strings.start}
          value={str(v['start'])}
          onChange={(t) => set({ ...v, start: t })}
          step={step}
          twelveHour={twelve}
          isError={!!error}
        />
        <BdTimeField
          label={strings.end}
          value={str(v['end'])}
          onChange={(t) => set({ ...v, end: t })}
          step={step}
          twelveHour={twelve}
          isError={!!error}
        />
      </View>
    )
  }
  if (mode === 'appointment') {
    return (
      <View style={styles.gap10}>
        <BdDateField
          label={strings.date}
          value={str(v['date'])}
          min={today()}
          onChange={(d) => set({ ...v, date: d })}
          isError={!!error}
        />
        <BdTimeField
          label={strings.time}
          value={str(v['time'])}
          onChange={(t) => set({ ...v, time: t })}
          step={step}
          twelveHour={twelve}
          isError={!!error}
        />
      </View>
    )
  }
  const options = timesOfDay(Math.max(cfg?.stepMinutes ?? 30, 1)).map((t) => ({
    value: t,
    label: formatTime(t, twelve),
  }))
  const current = str(value)
  return (
    <BdOptionPicker
      title={field.label ?? strings.time}
      placeholder={field.placeholder || strings.selectTime}
      options={options}
      selection={current ? [current] : []}
      onSelect={(next) => set(next[0] ?? '')}
      multi={false}
      searchable={false}
      isError={!!error}
      startAt="09:00"
    />
  )
}

function MonthYearControl({ field, value, error, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const raw = str(value)
  const m = /^(\d{4})-(\d{2})$/.exec(raw)
  const [month, setMonth] = useState<number | null>(m ? Number(m[2]) : null)
  const [year, setYear] = useState<number | null>(m ? Number(m[1]) : null)
  const [seen, setSeen] = useState(raw)
  if (raw !== seen) {
    setSeen(raw)
    if (m) {
      setMonth(Number(m[2]))
      setYear(Number(m[1]))
    } else if (raw === '') {
      setMonth(null)
      setYear(null)
    }
  }
  const cfg = (field as { monthYearConfig?: { minYear?: number; maxYear?: number } })
    .monthYearConfig
  const thisYear = new Date().getFullYear()
  const minYear = cfg?.minYear ?? thisYear - 100
  const maxYear = Math.max(cfg?.maxYear ?? thisYear + 10, minYear)
  const names = useMemo(monthNames, [])
  const emit = (mo: number | null, y: number | null) => {
    setMonth(mo)
    setYear(y)
    const out =
      mo != null && y != null ? `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}` : ''
    setSeen(out)
    set(out)
  }
  const years: BdOption[] = []
  for (let y = maxYear; y >= minYear; y--) years.push({ value: String(y), label: String(y) })
  return (
    <View style={styles.row8}>
      <BdOptionPicker
        style={styles.flex13}
        title={strings.month}
        placeholder={strings.month}
        options={names.map((n, i) => ({ value: String(i + 1), label: n }))}
        selection={month != null ? [String(month)] : []}
        onSelect={(next) => emit(next[0] ? Number(next[0]) : null, year)}
        multi={false}
        searchable={false}
        isError={!!error}
      />
      <BdOptionPicker
        style={styles.flex}
        title={strings.year}
        placeholder={strings.year}
        options={years}
        selection={year != null ? [String(year)] : []}
        onSelect={(next) => emit(month, next[0] ? Number(next[0]) : null)}
        multi={false}
        searchable={false}
        isError={!!error}
        startAt={String(thisYear)}
      />
    </View>
  )
}

// ─── Schedule ────────────────────────────────────────────────────────────────

type ScheduleConfig = {
  allowAsap?: boolean
  days?: string[]
  timeWindows?: string[]
  granularTimes?: boolean
  allowNotes?: boolean
}

function AvailabilityControl({ field, value, set }: BdFieldContext) {
  const { strings } = useBdForm()
  const cfg = (field as { scheduleConfig?: ScheduleConfig }).scheduleConfig
  const v = record(value)
  const days = cfg?.days?.length ? cfg.days : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const windows = cfg?.timeWindows?.length
    ? cfg.timeWindows
    : cfg?.granularTimes
      ? [
          'morning_8_10',
          'morning_10_12',
          'afternoon_12_2',
          'afternoon_2_4',
          'evening_4_6',
          'evening_6_8',
        ]
      : ['morning', 'afternoon', 'evening']
  const toggle = (key: 'days' | 'times', item: string) =>
    set({ ...v, [key]: toggled(stringList(v[key]), item) })
  const asap = v['asap'] === true
  return (
    <View style={styles.gap14}>
      {cfg?.allowAsap !== false ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: asap }}
          accessibilityLabel={strings.asap}
          onPress={() => set({ ...v, asap: !asap })}
          style={styles.switchRow}
        >
          <BdText style={styles.flex}>{strings.asap}</BdText>
          <BdSwitch value={asap} onValueChange={(on) => set({ ...v, asap: on })} />
        </Pressable>
      ) : null}
      <ChipGroup
        title={strings.preferredDays}
        items={days}
        picked={stringList(v['days'])}
        name={(d) => strings.dayNames[d] ?? d}
        onToggle={(d) => toggle('days', d)}
      />
      <ChipGroup
        title={strings.preferredTimes}
        items={windows}
        picked={stringList(v['times'])}
        name={(w) => strings.timeWindowNames[w] ?? w}
        onToggle={(w) => toggle('times', w)}
      />
      {cfg?.allowNotes !== false ? (
        <BdTextField
          value={str(v['notes'])}
          onChangeText={(t) => set({ ...v, notes: t })}
          placeholder={strings.schedulingNotes}
          multiline
          minLines={2}
        />
      ) : null}
    </View>
  )
}

function ChipGroup({
  title,
  items,
  picked,
  name,
  onToggle,
}: {
  title: string
  items: string[]
  picked: string[]
  name: (item: string) => string
  onToggle: (item: string) => void
}) {
  return (
    <View style={styles.gap6}>
      <BdText variant="caption">{title}</BdText>
      <View style={styles.wrap}>
        {items.map((item) => (
          <BdChip
            key={item}
            label={name(item)}
            selected={picked.includes(item)}
            onPress={() => onToggle(item)}
          />
        ))}
      </View>
    </View>
  )
}

type SlotState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; slots: string[] }

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Live booking: open slots from BD, grouped by day. */
function BookingControl({ field, value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const { client, slug } = useBdFormRuntime()
  const c = theme.colors
  const [state, setState] = useState<SlotState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [day, setDay] = useState<string | null>(null)
  const fetchSlots = client?.forms.scheduleSlots
  useEffect(() => {
    if (!fetchSlots || !slug) {
      setState({ status: 'error' })
      return
    }
    let live = true
    setState({ status: 'loading' })
    const from = new Date()
    const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000)
    fetchSlots(slug, { fieldId: field.id, from, to })
      .then((r) => live && setState({ status: 'ready', slots: r.slots.map((s) => s.startAt) }))
      .catch(() => live && setState({ status: 'error' }))
    return () => {
      live = false
    }
  }, [fetchSlots, slug, field.id, attempt])

  if (state.status === 'loading') return <BdLoadingRow text={strings.loadingTimes} />
  if (state.status === 'error')
    return (
      <BdRetryRow message={strings.timesUnavailable} onRetry={() => setAttempt((n) => n + 1)} />
    )

  const slots = state.slots
    .map((raw) => ({ raw, at: new Date(raw) }))
    .filter((s) => !Number.isNaN(s.at.getTime()))
  if (slots.length === 0) return <BdText variant="caption">{strings.noOpenTimes}</BdText>
  const byDay = new Map<string, Array<{ raw: string; at: Date }>>()
  for (const s of slots) {
    const k = localDayKey(s.at)
    byDay.set(k, [...(byDay.get(k) ?? []), s])
  }
  const days = [...byDay.keys()].sort()
  const selected = str(record(value)['slotStartAt'])
  const selectedDay = slots.find((s) => s.raw === selected)
  const current = day ?? (selectedDay ? localDayKey(selectedDay.at) : days[0]) ?? days[0]
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
  return (
    <View style={styles.gap10}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row8}
      >
        {days.map((k) => {
          const d = byDay.get(k)?.[0]?.at as Date
          const on = k === current
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              onPress={() => setDay(k)}
              style={[
                styles.dayCard,
                { borderRadius: theme.cornerRadius, backgroundColor: on ? c.tint : c.surface },
              ]}
            >
              <BdText variant="caption" color={on ? c.onTint : c.textSecondary}>
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </BdText>
              <BdText variant="headline" color={on ? c.onTint : c.text}>
                {d.getDate()}
              </BdText>
              <BdText variant="caption" color={on ? c.onTint : c.textSecondary}>
                {d.toLocaleDateString(undefined, { month: 'short' })}
              </BdText>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={styles.wrap}>
        {(byDay.get(current as string) ?? []).map((s) => (
          <BdChip
            key={s.raw}
            label={s.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            selected={s.raw === selected}
            onPress={() => set({ slotStartAt: s.raw, timezone: zone })}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Files & images ──────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  zip: 'application/zip',
}

function mimeFor(p: BdPickedFile): string {
  if (p.mimeType) return p.mimeType
  const ext = p.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/** Read a picked file into a Blob that uploads on submit. */
async function toPending(p: BdPickedFile): Promise<BdPendingFile> {
  const res = await fetch(p.uri)
  let blob = await res.blob()
  const type = mimeFor(p)
  // The upload's Content-Type comes from the blob; make sure it's the real one.
  if (blob.type !== type) blob = new Blob([blob], { type })
  return {
    pending: true,
    file: blob,
    name: p.name,
    size: p.size ?? blob.size,
    uri: p.uri,
    mimeType: type,
  }
}

function acceptsImages(allowed: string[]): boolean {
  return (
    allowed.length === 0 ||
    allowed.some((a) => {
      const t = a.trim().toLowerCase()
      return (
        t === '*/*' ||
        t.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(t)
      )
    })
  )
}

function FileControl({ field, value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const { pickFiles } = useBdFormRuntime()
  const [problem, setProblem] = useState<string | null>(null)
  const cfg = field.fileConfig
  const allowed = cfg?.allowedTypes ?? []
  const files = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
  const maxFiles = Math.max(cfg?.maxFiles ?? 1, 1)
  const remaining = Math.max(maxFiles - files.length, 0)

  const pick = async (kind: 'files' | 'images') => {
    if (!pickFiles) return
    setProblem(null)
    try {
      const picked = (
        await pickFiles({ kind, multiple: remaining > 1, allowedTypes: allowed })
      ).slice(0, remaining)
      const additions: BdPendingFile[] = []
      for (const p of picked) {
        const issue = validateFile(
          { name: p.name, type: mimeFor(p), size: p.size },
          { allowedTypes: allowed, maxSize: cfg?.maxSize },
        )
        if (issue) {
          setProblem(issue)
          continue
        }
        additions.push(await toPending(p))
      }
      if (additions.length > 0) set([...files, ...additions])
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <View style={styles.gap8}>
      {files.map((f, i) => {
        const pending = isPendingFileValue(f)
        const name = str(f['name']) || 'File'
        const size = formatBytes(typeof f['size'] === 'number' ? (f['size'] as number) : undefined)
        const uri = pending ? (f as unknown as BdPendingFile).uri : safeHttpUrl(str(f['url']))
        const isImage = (
          str((f as unknown as BdPendingFile).mimeType) || str(f['mimeType'])
        ).startsWith('image/')
        return (
          <View
            key={`${name}-${i}`}
            style={[
              styles.fileRow,
              { backgroundColor: theme.colors.surface, borderRadius: theme.cornerRadius },
            ]}
          >
            {isImage && uri ? (
              <Image source={{ uri }} style={styles.fileThumb} accessibilityIgnoresInvertColors />
            ) : (
              <View
                style={[styles.fileThumb, styles.fileGlyph, { borderColor: theme.colors.border }]}
              >
                <BdText variant="caption">
                  {name.split('.').pop()?.slice(0, 4).toUpperCase()}
                </BdText>
              </View>
            )}
            <View style={styles.flex}>
              <BdText numberOfLines={1}>{name}</BdText>
              <BdText variant="caption">
                {[size, pending ? strings.uploadsOnSubmit : null].filter(Boolean).join(' · ')}
              </BdText>
            </View>
            <BdButton
              kind="text"
              title="✕"
              accessibilityLabel={`${strings.removeFile} ${name}`}
              onPress={() => set(files.filter((_, k) => k !== i))}
            />
          </View>
        )
      })}
      {remaining > 0 ? (
        pickFiles ? (
          <View style={styles.wrap}>
            <BdButton
              kind="outlined"
              title={strings.chooseFiles}
              onPress={() => void pick('files')}
            />
            {acceptsImages(allowed) ? (
              <BdButton
                kind="outlined"
                title={strings.choosePhotos}
                onPress={() => void pick('images')}
              />
            ) : null}
          </View>
        ) : (
          <BdText variant="caption">{strings.filePickingUnavailable}</BdText>
        )
      ) : null}
      {problem ? <BdText variant="error">{problem}</BdText> : null}
    </View>
  )
}

function ImageInputControl({ field, value, error, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const { pickFiles } = useBdFormRuntime()
  const cfg = field.imageInputConfig
  const sources = cfg?.sources ?? 'both'
  const [chosen, setChosen] = useState<'upload' | 'url'>('upload')
  const [problem, setProblem] = useState<string | null>(null)
  const mode = sources === 'url' ? 'url' : sources === 'upload' ? 'upload' : chosen
  const pending = isPendingFileValue(value) ? (value as BdPendingFile) : null
  const url = typeof value === 'string' ? safeHttpUrl(value) : null
  const preview = pending?.uri ?? url

  const pick = async () => {
    if (!pickFiles) return
    setProblem(null)
    try {
      const [p] = await pickFiles({
        kind: 'images',
        multiple: false,
        allowedTypes: cfg?.allowedTypes ?? ['image/*'],
      })
      if (!p) return
      const issue = validateFile(
        { name: p.name, type: mimeFor(p), size: p.size },
        { allowedTypes: cfg?.allowedTypes ?? ['image/*'], maxSize: cfg?.maxSize ?? 5 },
      )
      if (issue) {
        setProblem(issue)
        return
      }
      set(await toPending(p))
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <View style={styles.gap10}>
      {sources === 'both' ? (
        <BdSegmented
          options={[
            { value: 'upload', label: strings.upload },
            { value: 'url', label: strings.pasteURL },
          ]}
          value={mode}
          onChange={(m) => setChosen(m as 'upload' | 'url')}
        />
      ) : null}
      {mode === 'upload' ? (
        pickFiles ? (
          <BdButton
            kind="outlined"
            title={strings.choosePhotos}
            onPress={() => void pick()}
            style={styles.start}
          />
        ) : (
          <BdText variant="caption">{strings.filePickingUnavailable}</BdText>
        )
      ) : (
        <BdTextField
          value={pending ? '' : str(value)}
          onChangeText={set}
          placeholder={field.placeholder || 'https://example.com/image.png'}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          isError={!!error}
        />
      )}
      {cfg?.showPreview !== false && preview ? (
        <View
          style={[
            styles.preview,
            { borderRadius: theme.cornerRadius, backgroundColor: theme.colors.surface },
          ]}
        >
          <Image
            source={{ uri: preview }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.clear}
            onPress={() => set('')}
            style={styles.previewClear}
          >
            <BdText color="#FFFFFF">✕</BdText>
          </Pressable>
        </View>
      ) : null}
      {pending ? (
        <BdText variant="caption">
          {pending.name} — {strings.uploadsOnSubmit.toLowerCase()}.
        </BdText>
      ) : null}
      {problem ? <BdText variant="error">{problem}</BdText> : null}
    </View>
  )
}

type PaymentConfig = {
  mode?: 'card_on_file' | 'deposit'
  amountCents?: number
  currency?: string
  buttonLabel?: string
  description?: string
}

function CardControl({ field, value, set }: BdFieldContext) {
  const { theme, strings } = useBdForm()
  const { client, slug, collectPayment } = useBdFormRuntime()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const pc = (field as { paymentConfig?: PaymentConfig }).paymentConfig
  const deposit = pc?.mode === 'deposit'
  const amount =
    deposit && pc?.amountCents
      ? `${(pc.amountCents / 100).toFixed(2)} ${(pc.currency ?? 'usd').toUpperCase()}`
      : null
  const saved = str(value).length > 0

  const collect = async () => {
    const mint = client?.forms.paymentIntent
    if (!mint || !slug || !collectPayment) {
      setProblem(strings.cardUnavailable)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const intent = await mint(slug, field.id)
      set(await collectPayment(intent, field))
    } catch (e) {
      setProblem(e instanceof Error && e.message ? e.message : strings.cardFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.gap10}>
      <View style={styles.row8}>
        <BdText style={[styles.flex, styles.semibold]}>
          {deposit ? `${strings.deposit}${amount ? ` · ${amount}` : ''}` : strings.cardOnFile}
        </BdText>
        {saved ? (
          <View style={styles.row4}>
            <BdCheckGlyph color={theme.colors.success} size={16} />
            <BdText variant="caption" color={theme.colors.success}>
              {strings.cardSaved}
            </BdText>
          </View>
        ) : null}
      </View>
      {pc?.description ? <BdText variant="caption">{pc.description}</BdText> : null}
      <BdButton
        kind="outlined"
        title={pc?.buttonLabel || strings.addCard}
        busy={busy}
        onPress={() => void collect()}
        style={styles.start}
      />
      {problem ? <BdText variant="error">{problem}</BdText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex13: { flex: 1.3 },
  flex14: { flex: 1.4 },
  start: { alignSelf: 'flex-start' },
  center: { textAlign: 'center' },
  semibold: { fontWeight: '600' },
  tnum: { fontVariant: ['tabular-nums'] },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  row4: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partLabel: { marginBottom: 4 },
  unitPicker: { minWidth: 96 },
  optionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionImage: { width: 28, height: 28, borderRadius: 6 },
  tool: {
    minWidth: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolDivider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardImage: { width: 56, height: 56, borderRadius: 10 },
  cardIcon: { width: 32, alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
  iconCell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  star: { padding: 2 },
  starGlyph: { fontSize: 34, lineHeight: 40 },
  faces: { flexDirection: 'row', justifyContent: 'space-evenly' },
  face: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  faceGlyph: { fontSize: 32, lineHeight: 40 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepperButton: { minWidth: 48, paddingHorizontal: 0 },
  dayCard: { width: 58, height: 72, alignItems: 'center', justifyContent: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  fileThumb: { width: 40, height: 40, borderRadius: 6 },
  fileGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  preview: { height: 180, overflow: 'hidden' },
  previewClear: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
})
