import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../logic.dart' as logic;
import '../primitives.dart';
import '../style.dart';

class BdTextControl extends StatelessWidget {
  const BdTextControl(this.ctx, {super.key, this.email = false});

  final BdFieldContext ctx;
  final bool email;

  @override
  Widget build(BuildContext context) {
    final f = ctx.field;
    final token = email ? 'email' : BdFormRules.autocompleteToken(f);
    return BdTextInput(
      value: ctx.text,
      onChanged: ctx.setText,
      placeholder: f.placeholder.nonEmpty ?? (email ? 'you@example.com' : null),
      keyboard: email ? BdKeyboard.email : keyboardFor(token),
      autofillHint: autofillHintFor(token),
      isError: ctx.error != null,
      onCommit: ctx.commit,
      semanticLabel: f.label,
    );
  }
}

class BdTextAreaControl extends StatelessWidget {
  const BdTextAreaControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.textareaConfig;
    final rows = (cfg?.rows ?? 4).clamp(1, 40);
    return BdTextInput(
      value: ctx.text,
      onChanged: ctx.setText,
      placeholder: ctx.field.placeholder.nonEmpty,
      multiline: true,
      minLines: rows,
      maxLines: rows + (cfg?.resizable == true ? 12 : 4),
      isError: ctx.error != null,
      onCommit: ctx.commit,
      semanticLabel: ctx.field.label,
    );
  }
}

class BdPhoneControl extends StatelessWidget {
  const BdPhoneControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.phoneConfig;
    final intl = cfg?.international == true;
    return BdTextInput(
      value: ctx.text,
      onChanged: ctx.setText,
      transform: (s) => BdFormRules.formatPhone(s, intl),
      placeholder: ctx.field.placeholder.nonEmpty ?? (intl ? '+1 (555) 000-0000' : '(555) 000-0000'),
      keyboard: BdKeyboard.phone,
      autofillHint: autofillHintFor('tel'),
      leading: cfg?.showFlags == true ? const Text('🇺🇸') : null,
      isError: ctx.error != null,
      onCommit: ctx.commit,
      semanticLabel: ctx.field.label,
    );
  }
}

class BdUrlControl extends StatelessWidget {
  const BdUrlControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) => BdTextInput(
        value: ctx.value?['url']?.stringValue ?? '',
        onChanged: (t) => ctx.setKey('url', BdStr(t)),
        placeholder: ctx.field.placeholder.nonEmpty ?? 'https://example.com',
        keyboard: BdKeyboard.url,
        autofillHint: autofillHintFor('url'),
        isError: ctx.error != null,
        onCommit: ctx.commit,
        semanticLabel: ctx.field.label,
      );
}

// ── Numbers ──────────────────────────────────────────────────────────────

/// A number typed as text: keeps what the visitor typed ("1.", "-") while
/// the value stays a number, and filters out what the field doesn't allow.
class BdNumericInput extends StatefulWidget {
  const BdNumericInput({
    super.key,
    required this.value,
    required this.onChanged,
    this.allowDecimal = true,
    this.allowNegative = true,
    this.placeholder,
    this.leading,
    this.isError = false,
    this.onCommit,
    this.semanticLabel,
  });

  final double? value;
  final ValueChanged<double?> onChanged;
  final bool allowDecimal;
  final bool allowNegative;
  final String? placeholder;
  final Widget? leading;
  final bool isError;
  final VoidCallback? onCommit;
  final String? semanticLabel;

  @override
  State<BdNumericInput> createState() => _BdNumericInputState();
}

class _BdNumericInputState extends State<BdNumericInput> {
  late String _text = logic.formatNumber(widget.value);
  late double? _sent = widget.value;

  @override
  void didUpdateWidget(BdNumericInput old) {
    super.didUpdateWidget(old);
    // An outside change (a reset, a stepper) replaces the text; the echo
    // of what was typed ("1." is 1) leaves it alone.
    if (widget.value != _sent) {
      _sent = widget.value;
      if (logic.parseNumber(_text) != widget.value) _text = logic.formatNumber(widget.value);
    }
  }

  @override
  Widget build(BuildContext context) => BdTextInput(
        value: _text,
        onChanged: (clean) {
          _text = clean;
          final n = logic.parseNumber(clean);
          if (n != _sent) {
            _sent = n;
            widget.onChanged(n);
          }
        },
        transform: (s) => logic.sanitizeNumber(s, widget.allowDecimal, widget.allowNegative),
        keyboard: widget.allowDecimal ? BdKeyboard.decimal : BdKeyboard.integer,
        allowNegative: widget.allowNegative,
        placeholder: widget.placeholder,
        leading: widget.leading,
        isError: widget.isError,
        onCommit: widget.onCommit,
        textStyle: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]),
        semanticLabel: widget.semanticLabel,
      );
}

double _whole(double n) => n.truncateToDouble();

