import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../icons.dart';
import '../logic.dart' as logic;
import '../primitives.dart';
import '../style.dart';

/// Whether the author's allowed types let photos through.
bool _acceptsImages(List<String>? allowed) {
  if (allowed == null || allowed.isEmpty) return true;
  return BdFormRules.expandAllowedTypes(allowed).any((raw) {
    final a = raw.trim().toLowerCase();
    return a == '*/*' ||
        a.startsWith('image/') ||
        const ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'].contains(a);
  });
}

// ── Files ────────────────────────────────────────────────────────────────

class BdFileControl extends StatelessWidget {
  const BdFileControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final cfg = ctx.field.fileConfig;
    final files = ctx.value?.arrayValue ?? const <BdJson>[];
    final maxFiles = (cfg?.maxFiles ?? 1) < 1 ? 1 : cfg!.maxFiles!;
    final remaining = (maxFiles - files.length).clamp(0, maxFiles);
    final pick = scope.pickFiles;

    Future<void> choose(String kind) async {
      if (pick == null) return;
      final picked = await pick(
        BdFileRequest(kind: kind, multiple: remaining > 1, allowedTypes: cfg?.allowedTypes ?? const []),
      );
      if (picked.isEmpty) return;
      ctx.controller.addFiles(picked.take(remaining).toList(), ctx.path);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        for (var i = 0; i < files.length; i++) _FileRow(ctx, files[i], i),
        if (remaining > 0 && pick == null)
          Text(strings.filePickerMissing, style: TextStyle(color: BdColors.of(context).muted))
        else if (remaining > 0)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              BdButton(
                label: strings.chooseFiles,
                icon: BdGlyph(BdGlyphs.file, size: 18, color: scope.cupertino ? BdColors.of(context).primary : null),
                onPressed: () => choose('files'),
              ),
              if (_acceptsImages(cfg?.allowedTypes))
                BdButton(
                  label: strings.choosePhotos,
                  icon: BdGlyph(BdGlyphs.image, size: 18, color: scope.cupertino ? BdColors.of(context).primary : null),
                  onPressed: () => choose('images'),
                ),
            ],
          ),
      ],
    );
  }
}

class _FileRow extends StatelessWidget {
  const _FileRow(this.ctx, this.file, this.index);

  final BdFieldContext ctx;
  final BdJson file;
  final int index;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final pending = BdFormRules.isPendingUpload(file);
    final name = file['name']?.stringValue ?? 'File';
    final size = logic.formatBytes(file['size']?.doubleValue);
    final local = ctx.controller.pendingFile(file);
    final detail = [?size, if (pending) strings.uploadsOnSubmit].join(' · ');
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: colors.fill, borderRadius: BorderRadius.circular(scope.style.cornerRadius)),
      child: Row(
        spacing: 12,
        children: [
          if (local != null && local.mimeType.startsWith('image/'))
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.memory(local.data, width: 40, height: 40, fit: BoxFit.cover, cacheWidth: 120),
            )
          else
            SizedBox.square(dimension: 40, child: Center(child: BdGlyph(BdGlyphs.file, size: 24, color: colors.muted))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                if (detail.isNotEmpty)
                  Text(detail, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.muted)),
              ],
            ),
          ),
          IconButton(
            onPressed: () => ctx.controller.removeFile(index, ctx.path),
            tooltip: '${strings.removeFile} $name',
            icon: Icon(scope.cupertino ? CupertinoIcons.xmark : Icons.close),
          ),
        ],
      ),
    );
  }
}

// ── Image ────────────────────────────────────────────────────────────────

class BdImageInputControl extends StatefulWidget {
  const BdImageInputControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdImageInputControl> createState() => _BdImageInputControlState();
}

class _BdImageInputControlState extends State<BdImageInputControl> {
  var _chosen = 'upload';

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final cfg = ctx.field.imageInputConfig;
    final sources = cfg?.sources ?? 'both';
    final mode = switch (sources) {
      'url' => 'url',
      'upload' => 'upload',
      _ => _chosen,
    };
    final value = ctx.value;
    final pending = BdFormRules.isPendingUpload(value) ? ctx.controller.pendingFile(value) : null;
    final url = BdFormRules.safeHttpUrl(value?.stringValue);
    final pick = scope.pickFiles;

