import {
  type ComponentRef,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  type ColorValue,
  FlatList,
  type KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { BdKeyboardRevealContext, useAndroidKeyboardHeight } from './keyboard'

import { fmt, useBdForm } from './theme'

// ─── Text ────────────────────────────────────────────────────────────────────

type TextRole = 'body' | 'label' | 'caption' | 'title' | 'headline' | 'button' | 'error'

const ROLE: Record<TextRole, TextStyle> = {
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  error: { fontSize: 13, lineHeight: 18 },
}

export function BdText({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: {
  variant?: TextRole
  color?: ColorValue
  style?: StyleProp<TextStyle>
  children?: ReactNode
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const { theme } = useBdForm()
  const c = theme.colors
  const tone =
    color ?? (variant === 'caption' ? c.textSecondary : variant === 'error' ? c.error : c.text)
  return (
    <Text style={[ROLE[variant], theme.font, { color: tone }, style]} {...rest}>
      {children}
    </Text>
  )
}

// ─── Text field ──────────────────────────────────────────────────────────────

export interface BdTextFieldProps extends Omit<TextInputProps, 'style' | 'onBlur' | 'onFocus'> {
  label?: string | undefined
  isError?: boolean | undefined
  leading?: ReactNode
  trailing?: ReactNode
  minLines?: number | undefined
  style?: StyleProp<ViewStyle>
  inputRef?: React.Ref<ComponentRef<typeof TextInput>>
  onBlur?: () => void
}

/** A text field drawn the platform's way: filled on iOS, outlined on Material. */
export function BdTextField({
  label,
  isError,
  leading,
  trailing,
  minLines,
  style,
  inputRef,
  onBlur,
  multiline,
  ...input
}: BdTextFieldProps) {
  const { theme } = useBdForm()
  const c = theme.colors
  const [focused, setFocused] = useState(false)
  const reveal = useContext(BdKeyboardRevealContext)
  const ios = theme.variant === 'ios'
  const lines = Math.max(minLines ?? (multiline ? 3 : 1), 1)
  const minHeight = multiline ? Math.max(theme.fieldHeight, lines * 22 + 22) : theme.fieldHeight
  const borderColor = isError ? c.error : focused ? c.tint : ios ? 'transparent' : c.border
  return (
    <View style={style}>
      {label ? (
        <BdText variant="caption" style={styles.partLabel}>
          {label}
        </BdText>
      ) : null}
      <View
        style={[
          styles.fieldBox,
          {
            minHeight,
            borderRadius: theme.fieldRadius,
            backgroundColor: ios ? c.field : 'transparent',
            borderColor,
            borderWidth: !ios && focused ? 2 : ios && !isError && !focused ? 0 : 1,
            paddingHorizontal: !ios && focused ? 11 : 12,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leading ? <View style={styles.adorn}>{leading}</View> : null}
        <TextInput
          ref={inputRef}
          placeholderTextColor={c.placeholder}
          selectionColor={Platform.OS === 'ios' ? c.tint : undefined}
          cursorColor={Platform.OS === 'android' ? c.tint : undefined}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => {
            setFocused(true)
            reveal?.()
          }}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          style={[
            styles.input,
            theme.font,
            {
              color: c.text,
              minHeight: minHeight - 2,
              paddingVertical: multiline ? 10 : 0,
            },
          ]}
          {...input}
        />
        {trailing ? <View style={styles.adorn}>{trailing}</View> : null}
      </View>
    </View>
  )
}

/** RN `autoComplete` values for the HTML tokens BD forms infer. */
const AUTOCOMPLETE: Record<string, TextInputProps['autoComplete']> = {
  name: 'name',
  'given-name': 'given-name',
  'additional-name': 'additional-name',
  'family-name': 'family-name',
  'honorific-prefix': 'honorific-prefix',
  'honorific-suffix': 'honorific-suffix',
  nickname: 'nickname',
  email: 'email',
  tel: 'tel',
  'tel-national': 'tel-national',
  url: 'url',
  organization: 'organization',
  'organization-title': 'organization-title',
  'street-address': 'street-address',
  'address-line1': 'address-line1',
  'address-line2': 'address-line2',
  'address-level2': 'postal-address-locality',
  'address-level1': 'postal-address-region',
  'postal-code': 'postal-code',
  country: 'country',
  'country-name': 'country',
  bday: 'birthdate-full',
  off: 'off',
}

/**
 * A keyboard for numbers that can be negative. `numbers-and-punctuation` is
 * iOS-only; Android's `numeric` pad has the minus sign and decimal point.
 */
export const SIGNED_KEYBOARD: KeyboardTypeOptions =
  Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'

/** Autofill + keyboard for a field, from its HTML autocomplete token. */
export function inputTraits(token: string | undefined): {
  autoComplete?: TextInputProps['autoComplete']
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: TextInputProps['autoCapitalize']
  autoCorrect?: boolean
} {
  const t = token?.trim().toLowerCase()
  const autoComplete = t ? AUTOCOMPLETE[t] : undefined
  switch (t) {
    case 'email':
      return {
        autoComplete,
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
      }
    case 'tel':
    case 'tel-national':
      return { autoComplete, keyboardType: 'phone-pad' }
    case 'url':
      return {
        autoComplete,
        keyboardType: 'url',
        autoCapitalize: 'none',
        autoCorrect: false,
      }
    case 'postal-code':
      // iOS's pad keeps the zip+4 dash; Android's has none, so digits there.
      return {
        autoComplete,
        keyboardType: Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'number-pad',
      }
    case 'name':
    case 'given-name':
    case 'additional-name':
    case 'family-name':
    case 'nickname':
    case 'honorific-prefix':
    case 'honorific-suffix':
    case 'address-level2':
      return { autoComplete, autoCapitalize: 'words', autoCorrect: false }
    default:
      return autoComplete ? { autoComplete } : {}
  }
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export function BdButton({
  title,
  onPress,
  kind = 'filled',
  disabled,
  busy,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string
  onPress: () => void
  kind?: 'filled' | 'tonal' | 'outlined' | 'text'
  disabled?: boolean | undefined
  busy?: boolean | undefined
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  const ios = theme.variant === 'ios'
  const fg = kind === 'filled' ? c.onTint : kind === 'tonal' ? c.text : c.tint
  const off = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      android_ripple={kind === 'text' ? { color: c.tintSoft, borderless: false } : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: kind === 'text' ? 36 : ios ? 50 : 44,
          borderRadius: ios ? 12 : 22,
          paddingHorizontal: kind === 'text' ? 8 : 20,
          backgroundColor:
            kind === 'filled' ? c.tint : kind === 'tonal' ? c.surface : 'transparent',
          borderWidth: kind === 'outlined' ? 1 : 0,
          borderColor: c.border,
          opacity: off ? 0.45 : pressed && Platform.OS === 'ios' ? 0.7 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} size="small" style={styles.buttonIcon} />
      ) : icon ? (
        <View style={styles.buttonIcon}>{icon}</View>
      ) : null}
      <BdText variant="button" color={fg} numberOfLines={1}>
        {title}
      </BdText>
    </Pressable>
  )
}

// ─── Choices ─────────────────────────────────────────────────────────────────

/** A radio or checkbox mark. */
export function BdMark({ on, multi }: { on: boolean; multi: boolean }) {
  const { theme } = useBdForm()
  const c = theme.colors
  if (multi) {
    return (
      <View
        style={[
          styles.check,
          {
            borderRadius: theme.variant === 'ios' ? 6 : 2,
            borderColor: on ? c.tint : c.border,
            backgroundColor: on ? c.tint : 'transparent',
          },
        ]}
      >
        {on ? <BdCheckGlyph color={c.onTint} size={14} /> : null}
      </View>
    )
  }
  return (
    <View style={[styles.radio, { borderColor: on ? c.tint : c.border }]}>
      {on ? <View style={[styles.radioDot, { backgroundColor: c.tint }]} /> : null}
    </View>
  )
}

/** A check mark drawn with two bars, so it needs no icon font. */
export function BdCheckGlyph({ color, size = 16 }: { color: ColorValue; size?: number }) {
  const w = Math.max(2, size / 7)
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          top: size * 0.5,
          width: size * 0.36,
          height: w,
          borderRadius: w,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.32,
          top: size * 0.42,
          width: size * 0.62,
          height: w,
          borderRadius: w,
          backgroundColor: color,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  )
}

/**
 * A switch in the form's tint. Android also takes the thumb color, or it
 * keeps the host app's accent; on iOS the thumb stays white.
 */
export function BdSwitch({
  value,
  onValueChange,
}: {
  value: boolean
  onValueChange: (on: boolean) => void
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  const android = Platform.OS === 'android'
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: c.tint, false: android ? c.border : undefined }}
      thumbColor={android ? (value ? c.onTint : c.textSecondary) : undefined}
      importantForAccessibility="no-hide-descendants"
    />
  )
}

