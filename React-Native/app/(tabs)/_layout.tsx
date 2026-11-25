import { Tabs } from 'expo-router'
import { useEffect } from 'react'

import { refreshCartCount, useCartCount } from '@/bd/cart-count'

export default function TabsLayout() {
  const inCart = useCartCount()

  // The badge at launch; screens that change the cart keep it current.
  useEffect(() => {
    void refreshCartCount()
  }, [])

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Shop' }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: inCart > 0 ? inCart : undefined,
          tabBarAccessibilityLabel: inCart > 0 ? `Cart, ${inCart} ${inCart === 1 ? 'item' : 'items'}` : 'Cart',
        }}
      />
      <Tabs.Screen name="blog" options={{ title: 'Blog' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="form" options={{ title: 'Form' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  )
}
