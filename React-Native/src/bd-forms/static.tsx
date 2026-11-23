import {
  type CalculationConfig,
  type FormCoreField,
  type FormulaValue,
  formatCalcValue,
} from '@businessdash/sdk/forms'
import { useMemo, useState } from 'react'
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  type TextStyle,
  View,
} from 'react-native'

import { htmlSpans, safeHttpUrl, tableCheckState } from './logic'
import { BdCheckGlyph, BdText } from './primitives'
import { useBdForm } from './theme'

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** Display-only elements: headings, copy, lists, tables, images. */
export function BdStaticContent({ field }: { field: FormCoreField }) {
  const { theme } = useBdForm()
  switch (field.type) {
    case 'title':
      return (
        <BdText variant="title" accessibilityRole="header">
          {field.label || 'Untitled'}
        </BdText>
      )
    case 'subtitle':
      return (
        <BdText variant="headline" accessibilityRole="header">
          {field.label ?? ''}
        </BdText>
      )
    case 'separator':
      return (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.separator,
          }}
        />
      )
    case 'richtext':
      return field.content ? <BdHtmlText html={field.content} /> : null
    case 'body_text':
      return field.content ? <BdText>{field.content}</BdText> : null
    case 'bullet_list':
      return <BdBulletList field={field} />
    case 'table':
      return <BdTable field={field} />
    case 'image':
      return <BdStaticImage field={field} />
    default:
      return null
  }
}

/** Server-sanitized HTML drawn as native text, links included. */
export function BdHtmlText({ html }: { html: string }) {
  const { theme } = useBdForm()
  const c = theme.colors
  const spans = useMemo(() => htmlSpans(html), [html])
  return (
    <BdText>
      {spans.map((s, i) => {
        const style: Mutable<TextStyle> = {}
        if (s.bold) style.fontWeight = '700'
        if (s.italic) style.fontStyle = 'italic'
        const deco = [s.underline && 'underline', s.strike && 'line-through']
          .filter(Boolean)
          .join(' ')
        if (deco) style.textDecorationLine = deco as TextStyle['textDecorationLine']
        if (s.code) style.fontFamily = Platform.OS === 'ios' ? 'Menlo' : 'monospace'
        if (s.heading) {
          style.fontSize = s.heading <= 1 ? 22 : s.heading === 2 ? 19 : 17
          style.lineHeight = style.fontSize + 6
        }
        if (s.quote) style.color = c.textSecondary
        if (s.link) {
          const href = s.link
          return (
            <BdText
              key={`s-${i}`}
              accessibilityRole="link"
              color={c.tint}
              style={[style, { textDecorationLine: 'underline' }]}
              onPress={() => {
                void Linking.openURL(href).catch(() => {})
              }}
            >
              {s.text}
            </BdText>
          )
        }
        return (
          <BdText key={`s-${i}`} style={style}>
            {s.text}
          </BdText>
        )
      })}
    </BdText>
  )
}

/** A Lucide icon through the app's `renderIcon`, or nothing. */
export function BdIcon({
  name,
  size = 20,
  color,
}: {
  name: string | null | undefined
  size?: number
  color?: string | import('react-native').ColorValue
}) {
  const { renderIcon, theme } = useBdForm()
  if (!name || !renderIcon) return null
  return <>{renderIcon(name, size, color ?? theme.colors.text)}</>
}

type ListItem = { text: string; description?: string; icon?: string }

