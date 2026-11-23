import 'dart:math' as math;

import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'icons.dart';
import 'style.dart';

// ── Routes ───────────────────────────────────────────────────────────────

/// Material's words and date formats, where the app gives none (a
/// Cupertino app).
Widget bdLocalized(BuildContext context, Widget child) =>
    Localizations.of<MaterialLocalizations>(context, MaterialLocalizations) != null
        ? child
        : Localizations.override(context: context, delegates: const [DefaultMaterialLocalizations.delegate], child: child);

/// A sheet or dialog route sits above the form, outside its theme, scope
/// and localizations: carry them over.
Widget Function(BuildContext) _carried(BuildContext context, WidgetBuilder builder) {
  final theme = Theme.of(context);
  final scope = BdFormScope.of(context);
  return (route) => bdLocalized(route, Theme(data: theme, child: scope.over(Builder(builder: builder))));
}

/// A modal sheet from the bottom, in the platform's colors: Material's
/// bottom sheet, or the Cupertino popup on iOS (and under a Cupertino app,
/// whose routes can't host a Material sheet).
Future<T?> bdShowSheet<T>(BuildContext context, WidgetBuilder builder) {
  final cupertino = BdFormScope.of(context).cupertino;
  final routes = Navigator.of(context).context;
  final materialRoutes = Localizations.of<MaterialLocalizations>(routes, MaterialLocalizations) != null;
  if (!cupertino && materialRoutes) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: _carried(context, builder),
    );
  }
  return showCupertinoModalPopup<T>(
    context: context,
    builder: _carried(context, (context) => _PopupSheet(child: Builder(builder: builder))),
  );
}

class _PopupSheet extends StatelessWidget {
  const _PopupSheet({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final cupertino = BdFormScope.of(context).cupertino;
    final color = cupertino
        ? CupertinoColors.systemGroupedBackground.resolveFrom(context)
        : Theme.of(context).colorScheme.surfaceContainerLow;
    return Container(
      padding: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
      child: SafeArea(top: false, child: Material(type: MaterialType.transparency, child: child)),
    );
  }
}

/// A two-button confirmation. True when the visitor chose [confirm].
Future<bool> bdConfirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirm,
  required String cancel,
  bool destructive = false,
}) async {
  final cupertino = BdFormScope.of(context).cupertino;
  final ok = await showAdaptiveDialog<bool>(
    context: context,
    builder: _carried(context, (context) => cupertino
        ? CupertinoAlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              CupertinoDialogAction(onPressed: () => Navigator.pop(context, false), child: Text(cancel)),
              CupertinoDialogAction(
                isDestructiveAction: destructive,
                onPressed: () => Navigator.pop(context, true),
                child: Text(confirm),
              ),
            ],
          )
        : AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: Text(cancel)),
              TextButton(onPressed: () => Navigator.pop(context, true), child: Text(confirm)),
            ],
          )),
  );
  return ok == true;
}

/// A date: Material's calendar dialog, or the iOS wheel in a sheet.
Future<DateTime?> bdPickDate(BuildContext context, {DateTime? initial, DateTime? min}) async {
  final scope = BdFormScope.of(context);
  final first = min ?? DateTime(1900);
  final last = DateTime(2100, 12, 31);
  var start = initial ?? DateTime.now();
  if (start.isBefore(first)) start = first;
  if (scope.cupertino) {
    return _wheel(context, CupertinoDatePickerMode.date, start, first, last);
  }
  return showDatePicker(
    context: context,
    initialDate: start,
    firstDate: first,
    lastDate: last,
    builder: (route, child) => bdLocalized(route, child!),
  );
}

/// A time of day: Material's clock dialog, or the iOS wheel in a sheet.
Future<TimeOfDay?> bdPickTime(BuildContext context, {TimeOfDay? initial}) async {
  final scope = BdFormScope.of(context);
  final now = TimeOfDay.now();
  final start = initial ?? TimeOfDay(hour: now.hour, minute: 0);
  if (scope.cupertino) {
    final today = DateTime.now();
    final picked = await _wheel(
      context,
      CupertinoDatePickerMode.time,
      DateTime(today.year, today.month, today.day, start.hour, start.minute),
      null,
      null,
    );
    return picked == null ? null : TimeOfDay.fromDateTime(picked);
  }
  return showTimePicker(context: context, initialTime: start, builder: (route, child) => bdLocalized(route, child!));
}

