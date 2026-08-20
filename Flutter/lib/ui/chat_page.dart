import 'package:flutter/material.dart';

import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'biab_scope.dart';

/// Front Desk chat.
///
/// The BIAB chat API is polling-only — there is no SSE or WebSocket anywhere
/// in the Package API. `ChatFeed` wraps that loop in a `Stream`, so this
/// widget owns no `Timer`: subscribing starts the poll and disposing cancels
/// it, which stops the network work through the stream's `onCancel`.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _messages = <ChatMessage>[];
  final _controller = TextEditingController();
  ChatFeed? _feed;
  Stream<List<ChatMessage>>? _stream;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_feed != null) return;

    final scope = BiabScope.of(context);
    final client = scope.client;
    if (client == null) return;

    // One conversation per install. A real app would mint a session per topic
    // and persist the id alongside the visitor token.
    _feed = ChatFeed(
      client: client,
      sessionId: scope.visitorToken,
      visitorToken: scope.visitorToken,
    );
    _stream = _feed!.messages();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Front desk')),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: _stream,
              builder: (context, snapshot) {
                final batch = snapshot.data;
                if (batch != null) _messages.addAll(batch);

                if (_messages.isEmpty) {
                  return const Center(child: Text('Say hello.'));
                }

                return ListView.builder(
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    final message = _messages[index];
                    return ListTile(
                      title: Text(message.content),
                      subtitle: Text(message.role),
                    );
                  },
                );
              },
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: 'Ask us anything…',
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.send), onPressed: _send),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _feed == null) return;

    _controller.clear();
    // The next poll picks up the echo, so nothing is merged locally.
    await _feed!.send(text);
  }
}