function BdBulletList({ field }: { field: FormCoreField }) {
  const { theme } = useBdForm()
  const cfg = field.listConfig
  const items = (cfg?.items ?? []) as ListItem[]
  const details = cfg?.variant === 'details'
  return (
    <View style={styles.list}>
      {!details && cfg?.title ? <BdText variant="headline">{cfg.title}</BdText> : null}
      {items.map((item, i) =>
        details ? (
          <View key={`li-${i}`} style={styles.listRow}>
            {item.icon ? (
              <View style={styles.listIcon}>
                <BdIcon name={item.icon} color={theme.colors.tint} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <BdText style={styles.semibold}>{item.text}</BdText>
              {item.description ? <BdText variant="caption">{item.description}</BdText> : null}
            </View>
          </View>
        ) : (
          <View key={`li-${i}`} style={styles.listRow}>
            <BdText color={theme.colors.textSecondary}>•</BdText>
            <BdText style={styles.flex}>{item.text}</BdText>
          </View>
        ),
      )}
    </View>
  )
}

/** Columns share the width when they fit; the table scrolls sideways when they don't. */
function BdTable({ field }: { field: FormCoreField }) {
  const { theme } = useBdForm()
  const c = theme.colors
  const cfg = field.tableConfig
  const columns = cfg?.columns ?? []
  if (columns.length === 0) return null
  const rows = cfg?.rows ?? []
  const highlight = cfg?.highlightColumn
  const scrolls = columns.length > 3
  const cellWidth = scrolls ? 128 : undefined

  const cell = (ci: number, content: React.ReactNode, key: string, head?: boolean) => {
    const align = columns[ci]?.align
    return (
      <View
        key={key}
        style={[
          styles.cell,
          cellWidth ? { width: cellWidth } : styles.flex,
          {
            alignItems:
              align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
            backgroundColor: ci === highlight ? c.tintSoft : 'transparent',
          },
          head && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: c.separator,
          },
        ]}
      >
        {content}
      </View>
    )
  }

  const table = (
    <View>
      <View style={styles.row}>
        {columns.map((col, ci) =>
          cell(ci, <BdText style={styles.semibold}>{col.header}</BdText>, `h-${ci}`, true),
        )}
      </View>
      {rows.map((row, ri) => (
        <View key={`r-${ri}`} style={styles.row}>
          {columns.map((col, ci) => {
            const text = row.cells?.[ci] ?? ''
            const state = col.type === 'check' ? tableCheckState(text) : 'text'
            const content =
              state === 'yes' ? (
                <View accessible accessibilityLabel="Yes">
                  <BdCheckGlyph color={c.tint} size={16} />
                </View>
              ) : state === 'no' ? (
                <BdText color={c.textSecondary} accessibilityLabel="No">
                  –
                </BdText>
              ) : (
                <BdText variant="caption" color={c.text}>
                  {text}
                </BdText>
              )
            return cell(ci, content, `c-${ri}-${ci}`)
          })}
        </View>
      ))}
    </View>
  )
  return scrolls ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {table}
    </ScrollView>
  ) : (
    table
  )
}

function BdStaticImage({ field }: { field: FormCoreField }) {
  const { theme } = useBdForm()
  const cfg = (
    field as { imageConfig?: { src?: string; alt?: string; width?: number; height?: number } }
  ).imageConfig
  const url = safeHttpUrl(cfg?.src)
  const [ratio, setRatio] = useState<number | null>(null)
  if (!url) return null
  return (
    <View style={styles.imageWrap}>
      <Image
        source={{ uri: url }}
        accessibilityLabel={cfg?.alt || undefined}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source
          if (width > 0 && height > 0) setRatio(width / height)
        }}
        style={[
          {
            width: cfg?.width ?? '100%',
            maxWidth: '100%',
            borderRadius: theme.cornerRadius / 2,
          },
          cfg?.height ? { height: cfg.height } : { aspectRatio: ratio ?? 16 / 9 },
        ]}
      />
    </View>
  )
}

/** A live calculation result, read-only. */
export function BdCalculationView({ field, value }: { field: FormCoreField; value: unknown }) {
  const { theme, strings } = useBdForm()
  const cfg = (field as { calculationConfig?: CalculationConfig }).calculationConfig
  const has = value !== null && value !== undefined && value !== ''
  return (
    <View
      style={[
        styles.calc,
        { backgroundColor: theme.colors.surface, borderRadius: theme.cornerRadius },
      ]}
      accessibilityLiveRegion="polite"
    >
      {cfg?.sensitive && !has ? (
        <BdText variant="caption">{strings.calculatedOnSubmit}</BdText>
      ) : (
        <BdText variant="headline" selectable style={styles.tnum}>
          {has ? formatCalcValue(value as FormulaValue, cfg?.display) : '—'}
        </BdText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontWeight: '600' },
  list: { gap: 10 },
  listRow: { flexDirection: 'row', gap: 10 },
  listIcon: { paddingTop: 1 },
  row: { flexDirection: 'row' },
  cell: { paddingHorizontal: 8, paddingVertical: 8, justifyContent: 'center' },
  imageWrap: { alignItems: 'center' },
  calc: { paddingHorizontal: 16, paddingVertical: 12 },
  tnum: { fontVariant: ['tabular-nums'] },
})