Future<DateTime?> _wheel(
  BuildContext context,
  CupertinoDatePickerMode mode,
  DateTime initial,
  DateTime? min,
  DateTime? max,
) {
  final strings = BdFormScope.of(context).strings;
  var chosen = initial;
  return showCupertinoModalPopup<DateTime>(
    context: context,
    builder: _carried(
      context,
      (context) => Container(
        height: 300,
        color: CupertinoColors.systemBackground.resolveFrom(context),
        child: SafeArea(
          top: false,
          child: Column(
            children: [
              Row(
                children: [
                  CupertinoButton(onPressed: () => Navigator.pop(context), child: Text(strings.cancel)),
                  const Spacer(),
                  CupertinoButton(
                    onPressed: () => Navigator.pop(context, chosen),
                    child: Text(strings.done, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: mode,
                  initialDateTime: initial,
                  minimumDate: min,
                  maximumDate: max,
                  use24hFormat: MediaQuery.alwaysUse24HourFormatOf(context),
                  onDateTimeChanged: (d) => chosen = d,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// ── Keyboards ────────────────────────────────────────────────────────────

enum BdKeyboard { text, words, email, phone, url, decimal, integer }

/// The keyboard for a field's autofill token (HTML `autocomplete` vocabulary).
BdKeyboard keyboardFor(String? token) => switch (token) {
      'email' => BdKeyboard.email,
      'tel' || 'tel-national' => BdKeyboard.phone,
      'url' => BdKeyboard.url,
      'one-time-code' => BdKeyboard.integer,
      'name' ||
      'given-name' ||
      'additional-name' ||
      'family-name' ||
      'nickname' ||
      'honorific-prefix' ||
      'honorific-suffix' ||
      'organization' ||
      'organization-title' ||
      'street-address' ||
      'address-line1' ||
      'address-line2' ||
      'address-level1' ||
      'address-level2' ||
      'country-name' =>
        BdKeyboard.words,
      _ => BdKeyboard.text,
    };

/// The platform autofill hint for an HTML `autocomplete` token.
String? autofillHintFor(String? token) => switch (token) {
      'email' => AutofillHints.email,
      'tel' || 'tel-national' => AutofillHints.telephoneNumber,
      'url' => AutofillHints.url,
      'one-time-code' => AutofillHints.oneTimeCode,
      'name' => AutofillHints.name,
      'given-name' => AutofillHints.givenName,
      'additional-name' => AutofillHints.middleName,
      'family-name' => AutofillHints.familyName,
      'nickname' => AutofillHints.nickname,
      'honorific-prefix' => AutofillHints.namePrefix,
      'honorific-suffix' => AutofillHints.nameSuffix,
      'organization' => AutofillHints.organizationName,
      'organization-title' => AutofillHints.jobTitle,
      'street-address' => AutofillHints.fullStreetAddress,
      'address-line1' => AutofillHints.streetAddressLine1,
      'address-line2' => AutofillHints.streetAddressLine2,
      'address-level1' => AutofillHints.addressState,
      'address-level2' => AutofillHints.addressCity,
      'postal-code' => AutofillHints.postalCode,
      'country-name' => AutofillHints.countryName,
      _ => null,
    };

TextInputType _inputType(BdKeyboard k, bool multiline, bool allowNegative) => switch (k) {
      _ when multiline => TextInputType.multiline,
      BdKeyboard.text => TextInputType.text,
      BdKeyboard.words => TextInputType.name,
      BdKeyboard.email => TextInputType.emailAddress,
      BdKeyboard.phone => TextInputType.phone,
      BdKeyboard.url => TextInputType.url,
      BdKeyboard.decimal => TextInputType.numberWithOptions(decimal: true, signed: allowNegative),
      BdKeyboard.integer => TextInputType.numberWithOptions(signed: allowNegative),
    };

TextCapitalization _capitalization(BdKeyboard k) => switch (k) {
      BdKeyboard.text => TextCapitalization.sentences,
      BdKeyboard.words => TextCapitalization.words,
      _ => TextCapitalization.none,
    };

bool _autocorrect(BdKeyboard k) => k == BdKeyboard.text;

// ── Text ─────────────────────────────────────────────────────────────────

/// A text field that keeps what the visitor is typing as its own state and
/// writes it through, so a keystroke never waits on the form's state to
/// come back round. Adopts the value when it changes from outside (a reset,
/// a prefill). Reports when the visitor leaves it.
class BdTextInput extends StatefulWidget {
  const BdTextInput({
    super.key,
    required this.value,
    required this.onChanged,
    this.label,
    this.placeholder,
    this.keyboard = BdKeyboard.text,
    this.multiline = false,
    this.minLines = 1,
    this.maxLines,
    this.isError = false,
    this.transform,
    this.leading,
    this.trailing,
    this.autofillHint,
    this.allowNegative = true,
    this.textStyle,
    this.onCommit,
    this.onSubmitted,
    this.textInputAction,
    this.semanticLabel,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final String? label;
  final String? placeholder;
  final BdKeyboard keyboard;
  final bool multiline;
  final int minLines;
  final int? maxLines;
  final bool isError;

  /// Rewrites what was typed (filtering, phone formatting); the caret moves
  /// to the end when it changes the text.
  final String Function(String)? transform;
  final Widget? leading;
  final Widget? trailing;
  final String? autofillHint;
  final bool allowNegative;
  final TextStyle? textStyle;
  final VoidCallback? onCommit;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final String? semanticLabel;

  @override
  State<BdTextInput> createState() => _BdTextInputState();
}

class _BdTextInputState extends State<BdTextInput> {
  late final TextEditingController _text = TextEditingController(text: widget.value);
  final _focus = FocusNode();
  late String _pushed = widget.value;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_focusChanged);
  }

  void _focusChanged() {
    if (!_focus.hasFocus) widget.onCommit?.call();
  }

  @override
  void didUpdateWidget(BdTextInput old) {
    super.didUpdateWidget(old);
    // A value set from outside (a prefill, a reset, a removed repeater
    // entry). Typing the form hasn't seen yet is never undone: `value` is
    // either what this field last pushed or a real outside change.
    if (widget.value != _pushed) {
      _pushed = widget.value;
      if (widget.value != _text.text) {
        _text.value = TextEditingValue(
          text: widget.value,
          selection: TextSelection.collapsed(offset: widget.value.length),
        );
      }
    }
  }

  @override
  void dispose() {
    _focus.removeListener(_focusChanged);
    _focus.dispose();
    _text.dispose();
    super.dispose();
  }

  void _changed(String text) {
    if (text == _pushed) return;
    _pushed = text;
    widget.onChanged(text);
  }

  List<TextInputFormatter> get _formatters {
    final transform = widget.transform;
    if (transform == null) return const [];
    return [
      TextInputFormatter.withFunction((old, next) {
        final t = transform(next.text);
        if (t == next.text) return next;
        return TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));
      }),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final k = widget.keyboard;
    final multiline = widget.multiline;
    final maxLines = multiline ? (widget.maxLines ?? math.max(widget.minLines, 1) + 4) : 1;
    final action = widget.textInputAction ?? (multiline ? TextInputAction.newline : TextInputAction.next);
    final hints = widget.autofillHint == null ? null : [widget.autofillHint!];
    final type = _inputType(k, multiline, widget.allowNegative);
    final style = widget.textStyle;

    if (scope.cupertino) {
      final field = CupertinoTextField(
        controller: _text,
        focusNode: _focus,
        placeholder: widget.placeholder ?? (widget.label == null ? null : ''),
        prefix: widget.leading == null
            ? null
            : Padding(padding: const EdgeInsets.only(left: 12), child: widget.leading),
        suffix: widget.trailing == null
            ? null
            : Padding(padding: const EdgeInsets.only(right: 8), child: widget.trailing),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: colors.field,
          borderRadius: BorderRadius.circular(10),
          border: widget.isError ? Border.all(color: colors.error, width: 1.5) : null,
        ),
        style: style,
        keyboardType: type,
        textCapitalization: _capitalization(k),
        autocorrect: _autocorrect(k),
        enableSuggestions: _autocorrect(k),
        minLines: multiline ? widget.minLines : null,
        maxLines: maxLines,
        textInputAction: action,
        autofillHints: hints,
        inputFormatters: _formatters,
        onChanged: _changed,
        onSubmitted: widget.onSubmitted,
      );
      final labelled = widget.label == null
          ? field
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(widget.label!, style: TextStyle(fontSize: 13, color: colors.muted)),
                field,
              ],
            );
      return Semantics(label: widget.semanticLabel, textField: true, child: labelled);
    }

    OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: color, width: width),
        );
    return TextField(
      controller: _text,
      focusNode: _focus,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.placeholder,
        prefixIcon: widget.leading == null
            ? null
            : Padding(padding: const EdgeInsetsDirectional.only(start: 12, end: 8), child: widget.leading),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: widget.trailing,
        border: border(colors.outline),
        enabledBorder: widget.isError ? border(colors.error) : border(colors.outline),
        focusedBorder: border(widget.isError ? colors.error : colors.primary, 2),
        labelStyle: widget.isError ? TextStyle(color: colors.error) : null,
        alignLabelWithHint: multiline,
        semanticCounterText: widget.semanticLabel,
      ),
      style: style,
      keyboardType: type,
      textCapitalization: _capitalization(k),
      autocorrect: _autocorrect(k),
      enableSuggestions: _autocorrect(k),
      minLines: multiline ? widget.minLines : null,
      maxLines: maxLines,
      textInputAction: action,
      autofillHints: hints,
      inputFormatters: _formatters,
      onChanged: _changed,
      onSubmitted: widget.onSubmitted,
      onTapOutside: (_) => _focus.unfocus(),
    );
  }
}

/// A field that opens a picker (a sheet, a menu, a date dialog) instead of
/// taking typing. Looks like the text fields around it; reads to a screen
/// reader as one button with its value.
class BdPickerField extends StatelessWidget {
  const BdPickerField({
    super.key,
    required this.text,
    required this.placeholder,
    required this.onTap,
    this.label,
    this.description,
    this.isError = false,
    this.trailing,
    this.onClear,
  });

  final String text;
  final String? placeholder;
  final VoidCallback onTap;
  final String? label;
  final String? description;
  final bool isError;
  final Widget? trailing;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final strings = scope.strings;
    final empty = text.isEmpty;
    final clearable = onClear != null && !empty;
    final spoken = [description ?? label, empty ? placeholder : text].whereType<String>().join(', ');
    final theme = Theme.of(context);
    final icon = clearable
        ? IconButton(
            onPressed: onClear,
            tooltip: '${strings.clear} ${description ?? label ?? ''}'.trim(),
            icon: Icon(scope.cupertino ? CupertinoIcons.clear_circled_solid : Icons.close, size: 20),
            color: colors.muted,
          )
        : trailing ??
            Icon(
              scope.cupertino ? CupertinoIcons.chevron_up_chevron_down : Icons.arrow_drop_down,
              size: scope.cupertino ? 18 : 24,
              color: colors.muted,
            );
    final shown = Text(
      empty ? (placeholder ?? '') : text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: theme.textTheme.bodyLarge?.copyWith(color: empty ? colors.muted : colors.onSurface),
    );

    Widget box;
    if (scope.cupertino) {
      box = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 4,
        children: [
          if (label != null) Text(label!, style: TextStyle(fontSize: 13, color: colors.muted)),
          Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.only(left: 12, right: 4),
            decoration: BoxDecoration(
              color: colors.field,
              borderRadius: BorderRadius.circular(10),
              border: isError ? Border.all(color: colors.error, width: 1.5) : null,
            ),
            child: Row(
              children: [
                Expanded(child: shown),
                SizedBox(width: 40, height: 40, child: Center(child: icon)),
              ],
            ),
          ),
        ],
      );
    } else {
      box = InputDecorator(
        isEmpty: empty && label != null,
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: icon,
          border: const OutlineInputBorder(),
          enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: isError ? colors.error : colors.outline)),
          labelStyle: isError ? TextStyle(color: colors.error) : null,
        ),
        child: empty && label != null ? null : shown,
      );
    }
    return Semantics(
      button: true,
      label: spoken,
      excludeSemantics: !clearable,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(scope.cupertino ? 10 : 4),
          child: box,
        ),
      ),
    );
  }
}

