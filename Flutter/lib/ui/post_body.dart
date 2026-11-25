import 'package:businessdash_sdk/businessdash_sdk.dart';
import 'package:flutter/gestures.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// A post's body, drawn with Flutter's own text and images from
/// [PostBlocks]: no web view, and nothing in the post's HTML runs. Links
/// are the ones [PostHtml.safe] kept (web, mail and phone).
class PostBody extends StatelessWidget {
  const PostBody({super.key, required this.blocks});

  final List<PostBlock> blocks;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final muted = theme.hintColor;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        for (final block in blocks)
          switch (block) {
            PostHeading(:final level, text: final runs) => Semantics(
                header: true,
                child: _Runs(runs, style: switch (level) {
                  1 => text.headlineSmall,
                  2 => text.titleLarge,
                  3 => text.titleMedium,
                  _ => text.titleSmall,
                }),
              ),
            PostParagraph(text: final runs) => _Runs(runs, style: text.bodyLarge),
            PostQuote(text: final runs) => DecoratedBox(
                decoration: BoxDecoration(border: Border(left: BorderSide(color: theme.colorScheme.primary, width: 3))),
                child: Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: _Runs(runs, style: text.bodyLarge?.copyWith(fontStyle: FontStyle.italic)),
                ),
              ),
            PostList(:final items) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 6,
                children: [
                  for (final item in items)
                    Padding(
                      padding: EdgeInsets.only(left: 16.0 * item.depth),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(width: 24, child: Text(item.marker, style: text.bodyLarge)),
                          Expanded(child: _Runs(item.text, style: text.bodyLarge)),
                        ],
                      ),
                    ),
                ],
              ),
            PostCode(text: final code) => DecoratedBox(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.all(12),
                  child: Text(code, style: const TextStyle(fontFamily: 'monospace', fontSize: 13)),
                ),
              ),
            PostImage(:final url, :final alt) => ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  url,
                  fit: BoxFit.fitWidth,
                  semanticLabel: alt.isEmpty ? null : alt,
                  excludeFromSemantics: alt.isEmpty,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            PostCaption(text: final runs) =>
              _Runs(runs, style: text.bodySmall?.copyWith(color: muted), align: TextAlign.center),
            PostTable(:final rows) => SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Table(
                  defaultColumnWidth: const IntrinsicColumnWidth(),
                  border: TableBorder.all(color: theme.colorScheme.outlineVariant),
                  children: [
                    for (final row in rows)
                      TableRow(
                        children: [
                          for (final cell in row.cells)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              child: _Runs(cell,
                                  style: row.isHeader
                                      ? text.bodyMedium?.copyWith(fontWeight: FontWeight.w700)
                                      : text.bodyMedium),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            PostRule() => const Divider(),
          },
      ],
    );
  }
}

/// Styled runs of text; linked runs open in the browser or the mail / phone
/// app.
class _Runs extends StatefulWidget {
  const _Runs(this.runs, {this.style, this.align = TextAlign.start});

  final List<PostRun> runs;
  final TextStyle? style;
  final TextAlign align;

  @override
  State<_Runs> createState() => _RunsState();
}

class _RunsState extends State<_Runs> {
  final _taps = <TapGestureRecognizer>[];

  @override
  void dispose() {
    _clear();
    super.dispose();
  }

  void _clear() {
    for (final tap in _taps) {
      tap.dispose();
    }
    _taps.clear();
  }

  TapGestureRecognizer _open(String link) {
    final tap = TapGestureRecognizer()
      ..onTap = () => launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    _taps.add(tap);
    return tap;
  }

  @override
  Widget build(BuildContext context) {
    _clear();
    final linkColor = Theme.of(context).colorScheme.primary;
    return Text.rich(
      TextSpan(
        style: widget.style,
        children: [
          for (final run in widget.runs)
            TextSpan(
              text: run.text,
              recognizer: run.link == null ? null : _open(run.link!),
              style: TextStyle(
                fontWeight: run.bold ? FontWeight.w700 : null,
                fontStyle: run.italic ? FontStyle.italic : null,
                fontFamily: run.code ? 'monospace' : null,
                color: run.link != null ? linkColor : null,
                decoration: TextDecoration.combine([
                  if (run.strike) TextDecoration.lineThrough,
                  if (run.link != null) TextDecoration.underline,
                ]),
              ),
            ),
        ],
      ),
      textAlign: widget.align,
    );
  }
}
