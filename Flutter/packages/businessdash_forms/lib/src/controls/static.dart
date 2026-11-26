import 'package:businessdash_sdk/forms.dart';
import 'package:flutter/gestures.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../icons.dart';
import '../logic.dart' as logic;
import '../primitives.dart';
import '../style.dart';

/// Display-only elements: headings, copy, lists, tables, images.
class BdStaticContent extends StatelessWidget {
  const BdStaticContent(this.field, {super.key});

  final BdFormField field;

  @override
  Widget build(BuildContext context) {
    final type = Theme.of(context).textTheme;
    switch (field.type) {
      case 'title':
        return Semantics(
          header: true,
          child: Text(field.label.isEmpty ? 'Untitled' : field.label,
              style: type.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
        );
      case 'subtitle':
        return Semantics(
            header: true,
            child: Text(field.label,
                style:
                    type.titleMedium?.copyWith(fontWeight: FontWeight.w600)));
      case 'separator':
        return Divider(height: 1, color: BdColors.of(context).outlineVariant);
      case 'richtext':
        final html = field.content.nonEmpty;
        return html == null ? const SizedBox.shrink() : BdHtmlText(html);
      case 'body_text':
        final text = field.content.nonEmpty;
        return text == null
            ? const SizedBox.shrink()
            : Text(text, style: type.bodyLarge);
      case 'bullet_list':
        return _BulletList(field.listConfig);
      case 'table':
        return _Table(field.tableConfig);
      case 'image':
        return _StaticImage(field.imageConfig);
    }
    return const SizedBox.shrink();
  }
}

/// Server-sanitized HTML drawn as native text, links included.
class BdHtmlText extends StatefulWidget {
  const BdHtmlText(this.html, {super.key});

  final String html;

  @override
  State<BdHtmlText> createState() => _BdHtmlTextState();
}

class _BdHtmlTextState extends State<BdHtmlText> {
  late List<logic.BdSpan> _spans = logic.htmlSpans(widget.html);
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void didUpdateWidget(BdHtmlText old) {
    super.didUpdateWidget(old);
    if (old.html != widget.html) _spans = logic.htmlSpans(widget.html);
  }

  void _clear() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _clear();
    final theme = Theme.of(context);
    final colors = BdColors.of(context);
    final open = BdFormScope.of(context).openLink;
    final base = theme.textTheme.bodyLarge ?? const TextStyle();
    TextStyle styleOf(logic.BdSpan s) {
      var st = const TextStyle();
      if (s.heading case final h?) {
        st = (switch (h) {
              1 => theme.textTheme.headlineSmall,
              2 => theme.textTheme.titleLarge,
              _ => theme.textTheme.titleMedium,
            } ??
            st);
      }
      return st.copyWith(
        fontWeight: s.bold ? FontWeight.bold : null,
        fontStyle: s.italic ? FontStyle.italic : null,
        fontFamily: s.code ? 'monospace' : null,
        color:
            s.link != null ? colors.primary : (s.quote ? colors.muted : null),
        decoration: TextDecoration.combine([
          if (s.underline || s.link != null) TextDecoration.underline,
          if (s.strike) TextDecoration.lineThrough,
        ]),
      );
    }

    return Text.rich(
      TextSpan(
        style: base,
        children: [
          for (final s in _spans)
            TextSpan(
              text: s.text,
              style: styleOf(s),
              recognizer: s.link == null || open == null
                  ? null
                  : (TapGestureRecognizer()
                        ..onTap = () => open(Uri.parse(s.link!)))
                      .also(_recognizers.add),
            ),
        ],
      ),
    );
  }
}

extension<T> on T {
  T also(void Function(T) f) {
    f(this);
    return this;
  }
}

class _StaticImage extends StatelessWidget {
  const _StaticImage(this.cfg);

  final BdImageConfig? cfg;

  @override
  Widget build(BuildContext context) {
    final url = BdFormRules.safeHttpUrl(cfg?.src);
    if (url == null) return const SizedBox.shrink();
    final radius = BdFormScope.of(context).style.cornerRadius * 0.5;
    Widget image = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BdRemoteImage(url,
          height: cfg?.height,
          fit: BoxFit.contain,
          semanticLabel: cfg?.alt.nonEmpty),
    );
    if (cfg?.width case final w?) {
      image = ConstrainedBox(
          constraints: BoxConstraints(maxWidth: w), child: image);
    }
    return Center(child: image);
  }
}