class BdNumberControl extends StatelessWidget {
  const BdNumberControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final f = ctx.field;
    final allowDecimal = f.allowDecimal != false;
    return BdNumericInput(
      value: ctx.value?.doubleValue,
      onChanged: (n) => ctx.set(n == null ? const BdNull() : BdNum(allowDecimal ? n : _whole(n))),
      allowDecimal: allowDecimal,
      allowNegative: f.allowNegative != false,
      placeholder: f.placeholder.nonEmpty,
      isError: ctx.error != null,
      onCommit: ctx.commit,
      semanticLabel: f.label,
    );
  }
}

class BdCurrencyControl extends StatelessWidget {
  const BdCurrencyControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.currencyConfig;
    final allowDecimal = cfg?.allowDecimal != false;
    return BdNumericInput(
      value: ctx.value?.doubleValue,
      onChanged: (n) => ctx.set(n == null ? const BdNull() : BdNum(allowDecimal ? n : _whole(n))),
      allowDecimal: allowDecimal,
      allowNegative: cfg?.allowNegative == true,
      placeholder: ctx.field.placeholder.nonEmpty ?? (allowDecimal ? '0.00' : '0'),
      leading: Text(cfg?.symbol.nonEmpty ?? r'$', style: TextStyle(color: BdColors.of(context).muted)),
      isError: ctx.error != null,
      onCommit: ctx.commit,
      semanticLabel: ctx.field.label,
    );
  }
}

class BdMeasurementControl extends StatelessWidget {
  const BdMeasurementControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.unitConfig;
    final cat = BdUnits.category(cfg?.category) ?? BdUnits.category('length');
    if (cat == null) return const SizedBox.shrink();
    final colors = BdColors.of(context);
    final scope = BdFormScope.of(context);
    final units = (cfg?.units?.isNotEmpty ?? false) ? cfg!.units! : [for (final u in cat.units) u.symbol];
    final unit = ctx.value?['unit']?.stringValue ?? cfg?.defaultUnit ?? (units.isEmpty ? cat.baseUnit : units.first);
    final number = ctx.value?['value']?.doubleValue;
    final allowDecimal = cfg?.allowDecimal != false;

    void emit(double? n, String u) {
      final o = <String, BdJson>{'unit': BdStr(u), 'baseUnit': BdStr(cat.baseUnit)};
      if (n != null) {
        o['value'] = BdNum(n);
        final base = BdUnits.convertToBase(n, u, cat);
        if (base != null) o['base'] = BdNum(base);
      } else {
        o['value'] = const BdStr('');
      }
      ctx.set(BdObj(o));
    }

    final Widget unitControl;
    if (cfg?.mode == 'fixed') {
      unitControl = Text(unit, style: TextStyle(color: colors.muted));
    } else if (scope.cupertino) {
      unitControl = CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        onPressed: () => bdShowSheet<void>(
          context,
          (_) => BdOptionSheet(
            title: ctx.field.label,
            options: [for (final u in units) BdOption(u, u)],
            selection: [unit],
            onSelect: (picked) {
              if (picked.isNotEmpty) emit(number, picked.first);
            },
            multi: false,
            allowCustom: false,
            search: false,
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, spacing: 2, children: [Text(unit), const Icon(CupertinoIcons.chevron_down, size: 14)]),
      );
    } else {
      unitControl = MenuAnchor(
        menuChildren: [for (final u in units) MenuItemButton(onPressed: () => emit(number, u), child: Text(u))],
        builder: (context, menu, _) => TextButton(
          onPressed: () => menu.isOpen ? menu.close() : menu.open(),
          child: Row(mainAxisSize: MainAxisSize.min, children: [Text(unit), const Icon(Icons.arrow_drop_down)]),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 6,
      children: [
        Row(
          spacing: 8,
          children: [
            Expanded(
              child: BdNumericInput(
                value: number,
                onChanged: (n) => emit(n == null ? null : (allowDecimal ? n : _whole(n)), unit),
                allowDecimal: allowDecimal,
                allowNegative: cat.isAffine,
                placeholder: ctx.field.placeholder.nonEmpty ?? '0',
                isError: ctx.error != null,
                onCommit: ctx.commit,
                semanticLabel: ctx.field.label,
              ),
            ),
            unitControl,
          ],
        ),
        if (number != null)
          Text(
            '≈ ${BdUnits.format(number, unit, cat)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.muted),
          ),
      ],
    );
  }
}

// ── Name & address ───────────────────────────────────────────────────────

/// One part of an object-valued field (first name, city…), with a label.
class _PartField extends StatelessWidget {
  const _PartField(
    this.ctx,
    this.partKey,
    this.label, {
    this.keyboard = BdKeyboard.words,
    this.placeholder,
    this.filter,
    this.hint,
  });

  final BdFieldContext ctx;
  final String partKey;
  final String label;
  final BdKeyboard keyboard;
  final String? placeholder;
  final String Function(String)? filter;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final v = ctx.value?[partKey];
    final text = v?.stringValue ?? v?.arrayValue?.map((e) => e.stringValue).whereType<String>().join(', ') ?? '';
    return BdTextInput(
      value: text,
      onChanged: (t) => ctx.setKey(partKey, BdStr(t)),
      transform: filter,
      label: label,
      placeholder: placeholder,
      keyboard: keyboard,
      autofillHint: hint,
      isError: ctx.error != null,
      onCommit: ctx.commit,
    );
  }
}

