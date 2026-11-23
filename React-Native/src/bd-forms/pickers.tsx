import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import {
  addDays,
  type BdDay,
  compareDays,
  contrastingText,
  daysInMonth,
  formatDay,
  formatTime,
  normalizeHex,
  parseDay,
  parseTime,
  timesOfDay,
  today,
  weekday,
} from './logic'
import {
  BdButton,
  BdCheckGlyph,
  BdChevron,
  BdOptionPicker,
  BdSheet,
  BdText,
  BdTextField,
} from './primitives'
import { useBdForm } from './theme'

function dayDate(day: BdDay): Date {
  return new Date(day.y, day.m - 1, day.d)
}

/** "Nov 20, 2026" in the device's language. */
export function formatDayLabel(day: BdDay): string {
  try {
    return dayDate(day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return formatDay(day)
  }
}

function monthTitle(y: number, m: number): string {
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return `${y}-${String(m).padStart(2, '0')}`
  }
}

/** Short weekday names starting Sunday, in the device's language. */
function weekdayNames(): string[] {
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    // 2023-01-01 was a Sunday.
    const d = new Date(2023, 0, 1 + i)
    try {
      out.push(d.toLocaleDateString(undefined, { weekday: 'narrow' }))
    } catch {
      out.push(['S', 'M', 'T', 'W', 'T', 'F', 'S'][i] as string)
    }
  }
  return out
}

/** Month names January–December, in the device's language. */
export function monthNames(): string[] {
  const out: string[] = []
  for (let m = 0; m < 12; m++) {
    try {
      out.push(new Date(2023, m, 1).toLocaleDateString(undefined, { month: 'long' }))
    } catch {
      out.push(String(m + 1))
    }
  }
  return out
}