// ── Options ──────────────────────────────────────────────────────────────

class BdOption {
  const BdOption(this.value, this.label, {this.image, this.icon, this.detail});

  final String value;
  final String label;
  final String? image;
  final String? icon;
  final String? detail;
}

/// The most options a dropdown menu shows; more open in a sheet.
const _menuMax = 12;

/// A single or multiple choice from a list: a dropdown menu for a short
/// single choice, a searchable sheet for a long list, many picks, or a
/// custom answer. On iOS, always a sheet.
class BdOptionPicker extends StatelessWidget {
  const BdOptionPicker({
    super.key,
    required this.title,
    required this.placeholder,
    required this.options,
    required this.selection,
    required this.onSelect,
    required this.multi,
    this.searchable,
    this.allowCustom = false,
    this.label,
    this.isError = false,
    this.startAt,
  });

  final String title;
  final String placeholder;
  final List<BdOption> options;
  final List<String> selection;
  final ValueChanged<List<String>> onSelect;
  final bool multi;
  final bool? searchable;
  final bool allowCustom;
  final String? label;
  final bool isError;
  final String? startAt;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final search = (searchable ?? BdFormRules.shouldSearch(options.length, null)) || allowCustom;
    final useSheet = scope.cupertino || multi || search || options.length > _menuMax;
    final summary = selection.map((v) {
      for (final o in options) {
        if (o.value == v) return o.label;
      }
      return v;
    }).join(', ');