    Future<void> choose() async {
      if (pick == null) return;
      final picked = await pick(
        BdFileRequest(kind: 'images', multiple: false, allowedTypes: cfg?.allowedTypes ?? const ['image/*']),
      );
      if (picked.isNotEmpty) ctx.controller.setImage(picked.first, ctx.path);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        if (sources == 'both')
          BdSegmented(
            segments: {'upload': strings.upload, 'url': strings.pasteURL},
            selected: mode,
            onChanged: (m) => setState(() => _chosen = m),
          ),
        if (mode == 'upload')
          if (pick == null)
            Text(strings.filePickerMissing, style: TextStyle(color: colors.muted))
          else
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: BdButton(
                label: strings.choosePhotos,
                icon: BdGlyph(BdGlyphs.image, size: 18, color: scope.cupertino ? colors.primary : null),
                onPressed: choose,
              ),
            )
        else
          BdTextInput(
            value: pending == null ? (value?.stringValue ?? '') : '',
            onChanged: ctx.setText,
            placeholder: ctx.field.placeholder.nonEmpty ?? 'https://example.com/image.png',
            keyboard: BdKeyboard.url,
            isError: ctx.error != null,
            onCommit: ctx.commit,
            semanticLabel: ctx.field.label,
          ),
        if (cfg?.showPreview != false && (pending != null || url != null))
          ClipRRect(
            borderRadius: BorderRadius.circular(scope.style.cornerRadius),
            child: SizedBox(
              height: 180,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (pending != null)
                    Image.memory(pending.data, fit: BoxFit.cover, cacheWidth: 900)
                  else
                    BdRemoteImage(url!, height: 180),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Material(
                      color: Colors.black.withValues(alpha: 0.5),
                      shape: const CircleBorder(),
                      child: IconButton(
                        onPressed: () => ctx.setText(''),
                        tooltip: strings.clear,
                        icon: const Icon(Icons.close, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (pending != null)
          Text(
            '${pending.name} — ${strings.uploadsOnSubmit.toLowerCase()}.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.muted),
          ),
      ],
    );
  }
}

// ── Card ─────────────────────────────────────────────────────────────────

class BdCardControl extends StatefulWidget {
  const BdCardControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdCardControl> createState() => _BdCardControlState();
}

class _BdCardControlState extends State<BdCardControl> {
  var _busy = false;

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final pc = ctx.field.paymentConfig;
    final deposit = pc?.mode == 'deposit';
    final cents = pc?.amountCents;
    final amount =
        deposit && cents != null ? '${BdJS.toFixed(cents / 100, 2)} ${(pc?.currency ?? 'usd').toUpperCase()}' : null;
    final saved = (ctx.value?.stringValue ?? '').isNotEmpty;
    const green = Color(0xFF2E7D32);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 10,
      children: [
        Row(
          spacing: 10,
          children: [
            BdGlyph(BdGlyphs.card, size: 22, color: colors.primary),
            Expanded(
              child: Text(
                deposit ? strings.deposit + (amount == null ? '' : ' · $amount') : strings.cardOnFile,
                style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
              ),
            ),
            if (saved) ...[
              Icon(scope.cupertino ? CupertinoIcons.check_mark_circled_solid : Icons.check_circle, size: 18, color: green),
              Text(strings.cardSaved, style: theme.textTheme.bodyMedium?.copyWith(color: green)),
            ],
          ],
        ),
        if (pc?.description.nonEmpty case final d?) Text(d, style: theme.textTheme.bodyMedium?.copyWith(color: colors.muted)),
        BdButton(
          label: pc?.buttonLabel.nonEmpty ?? strings.addCard,
          busy: _busy,
          onPressed: _busy
              ? null
              : () async {
                  setState(() => _busy = true);
                  try {
                    await ctx.controller.collectPayment(ctx.path);
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
        ),
      ],
    );
  }
}

// ── Rich text ────────────────────────────────────────────────────────────

/// Rich text, stored as the HTML BD keeps (`p strong em s ul ol li`).
///
/// Flutter has no rich text editor, so formatting is light markup the
/// toolbar writes and the field draws: `**bold**`, `*italic*`, `~~struck~~`,
/// and `• ` / `1. ` lines for lists.
class BdRichTextControl extends StatefulWidget {
  const BdRichTextControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdRichTextControl> createState() => _BdRichTextControlState();
}

class _BdRichTextControlState extends State<BdRichTextControl> {
  late final _MarkupController _text = _MarkupController(logic.htmlToMarkup(widget.ctx.text));
  final _focus = FocusNode();
  late String _emitted = widget.ctx.text;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) widget.ctx.commit();
    });
  }

  @override
  void didUpdateWidget(BdRichTextControl old) {
    super.didUpdateWidget(old);
    final html = widget.ctx.text;
    if (html != _emitted) {
      _emitted = html;
      final text = logic.htmlToMarkup(html);
      _text.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
    }
  }

  @override
  void dispose() {
    _focus.dispose();
    _text.dispose();
    super.dispose();
  }

  void _changed(String text) {
    final out = logic.markupToHtml(text);
    if (out == _emitted) return;
    _emitted = out;
    widget.ctx.setText(out);
  }

  void _apply(logic.BdTextState Function(logic.BdTextState) edit) {
    final sel = _text.selection;
    final len = _text.text.length;
    final start = sel.isValid ? sel.start.clamp(0, len) : len;
    final end = sel.isValid ? sel.end.clamp(0, len) : len;
    final next = edit((text: _text.text, start: start, end: end));
    _text.value = TextEditingValue(text: next.text, selection: TextSelection(baseOffset: next.start, extentOffset: next.end));
    _changed(next.text);
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    _text.markerColor = colors.outline;
    final minHeight = ctx.field.richTextConfig?.minHeight ?? 140;
    final error = ctx.error != null;

    Widget tool(String label, String description, VoidCallback onTap, {TextStyle? style}) => Semantics(
          button: true,
          label: description,
          excludeSemantics: true,
          child: Tooltip(
            message: description,
            child: Material(
              color: colors.fill,
              borderRadius: BorderRadius.circular(8),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: onTap,
                child: SizedBox.square(dimension: 40, child: Center(child: Text(label, style: style))),
              ),
            ),
          ),
        );

    final field = scope.cupertino
        ? CupertinoTextField(
            controller: _text,
            focusNode: _focus,
            minLines: (minHeight / 24).ceil(),
            maxLines: null,
            keyboardType: TextInputType.multiline,
            textCapitalization: TextCapitalization.sentences,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.field,
              borderRadius: BorderRadius.circular(10),
              border: error ? Border.all(color: colors.error, width: 1.5) : null,
            ),
            onChanged: _changed,
          )
        : ConstrainedBox(
            constraints: BoxConstraints(minHeight: minHeight),
            child: TextField(
              controller: _text,
              focusNode: _focus,
              minLines: (minHeight / 24).ceil(),
              maxLines: null,
              keyboardType: TextInputType.multiline,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                border: const OutlineInputBorder(),
                enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: error ? colors.error : colors.outline)),
              ),
              onChanged: _changed,
            ),
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Row(
          spacing: 4,
          children: [
            tool('B', strings.bold, () => _apply((v) => logic.wrapSelection(v, '**')),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            tool('I', strings.italic, () => _apply((v) => logic.wrapSelection(v, '*')),
                style: const TextStyle(fontStyle: FontStyle.italic)),
            tool('S', strings.strikethrough, () => _apply((v) => logic.wrapSelection(v, '~~')),
                style: const TextStyle(decoration: TextDecoration.lineThrough)),
            Container(width: 1, height: 24, margin: const EdgeInsets.symmetric(horizontal: 4), color: colors.outlineVariant),
            tool('•', strings.bulletList, () => _apply((v) => logic.toggleListLine(v, false))),
            tool('1.', strings.numberedList, () => _apply((v) => logic.toggleListLine(v, true))),
          ],
        ),
        Semantics(label: ctx.field.label, child: field),
      ],
    );
  }
}

