import 'package:flutter/material.dart';

import 'package:biab/biab.dart';

/// Renders a future with a consistent spinner / message / content shape, and
/// keeps the "unavailable" case (lapsed plan, suspended site) visually
/// distinct from a network blip — a distinction `BiabException` already
/// draws, and one a customer reads very differently.
class BiabBuilder<T> extends StatelessWidget {
  const BiabBuilder({
    super.key,
    required this.future,
    required this.builder,
    this.empty,
  });

  final Future<T>? future;
  final Widget Function(BuildContext context, T value) builder;
  final Widget? empty;

  @override
  Widget build(BuildContext context) {
    if (future == null) {
      return empty ?? const _Notice('Not connected to BIAB.');
    }

    return FutureBuilder<T>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }

        final error = snapshot.error;
        if (error != null) {
          final unavailable = error is BiabException && error.isUnavailable;
          return _Notice(
            unavailable
                ? 'Temporarily unavailable.\n$error'
                : "Couldn't load.\n$error",
          );
        }

        return builder(context, snapshot.data as T);
      },
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(message, textAlign: TextAlign.center),
        ),
      );
}
