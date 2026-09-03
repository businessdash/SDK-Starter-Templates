import { useState } from 'react'
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native'

import { useVisitorToken } from '@/bd/useBd'
import { useChat } from '@/bd/useChat'

export default function ChatScreen() {
  const visitorToken = useVisitorToken()
  const { messages, error, send, ready } = useChat(visitorToken)
  const [draft, setDraft] = useState('')

  async function submit() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await send(text)
  }

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Say hello.</Text>}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.role}>{item.role}</Text>
            <Text>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask us anything…"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          editable={ready}
        />
        <Button title="Send" onPress={submit} disabled={!ready} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bubble: { padding: 12, gap: 2 },
  role: { fontSize: 11, textTransform: 'uppercase', color: '#9ca3af' },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  empty: { padding: 24, color: '#6b7280', textAlign: 'center' },
  error: { padding: 10, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 12 },
})
