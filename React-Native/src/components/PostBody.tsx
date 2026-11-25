import { useEffect, useState } from 'react'
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'

import { type PostBlock, type Run } from '@/shop/post-blocks'
import { shop } from './shop'

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

/**
 * A post's body drawn natively from `postBlocks(html)`: headings,
 * paragraphs, quotes, lists, code, photos with captions, tables and rules.
 * Nothing in a post runs in the app, and links open in the browser, mail or
 * phone app.
 */
export function PostBody({ blocks }: { blocks: PostBlock[] }) {
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((block, index) => (
        // Blocks have no ids; a post's blocks never reorder, so the index is the key.
        <Block key={index} block={block} />
      ))}
    </View>
  )
}

function Block({ block }: { block: PostBlock }) {
  switch (block.kind) {
    case 'heading':
      return (
        <Text accessibilityRole="header" style={[styles.heading, headingSize(block.level)]}>
          <Runs runs={block.text} />
        </Text>
      )
    case 'paragraph':
      return (
        <Text style={styles.body}>
          <Runs runs={block.text} />
        </Text>
      )
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={[styles.body, { fontStyle: 'italic' }]}>
            <Runs runs={block.text} />
          </Text>
        </View>
      )
    case 'list':
      return (
        <View style={{ gap: 6 }}>
          {block.items.map((item, index) => (
            <View key={index} style={[styles.listItem, { paddingLeft: item.depth * 18 }]}>
              <Text style={[styles.body, styles.marker]}>{item.marker}</Text>
              <Text style={[styles.body, { flex: 1 }]}>
                <Runs runs={item.text} />
              </Text>
            </View>
          ))}
        </View>
      )
    case 'code':
      return (
        <ScrollView horizontal style={styles.code} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.codeText}>{block.text}</Text>
        </ScrollView>
      )
    case 'image':
      return <PostImage url={block.url} alt={block.alt} />
    case 'caption':
      return (
        <Text style={styles.caption}>
          <Runs runs={block.text} />
        </Text>
      )
    case 'table':
      return (
        <ScrollView horizontal>
          <View style={styles.table}>
            {block.rows.map((row, r) => (
              <View key={r} style={[styles.tableRow, row.isHeader && { backgroundColor: shop.soft }]}>
                {row.cells.map((cell, c) => (
                  <Text key={c} style={[styles.cell, row.isHeader && { fontWeight: '700' }]}>
                    <Runs runs={cell} />
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )
    case 'rule':
      return <View style={styles.rule} />
  }
}

/** Styled stretches inside one `Text`, so they wrap as one paragraph. */
function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, index) => {
        const link = run.link
        return (
          <Text
            key={index}
            style={[
              run.bold && { fontWeight: '700' },
              run.italic && { fontStyle: 'italic' },
              run.strike && { textDecorationLine: 'line-through' },
              run.code && { fontFamily: MONO, backgroundColor: shop.soft },
              link ? styles.link : null,
            ]}
            accessibilityRole={link ? 'link' : undefined}
            onPress={link ? () => void Linking.openURL(link) : undefined}
          >
            {run.text}
          </Text>
        )
      })}
    </>
  )
}

/** A photo at its own shape once its size is known. */
function PostImage({ url, alt }: { url: string; alt: string }) {
  const [ratio, setRatio] = useState(16 / 9)
  useEffect(() => {
    Image.getSize(
      url,
      (width, height) => {
        if (width > 0 && height > 0) setRatio(width / height)
      },
      () => {},
    )
  }, [url])
  return (
    <Image
      source={{ uri: url }}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: 10, backgroundColor: shop.soft }}
      resizeMode="contain"
      accessibilityLabel={alt || undefined}
      accessible={!!alt}
    />
  )
}

function headingSize(level: number) {
  return { fontSize: level <= 1 ? 26 : level === 2 ? 22 : level === 3 ? 19 : 17 }
}

const styles = StyleSheet.create({
  heading: { fontWeight: '800', color: shop.text, marginTop: 6 },
  body: { fontSize: 16, lineHeight: 24, color: shop.text },
  quote: { borderLeftWidth: 3, borderLeftColor: shop.accent, paddingLeft: 12 },
  listItem: { flexDirection: 'row', gap: 8 },
  marker: { minWidth: 18, color: shop.muted },
  code: { backgroundColor: shop.soft, borderRadius: 10 },
  codeText: { fontFamily: MONO, fontSize: 13, color: shop.text },
  caption: { fontSize: 13, color: shop.muted, textAlign: 'center' },
  table: { borderWidth: 1, borderColor: shop.border, borderRadius: 8, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: shop.border },
  cell: { width: 140, padding: 8, color: shop.text },
  rule: { height: 1, backgroundColor: shop.border, marginVertical: 6 },
  link: { color: shop.accent, textDecorationLine: 'underline' },
})