    if (useSheet) {
      return BdPickerField(
        text: summary,
        placeholder: placeholder,
        label: label,
        description: title,
        isError: isError,
        trailing: scope.cupertino ? null : const Icon(Icons.keyboard_arrow_right),
        onTap: () => bdShowSheet<void>(
          context,
          (_) => BdOptionSheet(
            title: title,
            options: options,
            selection: selection,
            onSelect: onSelect,
            multi: multi,
            allowCustom: allowCustom,
            search: search,
            startAt: startAt,
          ),
        ),
      );
    }

    final colors = BdColors.of(context);
    return LayoutBuilder(
      builder: (context, box) => MenuAnchor(
        style: MenuStyle(
          minimumSize: WidgetStatePropertyAll(Size(box.maxWidth, 0)),
          maximumSize: WidgetStatePropertyAll(Size(box.maxWidth, 480)),
        ),
        menuChildren: [
          MenuItemButton(
            onPressed: () => onSelect(const []),
            child: Text(placeholder, style: TextStyle(color: colors.muted)),
          ),
          for (final o in options)
            MenuItemButton(
              onPressed: () => onSelect([o.value]),
              trailingIcon: selection.contains(o.value) ? const Icon(Icons.check) : null,
              child: BdOptionLabel(o),
            ),
        ],
        builder: (context, menu, _) => BdPickerField(
          text: summary,
          placeholder: placeholder,
          label: label,
          description: title,
          isError: isError,
          onTap: () => menu.isOpen ? menu.close() : menu.open(),
        ),
      ),
    );
  }
}