class _BulletList extends StatelessWidget {
  const _BulletList(this.config);

  final BdListConfig? config;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = BdColors.of(context);
    final items = config?.items ?? const <BdListItem>[];
    final details = config?.variant == 'details';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        if (!details && config?.title.nonEmpty != null)
          Text(config!.title!, style: theme.textTheme.titleMedium),
        for (final item in items)
          if (details)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 12,
              children: [
                if (item.icon.nonEmpty case final icon?)
                  Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: BdIcon(icon, size: 20, color: colors.primary)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(item.text,
                          style: theme.textTheme.bodyLarge
                              ?.copyWith(fontWeight: FontWeight.w600)),
                      if (item.description.nonEmpty case final d?)
                        Text(d,
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(color: colors.muted)),
                    ],
                  ),
                ),
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 8,
              children: [
                Text('•', style: TextStyle(color: colors.muted)),
                Expanded(
                    child: Text(item.text, style: theme.textTheme.bodyLarge)),
              ],
            ),
      ],
    );
  }
}

/// Full width when it fits; scrolls sideways when it doesn't.
class _Table extends StatelessWidget {
  const _Table(this.config);

  final BdTableConfig? config;

  @override
  Widget build(BuildContext context) {
    final columns = config?.columns ?? const <BdTableColumn>[];
    if (columns.isEmpty) return const SizedBox.shrink();
    final rows = config?.rows ?? const <BdTableRow>[];
    final highlight = config?.highlightColumn;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final band = colors.primary.withValues(alpha: 0.12);

    Alignment align(String? a) => switch (a) {
          'center' => Alignment.center,
          'right' => Alignment.centerRight,
          _ => Alignment.centerLeft,
        };

    // No gaps between cells, so a highlighted column reads as one band.
    Widget cell(int ci, Widget child) => Container(
          color: ci == highlight ? band : null,
          alignment: align(columns[ci].align),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          child: child,
        );

    Widget body(String text, int ci) {
      final kind =
          columns[ci].type == 'check' ? logic.tableCheckState(text) : 'text';
      return switch (kind) {
        'yes' => Icon(Icons.check,
            size: 18, color: colors.primary, semanticLabel: 'Yes'),
        'no' => Semantics(
            label: 'No',
            excludeSemantics: true,
            child: Text('–', style: TextStyle(color: colors.muted))),
        _ => Text(text, style: theme.textTheme.bodyMedium),
      };
    }

    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: box.maxWidth),
          child: Table(
            defaultColumnWidth: const IntrinsicColumnWidth(flex: 1),
            defaultVerticalAlignment: TableCellVerticalAlignment.fill,
            border: TableBorder(
                horizontalInside: BorderSide.none, top: BorderSide.none),
            children: [
              TableRow(
                decoration: BoxDecoration(
                    border: Border(
                        bottom: BorderSide(color: colors.outlineVariant))),
                children: [
                  for (var ci = 0; ci < columns.length; ci++)
                    cell(
                        ci,
                        Text(columns[ci].header,
                            style: theme.textTheme.labelLarge)),
                ],
              ),
              for (final row in rows)
                TableRow(
                  children: [
                    for (var ci = 0; ci < columns.length; ci++)
                      cell(
                          ci,
                          body(
                              ci < (row.cells?.length ?? 0)
                                  ? row.cells![ci]
                                  : '',
                              ci)),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A live calculation result, read-only.
class BdCalculationView extends StatelessWidget {
  const BdCalculationView(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final cfg = ctx.field.calculationConfig;
    final value = ctx.value;
    final hasValue =
        !(value == null || value.isNull || value == const BdStr(''));
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
          color: colors.fill,
          borderRadius: BorderRadius.circular(scope.style.cornerRadius)),
      child: cfg?.sensitive == true && !hasValue
          ? Text(scope.strings.calculatedOnSubmit,
              style: TextStyle(color: colors.muted))
          : SelectableText(
              hasValue ? BdCalculation.format(value, cfg?.display) : '—',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
    );
  }
}