class BdNameControl extends StatelessWidget {
  const BdNameControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final cfg = ctx.field.nameConfig;
    final off = ctx.field.autocomplete == 'off';
    final kb = off ? BdKeyboard.text : BdKeyboard.words;
    String? hint(String token) => off ? null : autofillHintFor(token);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        if (cfg?.prefix == true)
          _PartField(ctx, 'prefix', strings.namePrefix, keyboard: kb, placeholder: 'Dr.', hint: hint('honorific-prefix')),
        _PartField(ctx, 'first', strings.firstName, keyboard: kb, placeholder: 'Jane', hint: hint('given-name')),
        if (cfg?.middle == true)
          _PartField(ctx, 'middle', strings.middleName, keyboard: kb, placeholder: 'Quinn', hint: hint('additional-name')),
        _PartField(ctx, 'last', strings.lastName, keyboard: kb, placeholder: 'Doe', hint: hint('family-name')),
        if (cfg?.suffix == true)
          _PartField(ctx, 'suffix', strings.nameSuffix, keyboard: kb, placeholder: 'Jr.', hint: hint('honorific-suffix')),
        if (cfg?.nicknames == true)
          _PartField(ctx, 'nicknames', strings.nicknames, keyboard: kb, placeholder: strings.nicknamesPlaceholder),
      ],
    );
  }
}

final _zipChars = RegExp(r'[^0-9-]');

class BdAddressControl extends StatelessWidget {
  const BdAddressControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        _PartField(ctx, 'line1', strings.addressLine1, hint: autofillHintFor('address-line1')),
        _PartField(ctx, 'line2', strings.addressLine2, hint: autofillHintFor('address-line2')),
        _PartField(ctx, 'city', strings.city, hint: autofillHintFor('address-level2')),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          spacing: 8,
          children: [
            Expanded(
              flex: 14,
              child: BdOptionPicker(
                title: strings.state,
                placeholder: strings.selectState,
                options: [for (final s in BdFormRules.usStates) BdOption(s.abbr, s.name)],
                selection: [?ctx.value?['state']?.stringValue.nonEmpty],
                onSelect: (picked) {
                  ctx.setKey('state', BdStr(picked.isEmpty ? '' : picked.first));
                  ctx.commit();
                },
                multi: false,
                label: strings.state,
                isError: ctx.error != null,
              ),
            ),
            Expanded(
              flex: 10,
              child: _PartField(
                ctx,
                'zip',
                strings.zip,
                keyboard: BdKeyboard.integer,
                placeholder: '90210',
                filter: (s) => s.replaceAll(_zipChars, ''),
                hint: autofillHintFor('postal-code'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Tags ─────────────────────────────────────────────────────────────────

class BdTagsControl extends StatefulWidget {
  const BdTagsControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdTagsControl> createState() => _BdTagsControlState();
}

class _BdTagsControlState extends State<BdTagsControl> {
  var _draft = '';
  // Bumped to clear the entry box after a tag is added.
  var _generation = 0;

  List<String> get _tags => widget.ctx.value?.stringArray ?? const [];

  void _add(String text) {
    final parts = [for (final p in text.split(',')) BdJS.trim(p)].where((p) => p.isNotEmpty).toList();
    setState(() {
      _draft = '';
      _generation++;
    });
    if (parts.isEmpty) return;
    final next = List.of(_tags);
    for (final p in parts) {
      if (!next.contains(p)) next.add(p);
    }
    widget.ctx.set(BdArr([for (final t in next) BdStr(t)]));
  }

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final ctx = widget.ctx;
    final tags = _tags;
    final colors = BdColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        BdTextInput(
          key: ValueKey(_generation),
          value: _draft,
          onChanged: (t) {
            if (t.endsWith(',')) {
              _add(t);
            } else {
              _draft = t;
            }
          },
          placeholder: ctx.field.placeholder.nonEmpty ?? strings.addTag,
          isError: ctx.error != null,
          textInputAction: TextInputAction.done,
          onSubmitted: (t) {
            _add(t);
            ctx.commit();
          },
          onCommit: () {
            if (_draft.trim().isNotEmpty) _add(_draft);
            ctx.commit();
          },
          semanticLabel: ctx.field.label,
        ),
        if (tags.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final tag in tags)
                if (scope.cupertino)
                  Semantics(
                    button: true,
                    label: strings.format(strings.removeTag, [tag]),
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: () => ctx.set(BdArr([for (final t in tags) if (t != tag) BdStr(t)])),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(12, 6, 8, 6),
                        decoration: BoxDecoration(color: colors.fill, borderRadius: BorderRadius.circular(16)),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          spacing: 4,
                          children: [Text(tag), Icon(CupertinoIcons.xmark, size: 14, color: colors.muted)],
                        ),
                      ),
                    ),
                  )
                else
                  InputChip(
                    label: Text(tag),
                    onDeleted: () => ctx.set(BdArr([for (final t in tags) if (t != tag) BdStr(t)])),
                    deleteButtonTooltipMessage: strings.format(strings.removeTag, [tag]),
                  ),
            ],
          ),
      ],
    );
  }
}