/// Draws the markup as it will read: bold, italic and struck runs styled,
/// their markers dimmed.
class _MarkupController extends TextEditingController {
  _MarkupController(String text) : super(text: text);

  Color markerColor = const Color(0xFF888888);

  static final _runs = <(RegExp, TextStyle)>[
    (RegExp(r'\*\*(\S(?:.*?\S)?)\*\*'), const TextStyle(fontWeight: FontWeight.bold)),
    (RegExp(r'(?<![*\w])\*([^\s*](?:.*?[^\s*])?)\*(?![*\w])'), const TextStyle(fontStyle: FontStyle.italic)),
    (RegExp(r'~~(\S(?:.*?\S)?)~~'), const TextStyle(decoration: TextDecoration.lineThrough)),
  ];

  @override
  TextSpan buildTextSpan({required BuildContext context, TextStyle? style, required bool withComposing}) {
    final text = this.text;
    if (text.isEmpty || (withComposing && value.isComposingRangeValid)) {
      return super.buildTextSpan(context: context, style: style, withComposing: withComposing);
    }
    // Per character: the styles that apply, and whether it's a marker.
    final styles = List<TextStyle?>.filled(text.length, null);
    final marker = List<bool>.filled(text.length, false);
    for (final (re, s) in _runs) {
      for (final m in re.allMatches(text)) {
        final inner = m.group(1)!;
        final innerStart = text.indexOf(inner, m.start);
        for (var i = m.start; i < m.end; i++) {
          if (i >= innerStart && i < innerStart + inner.length) {
            styles[i] = (styles[i] ?? const TextStyle()).merge(s);
          } else {
            marker[i] = true;
          }
        }
      }
    }
    final spans = <TextSpan>[];
    var start = 0;
    for (var i = 1; i <= text.length; i++) {
      if (i == text.length || styles[i] != styles[start] || marker[i] != marker[start]) {
        var s = styles[start] ?? const TextStyle();
        if (marker[start]) s = s.copyWith(color: markerColor);
        spans.add(TextSpan(text: text.substring(start, i), style: s));
        start = i;
      }
    }
    return TextSpan(style: style, children: spans);
  }
}