/// The sheet behind a [BdOptionPicker]: search, a custom answer, and the
/// list.
class BdOptionSheet extends StatefulWidget {
  const BdOptionSheet({
    super.key,
    required this.title,
    required this.options,
    required this.selection,
    required this.onSelect,
    required this.multi,
    required this.allowCustom,
    required this.search,
    this.startAt,
  });

  final String title;
  final List<BdOption> options;
  final List<String> selection;
  final ValueChanged<List<String>> onSelect;
  final bool multi;
  final bool allowCustom;
  final bool search;
  final String? startAt;

  @override
  State<BdOptionSheet> createState() => _BdOptionSheetState();
}

class _BdOptionSheetState extends State<BdOptionSheet> {
  late List<String> _selection = widget.selection;
  var _query = '';
  late final ScrollController _scroll;

  static const _rowHeight = 52.0;

  @override
  void initState() {
    super.initState();
    // Open on the answer, or on startAt, with a little of the list above it.
    final target = widget.selection.isNotEmpty ? widget.selection.first : widget.startAt;
    final index = widget.options.indexWhere((o) => o.value == target);
    _scroll = ScrollController(initialScrollOffset: math.max(0, index - 2) * _rowHeight);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _set(List<String> next) {
    setState(() => _selection = next);
    widget.onSelect(next);
  }

  void _choose(String value) {
    if (widget.multi) {
      _set(toggledList(_selection, value));
    } else {
      _set(_selection.length == 1 && _selection.first == value ? const [] : [value]);
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final q = BdJS.trim(_query);
    final ql = q.toLowerCase();
    final filtered = q.isEmpty
        ? widget.options
        : [
            for (final o in widget.options)
              if (o.label.toLowerCase().contains(ql) || o.value.toLowerCase().contains(ql)) o,
          ];
    final offerCustom = widget.allowCustom && q.isNotEmpty && !widget.options.any((o) => o.label.toLowerCase() == ql);
    final media = MediaQuery.of(context);

    final header = Padding(
      padding: EdgeInsets.fromLTRB(16, scope.cupertino ? 8 : 0, 8, 4),
      child: Row(
        children: [
          Expanded(child: Text(widget.title, style: theme.textTheme.titleMedium)),
          if (_selection.isNotEmpty) BdTextButton(label: strings.clear, onPressed: () => _set(const [])),
          BdTextButton(label: strings.done, bold: true, onPressed: () => Navigator.pop(context)),
        ],
      ),
    );
    final searchField = !widget.search
        ? null
        : Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: scope.cupertino
                ? CupertinoSearchTextField(placeholder: strings.search, onChanged: (t) => setState(() => _query = t))
                : TextField(
                    decoration: InputDecoration(
                      hintText: strings.search,
                      prefixIcon: const Icon(Icons.search),
                      border: const OutlineInputBorder(),
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.search,
                    onChanged: (t) => setState(() => _query = t),
                  ),
          );

    final list = ListView(
      controller: _scroll,
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
      children: [
        if (offerCustom)
          InkWell(
            onTap: () => _choose(q),
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: _rowHeight,
              child: Row(
                spacing: 12,
                children: [
                  const SizedBox(width: 4),
                  Icon(scope.cupertino ? CupertinoIcons.add : Icons.add, color: colors.primary),
                  Expanded(child: Text(strings.format(strings.useCustom, [q]))),
                ],
              ),
            ),
          ),
        for (final o in filtered)
          BdChoiceRow(
            selected: _selection.contains(o.value),
            multi: widget.multi,
            onTap: () => _choose(o.value),
            child: BdOptionLabel(o),
          ),
        if (filtered.isEmpty && !offerCustom)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(strings.noResults, style: TextStyle(color: colors.muted)),
          ),
      ],
    );

    final body = Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.85),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [header, ?searchField, Flexible(child: list)],
        ),
      ),
    );
    return body;
  }
}