/** A chevron pointing down, drawn without an icon font. */
export function BdChevron({ color }: { color: ColorValue }) {
  return (
    <View style={styles.chevron}>
      <View
        style={[
          styles.chevronBar,
          { backgroundColor: color, transform: [{ rotate: '45deg' }], left: 1 },
        ]}
      />
      <View
        style={[
          styles.chevronBar,
          {
            backgroundColor: color,
            transform: [{ rotate: '-45deg' }],
            left: 6,
          },
        ]}
      />
    </View>
  )
}

/** One row in a radio or checkbox group. */
export function BdChoiceRow({
  selected,
  multi,
  onPress,
  children,
  last,
}: {
  selected: boolean
  multi: boolean
  onPress: () => void
  children: ReactNode
  last?: boolean
}) {
  const { theme } = useBdForm()
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      android_ripple={{ color: theme.colors.tintSoft }}
      style={({ pressed }) => [
        styles.choiceRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.separator,
        },
        pressed && Platform.OS === 'ios' && { opacity: 0.6 },
      ]}
    >
      <BdMark on={selected} multi={multi} />
      <View style={styles.flex}>{children}</View>
    </Pressable>
  )
}

/** A group of choice rows, in a card. */
export function BdChoiceGroup({ children, multi }: { children: ReactNode; multi: boolean }) {
  const { theme } = useBdForm()
  return (
    <View
      accessibilityRole={multi ? undefined : 'radiogroup'}
      style={[
        styles.group,
        {
          borderRadius: theme.cornerRadius,
          borderColor: theme.colors.separator,
          backgroundColor: theme.variant === 'ios' ? theme.colors.field : 'transparent',
          borderWidth: theme.variant === 'ios' ? 0 : 1,
        },
      ]}
    >
      {children}
    </View>
  )
}

