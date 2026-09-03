import 'dart:async';

import 'client.dart';
import 'models.dart';

/// Front Desk chat as a `Stream` of message batches.
///
/// The BD chat API is **polling-only** — there is no SSE and no WebSocket
/// anywhere in the Package API. The platform's guidance is `chatbot/messages`
/// every 3–5 seconds while a widget is open. This wraps that loop so a widget
/// can `StreamBuilder` instead of owning a `Timer`.
///
/// Design notes worth knowing before you change it:
///
/// * `since` carries forward so each poll returns only new rows.
/// * Messages are also de-duplicated on id. `since` is only as good as what
///   the server returns — with no cursor AND no timestamp it can't advance,
///   and the next poll replays rows a naive listener would render twice.
/// * The loop stops when the last listener detaches (`onCancel`), so leaving
///   a screen stops the network work. No timer to cancel, no leak.
class ChatFeed {
  ChatFeed({
    required BdClient client,
    required this.sessionId,
    required this.visitorToken,
    this.pollInterval = const Duration(seconds: 4),
    this.backoffInterval = const Duration(seconds: 15),
  }) : _client = client;

  final BdClient _client;
  final String sessionId;
  final String visitorToken;
  final Duration pollInterval;
  final Duration backoffInterval;

  /// New messages, in batches, until the subscription is cancelled.
  Stream<List<ChatMessage>> messages() {
    late StreamController<List<ChatMessage>> controller;
    var running = false;

    Future<void> poll() async {
      String? since;
      final seen = <String>{};

      while (running) {
        try {
          final response = await _client.get('chatbot/messages', query: {
            'sessionId': sessionId,
            'visitorToken': visitorToken,
            'since': since,
          });

          final batch = ((response['messages'] as List?) ?? [])
              .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
              .where((m) => seen.add(m.id))
              .toList();

          if (batch.isNotEmpty && !controller.isClosed) {
            controller.add(batch);
          }

          since = response['cursor'] as String? ??
              (batch.isNotEmpty ? batch.last.createdAt : since);

          await Future<void>.delayed(pollInterval);
        } catch (_) {
          // A transient failure is not a reason to end the stream — back off
          // rather than hammer a failing endpoint at 4s forever.
          await Future<void>.delayed(backoffInterval);
        }
      }
    }

    controller = StreamController<List<ChatMessage>>(
      onListen: () {
        running = true;
        unawaited(poll());
      },
      onCancel: () {
        running = false;
      },
    );

    return controller.stream;
  }

  /// Post a message. The next poll picks up the echo, so nothing is merged
  /// locally.
  ///
  /// Note the endpoint: `chatbot/messages`, **not** `chatbot/chat`. Those are
  /// two different products. `chat` is a stateless AI turn — you send the whole
  /// transcript and it answers, nothing is stored, and a human can't join.
  /// This is the Front Desk flow: the thread lives on the platform and staff
  /// can take over.
  Future<void> send(String text) async {
    await _client.post('chatbot/messages', body: {
      'sessionId': sessionId,
      'visitorToken': visitorToken,
      'content': text,
      'role': 'visitor',
    });
  }

  /// Mint (or resume) a Front Desk session for a visitor.
  ///
  /// A visitor token is NOT a session id — polling with one watches a
  /// conversation that doesn't exist and returns nothing, forever, without
  /// erroring.
  static Future<ChatFeed> start(
    BdClient client, {
    required String visitorToken,
  }) async {
    final body = await client.post('chatbot/persisted-session', body: {
      'visitorToken': visitorToken,
    });
    return ChatFeed(
      client: client,
      sessionId: body['sessionId'] as String,
      visitorToken: visitorToken,
    );
  }
}