/// Toggle [item] in a list of strings.
List<String> toggledList(List<String> list, String item) =>
    list.contains(item) ? [for (final x in list) if (x != item) x] : [...list, item];

/// One selectable row: a radio for one answer, a checkbox for many.
class BdChoiceRow extends StatelessWidget {
  const BdChoiceRow({super.key, required this.selected, required this.multi, required this.onTap, required this.child});

  final bool selected;
  final bool multi;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final Widget indicator;
    if (multi) {
      indicator = scope.cupertino
          ? CupertinoCheckbox(value: selected, onChanged: (_) => onTap(), activeColor: colors.primary)
          : Checkbox(value: selected, onChanged: (_) => onTap());
    } else {
      indicator = RadioGroup<bool>(
        groupValue: selected ? true : null,
        onChanged: (_) => onTap(),
        child: scope.cupertino ? CupertinoRadio<bool>(value: true, activeColor: colors.primary) : const Radio<bool>(value: true),
      );
    }
    return Semantics(
      button: true,
      checked: multi ? selected : null,
      selected: multi ? null : selected,
      inMutuallyExclusiveGroup: multi ? null : true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              spacing: 8,
              children: [ExcludeSemantics(child: indicator), Expanded(child: child)],
            ),
          ),
        ),
      ),
    );
  }
}