/** A selectable chip (days, times, booking slots). */
export function BdChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string
  selected: boolean
  onPress: () => void
  accessibilityLabel?: string
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: theme.variant === 'ios' ? 16 : 8,
          backgroundColor: selected ? c.tintSoft : 'transparent',
          borderColor: selected ? c.tint : c.border,
          opacity: pressed && Platform.OS === 'ios' ? 0.6 : 1,
        },
      ]}
    >
      {selected ? <BdCheckGlyph color={c.tint} size={14} /> : null}
      <BdText variant="caption" color={selected ? c.text : c.textSecondary}>
        {label}
      </BdText>
    </Pressable>
  )
}

/** Two or more options side by side (Upload / Paste URL). */
export function BdSegmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  const ios = theme.variant === 'ios'
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segmented,
        {
          borderRadius: ios ? 9 : 20,
          backgroundColor: ios ? c.surface : 'transparent',
          borderWidth: ios ? 0 : 1,
          borderColor: c.border,
          padding: ios ? 2 : 0,
        },
      ]}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              {
                borderRadius: ios ? 7 : 20,
                backgroundColor: on ? (ios ? c.background : c.tintSoft) : 'transparent',
              },
            ]}
          >
            <BdText variant="caption" style={{ fontWeight: on ? '600' : '400' }}>
              {o.label}
            </BdText>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Status rows ─────────────────────────────────────────────────────────────