/** A field that shows a date and opens a month calendar. Writes `yyyy-MM-dd`. */
export function BdDateField({
  value,
  onChange,
  label,
  placeholder,
  min,
  max,
  isError,
  title,
}: {
  value: string | undefined
  onChange: (v: string) => void
  label?: string | undefined
  placeholder?: string | undefined
  min?: BdDay | null | undefined
  max?: BdDay | null | undefined
  isError?: boolean | undefined
  title?: string | undefined
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const ios = theme.variant === 'ios'
  const [open, setOpen] = useState(false)
  const day = parseDay(value)
  const text = day ? formatDayLabel(day) : ''
  return (
    <View>
      {label ? (
        <BdText variant="caption" style={styles.label}>
          {label}
        </BdText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || title || strings.date}
        accessibilityValue={{ text: text || placeholder || strings.addDate }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            minHeight: theme.fieldHeight,
            borderRadius: theme.fieldRadius,
            backgroundColor: ios ? c.field : 'transparent',
            borderColor: isError ? c.error : ios ? 'transparent' : c.border,
            borderWidth: ios && !isError ? 0 : 1,
            opacity: pressed && ios ? 0.6 : 1,
          },
        ]}
      >
        <BdText color={text ? c.text : c.placeholder} style={styles.flex}>
          {text || placeholder || strings.addDate}
        </BdText>
        <BdChevron color={c.textSecondary} />
      </Pressable>
      {open ? (
        <BdCalendarSheet
          title={title || label || strings.date}
          value={day}
          min={min ?? null}
          max={max ?? null}
          onPick={(d) => {
            onChange(d ? formatDay(d) : '')
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </View>
  )
}

function BdCalendarSheet({
  title,
  value,
  min,
  max,
  onPick,
  onClose,
}: {
  title: string
  value: BdDay | null
  min: BdDay | null
  max: BdDay | null
  onPick: (d: BdDay | null) => void
  onClose: () => void
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const now = today()
  const start = value ?? (min && compareDays(min, now) > 0 ? min : now)
  const [cursor, setCursor] = useState({ y: start.y, m: start.m })
  const names = useMemo(weekdayNames, [])

  const first: BdDay = { y: cursor.y, m: cursor.m, d: 1 }
  const lead = weekday(first)
  const count = daysInMonth(cursor.y, cursor.m)
  const cells: Array<BdDay | null> = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= count; d++) cells.push({ y: cursor.y, m: cursor.m, d })
  while (cells.length % 7 !== 0) cells.push(null)

  const shift = (n: number) => {
    const t = new Date(cursor.y, cursor.m - 1 + n, 1)
    setCursor({ y: t.getFullYear(), m: t.getMonth() + 1 })
  }
  const prevOff = min != null && compareDays(addDays(first, -1), min) < 0
  const nextOff = max != null && compareDays({ y: cursor.y, m: cursor.m, d: count }, max) >= 0

  return (
    <BdSheet
      visible
      onClose={onClose}
      title={title}
      trailing={
        value ? <BdButton kind="text" title={strings.clear} onPress={() => onPick(null)} /> : null
      }
    >
      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <BdButton
            kind="text"
            title="‹"
            accessibilityLabel={strings.previousMonth}
            disabled={prevOff}
            onPress={() => shift(-1)}
          />
          <BdText variant="headline" accessibilityRole="header" style={styles.monthTitle}>
            {monthTitle(cursor.y, cursor.m)}
          </BdText>
          <BdButton
            kind="text"
            title="›"
            accessibilityLabel={strings.nextMonth}
            disabled={nextOff}
            onPress={() => shift(1)}
          />
        </View>
        <View style={styles.week}>
          {names.map((n, i) => (
            <BdText key={`${n}-${i}`} variant="caption" style={styles.weekday}>
              {n}
            </BdText>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={`row-${row}`} style={styles.week}>
            {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
              if (!d) return <View key={`e-${row}-${i}`} style={styles.cell} />
              const off =
                (min != null && compareDays(d, min) < 0) || (max != null && compareDays(d, max) > 0)
              const on = value != null && compareDays(d, value) === 0
              const isToday = compareDays(d, now) === 0
              return (
                <Pressable
                  key={formatDay(d)}
                  accessibilityRole="button"
                  accessibilityLabel={formatDayLabel(d)}
                  accessibilityState={{ selected: on, disabled: off }}
                  disabled={off}
                  onPress={() => onPick(d)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.dayDot,
                      on && { backgroundColor: c.tint },
                      !on &&
                        isToday && {
                          borderWidth: 1,
                          borderColor: c.tint,
                        },
                    ]}
                  >
                    <BdText
                      color={on ? c.onTint : off ? c.placeholder : isToday ? c.tint : c.text}
                      style={{ fontWeight: on || isToday ? '600' : '400' }}
                    >
                      {d.d}
                    </BdText>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </BdSheet>
  )
}

/** A time of day from a list, `step` minutes apart. Writes `HH:MM`. */
export function BdTimeField({
  value,
  onChange,
  label,
  placeholder,
  step,
  twelveHour,
  isError,
}: {
  value: string | undefined
  onChange: (v: string) => void
  label?: string | undefined
  placeholder?: string | undefined
  step: number
  twelveHour: boolean
  isError?: boolean | undefined
}) {
  const { strings } = useBdForm()
  const options = useMemo(
    () => timesOfDay(step).map((t) => ({ value: t, label: formatTime(t, twelveHour) })),
    [step, twelveHour],
  )
  const current = parseTime(value)
  // A stored time between the steps still shows and stays selected.
  const all =
    current && !options.some((o) => o.value === current)
      ? [...options, { value: current, label: formatTime(current, twelveHour) }].sort((a, b) =>
          a.value.localeCompare(b.value),
        )
      : options
  return (
    <View>
      {label ? (
        <BdText variant="caption" style={styles.label}>
          {label}
        </BdText>
      ) : null}
      <BdOptionPicker
        title={label || strings.time}
        placeholder={placeholder || strings.addTime}
        options={all}
        selection={current ? [current] : []}
        onSelect={(next) => onChange(next[0] ?? '')}
        multi={false}
        searchable={false}
        isError={isError}
        startAt="09:00"
      />
    </View>
  )
}

/** Preset swatches plus a custom hex color, previewed live. */
export function BdColorField({
  value,
  presets,
  onChange,
}: {
  value: string
  presets: readonly string[]
  onChange: (hex: string) => void
}) {
  const { theme, strings } = useBdForm()
  const c = theme.colors
  const [editing, setEditing] = useState(false)
  const isCustom = value.length > 0 && !presets.some((p) => p.toLowerCase() === value.toLowerCase())
  return (
    <View style={styles.swatches}>
      {presets.map((hex) => {
        const on = hex.toLowerCase() === value.toLowerCase()
        const color = normalizeHex(hex)
        return (
          <Pressable
            key={hex}
            accessibilityRole="radio"
            accessibilityLabel={hex}
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(color ?? hex)}
            style={[
              styles.swatch,
              {
                backgroundColor: color ?? 'transparent',
                borderColor: on ? c.tint : c.border,
                borderWidth: on ? 3 : StyleSheet.hairlineWidth * 2,
              },
            ]}
          >
            {on ? <BdCheckGlyph color={contrastingText(color)} size={16} /> : null}
          </Pressable>
        )
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.customColor}
        onPress={() => setEditing(true)}
        style={[
          styles.swatch,
          {
            backgroundColor: isCustom ? (normalizeHex(value) ?? c.surface) : c.surface,
            borderColor: isCustom ? c.tint : c.border,
            borderWidth: isCustom ? 3 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      >
        {isCustom ? null : (
          <BdText variant="headline" color={c.textSecondary}>
            +
          </BdText>
        )}
      </Pressable>
      {editing ? (
        <BdHexSheet
          initial={isCustom ? value : '#3B82F6'}
          onClose={() => setEditing(false)}
          onPick={(hex) => {
            onChange(hex)
            setEditing(false)
          }}
        />
      ) : null}
    </View>
  )
}

function BdHexSheet({
  initial,
  onPick,
  onClose,
}: {
  initial: string
  onPick: (hex: string) => void
  onClose: () => void
}) {
  const { theme, strings } = useBdForm()
  const [text, setText] = useState(initial)
  const parsed = normalizeHex(text)
  return (
    <BdSheet
      visible
      onClose={onClose}
      title={strings.customColor}
      trailing={
        <BdButton
          kind="text"
          title={strings.done}
          disabled={!parsed}
          onPress={() => parsed && onPick(parsed)}
        />
      }
    >
      <View style={styles.hexBody}>
        <View
          style={[
            styles.hexPreview,
            {
              backgroundColor: parsed ?? 'transparent',
              borderColor: theme.colors.border,
              borderRadius: theme.cornerRadius,
            },
          ]}
        />
        <BdTextField
          label={strings.hexColor}
          value={text}
          onChangeText={(t) => setText(t.replace(/[^#0-9a-fA-F]/g, '').slice(0, 7))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={Platform.OS !== 'web'}
          returnKeyType="done"
          onSubmitEditing={() => parsed && onPick(parsed)}
          isError={!parsed}
        />
      </View>
    </BdSheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { marginBottom: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  calendar: { paddingHorizontal: 12, paddingTop: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexBody: { padding: 16, gap: 16 },
  hexPreview: { height: 72, borderWidth: StyleSheet.hairlineWidth },
})