class BdOptionLabel extends StatelessWidget {
  const BdOptionLabel(this.option, {super.key});

  final BdOption option;

  @override
  Widget build(BuildContext context) {
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final image = BdFormRules.safeHttpUrl(option.image);
    return Row(
      spacing: 12,
      children: [
        if (image != null)
          ClipRRect(borderRadius: BorderRadius.circular(8), child: BdRemoteImage(image, width: 36, height: 36))
        else if (option.icon.nonEmpty case final icon?)
          BdIcon(icon, size: 20, color: colors.muted),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(option.label, style: theme.textTheme.bodyLarge),
              if (option.detail.nonEmpty case final detail?)
                Text(detail, style: theme.textTheme.bodySmall?.copyWith(color: colors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Switches, buttons, chips, spinners ───────────────────────────────────

/// A labelled on/off row.
class BdSwitchRow extends StatelessWidget {
  const BdSwitchRow({super.key, required this.label, required this.value, required this.onChanged});

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    return MergeSemantics(
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Row(
            children: [
              Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyLarge)),
              if (scope.cupertino)
                CupertinoSwitch(value: value, onChanged: onChanged, activeTrackColor: colors.primary)
              else
                Switch(value: value, onChanged: onChanged),
            ],
          ),
        ),
      ),
    );
  }
}

enum BdButtonKind { filled, tonal, outlined }

/// A button in the platform's style, with an optional icon and a spinner
/// while [busy].
class BdButton extends StatelessWidget {
  const BdButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.kind = BdButtonKind.outlined,
    this.icon,
    this.busy = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final BdButtonKind kind;
  final Widget? icon;
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final lead = busy ? const SizedBox.square(dimension: 18, child: BdSpinner(size: 18, onTint: true)) : icon;
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: 8,
      children: [?lead, Flexible(child: Text(label, overflow: TextOverflow.ellipsis))],
    );
    Widget button;
    if (scope.cupertino) {
      final colors = BdColors.of(context);
      button = switch (kind) {
        BdButtonKind.filled => CupertinoButton.filled(
            onPressed: onPressed,
            color: colors.primary,
            child: DefaultTextStyle.merge(style: TextStyle(color: colors.onPrimary), child: content),
          ),
        BdButtonKind.tonal => CupertinoButton.tinted(onPressed: onPressed, color: colors.primary, child: content),
        BdButtonKind.outlined => CupertinoButton.tinted(
            onPressed: onPressed,
            color: colors.primary,
            sizeStyle: CupertinoButtonSize.medium,
            child: content,
          ),
      };
    } else {
      const min = Size(64, 48);
      button = switch (kind) {
        BdButtonKind.filled => FilledButton(onPressed: onPressed, style: FilledButton.styleFrom(minimumSize: min), child: content),
        BdButtonKind.tonal =>
          FilledButton.tonal(onPressed: onPressed, style: FilledButton.styleFrom(minimumSize: min), child: content),
        BdButtonKind.outlined =>
          OutlinedButton(onPressed: onPressed, style: OutlinedButton.styleFrom(minimumSize: min), child: content),
      };
    }
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A borderless text button (sheet headers, "Clear", "View").
class BdTextButton extends StatelessWidget {
  const BdTextButton({super.key, required this.label, required this.onPressed, this.bold = false, this.compact = false});