export function BdLoadingRow({ text }: { text: string }) {
  const { theme } = useBdForm()
  return (
    <View style={styles.statusRow} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.colors.tint} size="small" />
      <BdText variant="caption">{text}</BdText>
    </View>
  )
}

export function BdRetryRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { strings } = useBdForm()
  return (
    <View style={styles.statusRow}>
      <BdText variant="error" style={styles.flex}>
        {message}
      </BdText>
      <BdButton kind="text" title={strings.retry} onPress={onRetry} />
    </View>
  )
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

/**
 * A sheet over the form: the native page sheet on iOS, a bottom sheet on
 * Android.
 */
export function BdSheet({
  visible,
  onClose,
  title,
  trailing,
  fill,
  children,
}: {
  visible: boolean
  onClose: () => void
  title: string
  trailing?: ReactNode
  /** Keep the sheet's full height (on Android) instead of fitting the content, so a filtered list doesn't make it jump. */
  fill?: boolean
  children: ReactNode
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const insets = useContext(SafeAreaInsetsContext)
  const keyboard = useAndroidKeyboardHeight(visible)
  const bottom = keyboard > 0 ? keyboard : Math.max(insets?.bottom ?? 0, 12)
  const header = (
    <View style={[styles.sheetHeader, { borderBottomColor: c.separator }]}>
      <BdButton kind="text" title={strings.cancel} onPress={onClose} />
      <BdText
        variant="headline"
        numberOfLines={1}
        style={[styles.flex, { textAlign: 'center' }]}
        accessibilityRole="header"
      >
        {title}
      </BdText>
      <View style={styles.sheetTrailing}>{trailing}</View>
    </View>
  )
  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.flex, { backgroundColor: c.background, paddingBottom: bottom }]}>
          {header}
          <BdKeyboardRevealContext.Provider value={null}>
            {children}
          </BdKeyboardRevealContext.Provider>
        </View>
      </Modal>
    )
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.flex, { justifyContent: 'flex-end' }]}>
        <Pressable
          accessibilityLabel={strings.cancel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
        />
        <View
          style={[
            styles.bottomSheet,
            fill ? styles.bottomSheetFill : null,
            {
              backgroundColor: c.background,
              paddingBottom: bottom,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          {header}
          <BdKeyboardRevealContext.Provider value={null}>
            {children}
          </BdKeyboardRevealContext.Provider>
        </View>
      </View>
    </Modal>
  )
}

// ─── Option picker ───────────────────────────────────────────────────────────

export interface BdOption {
  value: string
  label: string
  /** Lucide icon name. */
  icon?: string | undefined
  /** Image URL. */
  image?: string | undefined
  detail?: string | undefined
}

/** Search shows when a list is long enough to need it. */
export const SEARCH_THRESHOLD = 10

/**
 * A field that opens a sheet of options: single or multiple choice, with
 * search for long lists and an optional "Use “…”" for free text.
 */
export function BdOptionPicker({
  title,
  placeholder,
  options,
  selection,
  onSelect,
  multi,
  searchable,
  allowCustom,
  isError,
  startAt,
  renderLabel,
  style,
}: {
  title: string
  placeholder: string
  options: readonly BdOption[]
  selection: readonly string[]
  onSelect: (next: string[]) => void
  multi: boolean
  searchable?: boolean | undefined
  allowCustom?: boolean | undefined
  isError?: boolean | undefined
  /** Scroll here when nothing is chosen yet (a time list opens on 09:00). */
  startAt?: string | undefined
  renderLabel?: (o: BdOption) => ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  const [open, setOpen] = useState(false)
  const ios = theme.variant === 'ios'
  const labels = selection.map((v) => options.find((o) => o.value === v)?.label ?? v)
  const text = labels.join(', ')
  const search = (searchable ?? options.length > SEARCH_THRESHOLD) || !!allowCustom
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title || placeholder}
        accessibilityValue={{ text: text || placeholder }}
        accessibilityHint={undefined}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fieldBox,
          {
            alignItems: 'center',
            minHeight: theme.fieldHeight,
            borderRadius: theme.fieldRadius,
            backgroundColor: ios ? c.field : 'transparent',
            borderColor: isError ? c.error : ios ? 'transparent' : c.border,
            borderWidth: ios && !isError ? 0 : 1,
            paddingHorizontal: 12,
            opacity: pressed && ios ? 0.6 : 1,
          },
        ]}
      >
        <BdText numberOfLines={1} color={text ? c.text : c.placeholder} style={styles.flex}>
          {text || placeholder}
        </BdText>
        <BdChevron color={c.textSecondary} />
      </Pressable>
      {open ? (
        <BdOptionSheet
          title={title || placeholder}
          options={options}
          selection={selection}
          multi={multi}
          search={search}
          allowCustom={!!allowCustom}
          startAt={startAt}
          renderLabel={renderLabel}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  )
}

function BdOptionSheet({
  title,
  options,
  selection,
  multi,
  search,
  allowCustom,
  startAt,
  renderLabel,
  onSelect,
  onClose,
}: {
  title: string
  options: readonly BdOption[]
  selection: readonly string[]
  multi: boolean
  search: boolean
  allowCustom: boolean
  startAt?: string | undefined
  renderLabel?: ((o: BdOption) => ReactNode) | undefined
  onSelect: (next: string[]) => void
  onClose: () => void
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([...selection])
  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : [...options]),
    [options, q],
  )
  const custom =
    allowCustom && query.trim().length > 0 && !options.some((o) => o.label.toLowerCase() === q)
      ? query.trim()
      : null
  const initial = useRef(
    Math.max(0, options.findIndex((o) => o.value === (selection[0] ?? startAt)) - 2),
  ).current

  const choose = useCallback(
    (value: string) => {
      if (multi) {
        setPicked((p) => (p.includes(value) ? p.filter((x) => x !== value) : [...p, value]))
        return
      }
      onSelect(selection[0] === value ? [] : [value])
      onClose()
    },
    [multi, onClose, onSelect, selection],
  )

  const done = () => {
    onSelect(picked)
    onClose()
  }

  const current = multi ? picked : selection
  return (
    <BdSheet
      visible
      onClose={multi ? done : onClose}
      title={title}
      trailing={multi ? <BdButton kind="text" title={strings.done} onPress={done} /> : null}
      fill={search}
    >
      {search ? (
        <View style={styles.sheetSearch}>
          <BdTextField
            value={query}
            onChangeText={setQuery}
            placeholder={strings.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType={custom ? 'done' : 'search'}
            onSubmitEditing={() => {
              if (custom) choose(custom)
            }}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        initialScrollIndex={q || initial >= shown.length ? 0 : initial}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        ListHeaderComponent={
          custom ? (
            <SheetRow
              label={fmt(strings.useCustom, custom)}
              on={false}
              multi={multi}
              onPress={() => choose(custom)}
            />
          ) : undefined
        }
        ListEmptyComponent={
          custom ? undefined : (
            <BdText variant="caption" style={styles.sheetEmpty}>
              {strings.noResults}
            </BdText>
          )
        }
        renderItem={({ item }) => (
          <SheetRow
            label={item.label}
            on={current.includes(item.value)}
            multi={multi}
            onPress={() => choose(item.value)}
          >
            {renderLabel?.(item)}
          </SheetRow>
        )}
        style={{ backgroundColor: c.background }}
      />
    </BdSheet>
  )
}

const ROW_HEIGHT = 52

function SheetRow({
  label,
  on,
  multi,
  onPress,
  children,
}: {
  label: string
  on: boolean
  multi: boolean
  onPress: () => void
  children?: ReactNode
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on, selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.tintSoft }}
      style={({ pressed }) => [
        styles.sheetRow,
        {
          borderBottomColor: c.separator,
          backgroundColor: pressed && Platform.OS === 'ios' ? c.surface : 'transparent',
        },
      ]}
    >
      {theme.variant === 'material' ? <BdMark on={on} multi={multi} /> : null}
      <View style={styles.flex}>{children ?? <BdText numberOfLines={1}>{label}</BdText>}</View>
      {theme.variant === 'ios' && on ? <BdCheckGlyph color={c.tint} size={18} /> : null}
    </Pressable>
  )
}

// ─── Slider ──────────────────────────────────────────────────────────────────

/** A slider in plain React Native: drag or tap the track; adjustable for screen readers. */
export function BdSlider({
  value,
  min,
  max,
  step,
  onChange,
  onEnd,
  accessibilityLabel,
  valueText,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  onEnd?: () => void
  accessibilityLabel: string
  valueText: string
}) {
  const { theme } = useBdForm()
  const c = theme.colors
  const track = useRef<ComponentRef<typeof View>>(null)
  const box = useRef({ x: 0, width: 1 })
  const [width, setWidth] = useState(0)
  const span = Math.max(max - min, step)
  const fraction = Math.min(Math.max((value - min) / span, 0), 1)
  const thumb = theme.variant === 'ios' ? 28 : 20

  const snap = (v: number) => {
    const n = Math.round((v - min) / step) * step + min
    const clamped = Math.min(Math.max(n, min), max)
    // Keep the step's precision (0.1 steps shouldn't give 0.30000000000000004).
    const decimals = (String(step).split('.')[1] ?? '').length
    return Number(clamped.toFixed(decimals))
  }
  const fromX = (pageX: number) => {
    const f = (pageX - box.current.x) / Math.max(box.current.width, 1)
    const next = snap(min + Math.min(Math.max(f, 0), 1) * span)
    if (next !== value) onChange(next)
  }
  const measure = (then?: () => void) => {
    track.current?.measureInWindow((x, _y, w) => {
      box.current = { x, width: w }
      then?.()
    })
  }

  return (
    <View
      ref={track}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width)
        measure()
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = snap(value + (e.nativeEvent.actionName === 'increment' ? step : -step))
        if (next !== value) onChange(next)
        onEnd?.()
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const x = e.nativeEvent.pageX
        measure(() => fromX(x))
      }}
      onResponderMove={(e) => fromX(e.nativeEvent.pageX)}
      onResponderRelease={() => onEnd?.()}
      style={styles.sliderHit}
    >
      <View
        style={[
          styles.sliderTrack,
          { backgroundColor: theme.variant === 'ios' ? c.surface : c.tintSoft },
        ]}
      >
        <View
          style={{
            width: `${fraction * 100}%`,
            height: '100%',
            backgroundColor: c.tint,
            borderRadius: 2,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.sliderThumb,
          {
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            left: fraction * Math.max(width - thumb, 0),
            backgroundColor: theme.variant === 'ios' ? '#FFFFFF' : c.tint,
          },
          theme.variant === 'ios' && styles.iosThumbShadow,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  partLabel: { marginBottom: 4 },
  fieldBox: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  adorn: { justifyContent: 'center', alignSelf: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  buttonIcon: { marginRight: 2 },
  check: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  chevron: { width: 14, height: 10, justifyContent: 'center' },
  chevronBar: {
    position: 'absolute',
    width: 8,
    height: 2,
    borderRadius: 1,
    top: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  group: { overflow: 'hidden' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  segmented: { flexDirection: 'row', overflow: 'hidden' },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTrailing: { minWidth: 72, alignItems: 'flex-end' },
  sheetSearch: { paddingHorizontal: 16, paddingVertical: 10 },
  sheetEmpty: { padding: 24, textAlign: 'center' },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: ROW_HEIGHT,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bottomSheet: { maxHeight: '85%', minHeight: '40%', overflow: 'hidden' },
  bottomSheetFill: { height: '85%' },
  grabber: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    opacity: 0.6,
  },
  sliderHit: { height: 44, justifyContent: 'center' },
  sliderTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  sliderThumb: { position: 'absolute' },
  iosThumbShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
})
