import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

/**
 * The tabs, and the screens that open over them. Each pushed screen shows a
 * chevron alone: the screen behind is the "(tabs)" group, whose name iOS
 * would otherwise print as the back button's label.
 */
const pushed = {
  headerShown: true,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: '#fff' },
} as const

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ ...pushed, title: 'Product' }} />
        <Stack.Screen name="wishlist" options={{ ...pushed, title: 'Wishlist' }} />
        <Stack.Screen name="compare" options={{ ...pushed, title: 'Compare' }} />
        <Stack.Screen name="reviews" options={{ ...pushed, title: 'Reviews' }} />
        <Stack.Screen name="blog/[slug]" options={{ ...pushed, title: '' }} />
        {/* Stripe sends the customer back to bdstarter://checkout/success. */}
        <Stack.Screen name="checkout/success" options={{ ...pushed, title: 'Your order' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  )
}
