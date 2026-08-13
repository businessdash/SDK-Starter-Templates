import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import type { Load } from '@/biab/useBiab'

/**
 * Renders a `Load` with a consistent spinner / message / content shape, and
 * keeps "temporarily unavailable" (lapsed plan, suspended site) visually
 * distinct from a network blip — a distinction the SDK's error classes draw,
 * and one a customer reads very differently.
 */
export function LoadState<T>({
  state,
  children,
}: {
  state: Load<T>
  children: (value: T) => React.ReactNode
}) {
  if (state.status === 'loading') {
    return <ActivityIndicator style={styles.centered} />
  }

  if (state.status === 'failed') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>
          {state.isUnavailable ? 'Temporarily unavailable' : "Couldn't load"}
        </Text>
        <Text style={styles.body}>{state.message}</Text>
      </View>
    )
  }

  return <>{children(state.value)}</>
}

export function SetupBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        Not connected to BIAB — set EXPO_PUBLIC_BIAB_SITE_ID and
        EXPO_PUBLIC_BIAB_PK in .env, then restart the dev server.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { padding: 24, alignItems: 'center', gap: 6 },
  title: { fontWeight: '600', fontSize: 16 },
  body: { color: '#6b7280', textAlign: 'center' },
  banner: { backgroundColor: '#fef3c7', padding: 10 },
  bannerText: { fontSize: 12, color: '#7c2d12' },
})
