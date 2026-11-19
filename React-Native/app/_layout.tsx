import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* A chevron alone: the screen behind is the "(tabs)" group, whose name
            iOS would otherwise print as the back button's label. */}
        <Stack.Screen
          name="product/[id]"
          options={{ headerShown: true, title: 'Product', headerBackButtonDisplayMode: 'minimal' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  )
}