  final String label;
  final VoidCallback? onPressed;
  final bool bold;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final style = bold ? const TextStyle(fontWeight: FontWeight.w600) : null;
    if (BdFormScope.of(context).cupertino) {
      return CupertinoButton(
        onPressed: onPressed,
        padding: compact ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 12),
        minimumSize: compact ? const Size(0, 32) : const Size(44, 44),
        child: Text(label, style: style),
      );
    }
    return TextButton(
      onPressed: onPressed,
      style: compact
          ? TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32), tapTargetSize: MaterialTapTargetSize.shrinkWrap)
          : null,
      child: Text(label, style: style),
    );
  }
}

/// A selectable pill (days, time windows, booking times).
class BdChip extends StatelessWidget {
  const BdChip({super.key, required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    if (!scope.cupertino) {
      return FilterChip(label: Text(label), selected: selected, onSelected: (_) => onTap());
    }
    final colors = BdColors.of(context);
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? colors.primary : colors.fill,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            label,
            style: TextStyle(color: selected ? colors.onPrimary : colors.onSurface, fontSize: 15),
          ),
        ),
      ),
    );
  }
}

/// The platform's activity indicator.
class BdSpinner extends StatelessWidget {
  const BdSpinner({super.key, this.size = 20, this.onTint = false});

  final double size;

  /// Drawn on a tinted button: takes the text color.
  final bool onTint;

  @override
  Widget build(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<BdFormScope>();
    final color = onTint ? DefaultTextStyle.of(context).style.color : null;
    if (scope?.cupertino ?? false) {
      return CupertinoActivityIndicator(radius: size / 2, color: color);
    }
    return SizedBox.square(dimension: size, child: CircularProgressIndicator(strokeWidth: 2, color: color));
  }
}

/// A two-way switch between modes (upload or paste a URL).
class BdSegmented extends StatelessWidget {
  const BdSegmented({super.key, required this.segments, required this.selected, required this.onChanged});

  final Map<String, String> segments;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    if (BdFormScope.of(context).cupertino) {
      return SizedBox(
        width: double.infinity,
        child: CupertinoSlidingSegmentedControl<String>(
          groupValue: selected,
          onValueChanged: (v) {
            if (v != null) onChanged(v);
          },
          children: {for (final e in segments.entries) e.key: Text(e.value)},
        ),
      );
    }
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<String>(
        segments: [for (final e in segments.entries) ButtonSegment(value: e.key, label: Text(e.value))],
        selected: {selected},
        showSelectedIcon: false,
        onSelectionChanged: (s) => onChanged(s.first),
      ),
    );
  }
}

/// A row with a spinner and what's loading.
class BdLoadingRow extends StatelessWidget {
  const BdLoadingRow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Row(
          spacing: 10,
          children: [const BdSpinner(size: 18), Flexible(child: Text(text, style: TextStyle(color: BdColors.of(context).muted)))],
        ),
      );
}

/// A failure with a retry button.
class BdRetryRow extends StatelessWidget {
  const BdRetryRow(this.message, {super.key, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = BdColors.of(context);
    return Row(
      spacing: 8,
      children: [
        Icon(Icons.warning_rounded, color: colors.error, size: 18),
        Expanded(child: Text(message, style: TextStyle(color: colors.error))),
        BdTextButton(label: BdFormScope.of(context).strings.retry, onPressed: onRetry),
      ],
    );
  }
}

/// A remote picture with a placeholder while it loads (or if it can't).
class BdRemoteImage extends StatelessWidget {
  const BdRemoteImage(this.url, {super.key, this.width, this.height, this.fit = BoxFit.cover, this.semanticLabel});

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(width: width, height: height ?? 160, color: BdColors.of(context).fill);
    return Image.network(
      url,
      width: width,
      height: height,
      fit: fit,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      loadingBuilder: (context, child, progress) => progress == null ? child : placeholder,
      errorBuilder: (context, error, stack) => placeholder,
    );
  }
}
