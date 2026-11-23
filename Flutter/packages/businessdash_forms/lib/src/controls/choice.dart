import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../icons.dart';
import '../logic.dart' as logic;
import '../primitives.dart';
import '../style.dart';

BdJson _strings(List<String> values) => BdArr([for (final v in values) BdStr(v)]);

// ── Select, radio, checkbox ──────────────────────────────────────────────

class BdSelectControl extends StatelessWidget {
  const BdSelectControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final f = ctx.field;
    final strings = BdFormScope.of(context).strings;
    final options = [for (final o in f.options ?? const <String>[]) BdOption(o, o, icon: f.optionIcons?[o])];
    return BdOptionPicker(
      title: f.label,
      placeholder: f.placeholder.nonEmpty ?? strings.select,
      options: options,
      selection: [?ctx.value?.stringValue.nonEmpty],
      onSelect: (picked) {
        ctx.setText(picked.isEmpty ? '' : picked.first);
        ctx.commit();
      },
      multi: false,
      searchable: BdFormRules.shouldSearch(options.length, f.display),
      allowCustom: f.allowCustom == true,
      isError: ctx.error != null,
    );
  }
}

class BdRadioControl extends StatelessWidget {
  const BdRadioControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final current = ctx.value?.stringValue;
    final f = ctx.field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final opt in f.options ?? const <String>[])
          BdChoiceRow(
            selected: current == opt,
            multi: false,
            onTap: () {
              ctx.setText(opt);
              ctx.commit();
            },
            child: BdOptionLabel(BdOption(opt, opt, icon: f.optionIcons?[opt])),
          ),
      ],
    );
  }
}

class BdCheckboxControl extends StatelessWidget {
  const BdCheckboxControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final f = ctx.field;
    final strings = BdFormScope.of(context).strings;
    final selected = ctx.value?.stringArray ?? const <String>[];
    final opts = f.options ?? const <String>[];
    if (f.display == 'dropdown' || BdFormRules.shouldSearch(opts.length, f.display)) {
      return BdOptionPicker(
        title: f.label,
        placeholder: f.placeholder.nonEmpty ?? strings.select,
        options: [for (final o in opts) BdOption(o, o, icon: f.optionIcons?[o])],
        selection: selected,
        onSelect: (picked) {
          ctx.set(_strings(picked));
          ctx.commit();
        },
        multi: true,
        allowCustom: f.allowCustom == true,
        isError: ctx.error != null,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final opt in opts)
          BdChoiceRow(
            selected: selected.contains(opt),
            multi: true,
            onTap: () {
              ctx.set(_strings(toggledList(selected, opt)));
              ctx.commit();
            },
            child: BdOptionLabel(BdOption(opt, opt, icon: f.optionIcons?[opt])),
          ),
      ],
    );
  }
}

// ── Choice cards ─────────────────────────────────────────────────────────

class BdChoiceCardsControl extends StatelessWidget {
  const BdChoiceCardsControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.choiceConfig;
    final multi = cfg?.mode == 'multi';
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final picked = multi ? (ctx.value?.stringArray ?? const <String>[]) : [?ctx.value?.stringValue.nonEmpty];

    void toggle(String label) {
      if (multi) {
        ctx.set(_strings(toggledList(picked, label)));
      } else {
        ctx.setText(picked.isNotEmpty && picked.first == label ? '' : label);
      }
      ctx.commit();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        for (final opt in cfg?.options ?? const <BdChoiceOption>[])
          Builder(
            builder: (context) {
              final on = picked.contains(opt.label);
              final radius = BorderRadius.circular(scope.style.cornerRadius);
              return Semantics(
                button: true,
                selected: on,
                child: Material(
                  color: on ? Color.alphaBlend(colors.primary.withValues(alpha: 0.06), colors.card) : colors.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: radius,
                    side: BorderSide(color: on ? colors.primary : colors.outlineVariant, width: on ? 2 : 1),
                  ),
                  child: InkWell(
                    borderRadius: radius,
                    onTap: () => toggle(opt.label),
                    child: _ChoiceCard(opt, on: on, multi: multi),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard(this.opt, {required this.on, required this.multi});

  final BdChoiceOption opt;
  final bool on;
  final bool multi;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final image = BdFormRules.safeHttpUrl(opt.imageUrl);
    final href = BdFormRules.safeHttpUrl(opt.href);
    final open = scope.openLink;
    final Widget indicator = multi
        ? Icon(
            on
                ? (scope.cupertino ? CupertinoIcons.check_mark_circled_solid : Icons.check_box)
                : (scope.cupertino ? CupertinoIcons.circle : Icons.check_box_outline_blank),
            color: on ? colors.primary : colors.muted,
          )
        : Icon(
            on
                ? (scope.cupertino ? CupertinoIcons.check_mark_circled_solid : Icons.radio_button_checked)
                : (scope.cupertino ? CupertinoIcons.circle : Icons.radio_button_unchecked),
            color: on ? colors.primary : colors.muted,
          );
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          if (image != null)
            ClipRRect(borderRadius: BorderRadius.circular(10), child: BdRemoteImage(image, width: 56, height: 56))
          else if (opt.icon.nonEmpty case final icon?)
            SizedBox(width: 32, child: Center(child: BdIcon(icon, size: 24, color: colors.primary))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(opt.label, style: theme.textTheme.titleSmall)),
                    if (opt.price.nonEmpty case final price?)
                      Text(price, style: theme.textTheme.labelLarge?.copyWith(color: colors.muted)),
                  ],
                ),
                if (opt.description.nonEmpty case final d?)
                  Text(d, style: theme.textTheme.bodyMedium?.copyWith(color: colors.muted)),
                if (href != null && open != null)
                  BdTextButton(label: scope.strings.view, compact: true, onPressed: () => open(Uri.parse(href))),
              ],
            ),
          ),
          ExcludeSemantics(child: indicator),
        ],
      ),
    );
  }
}

// ── Boolean ──────────────────────────────────────────────────────────────

class BdBooleanControl extends StatelessWidget {
  const BdBooleanControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) => BdSwitchRow(
        label: ctx.field.placeholder.nonEmpty ?? BdFormScope.of(context).strings.yesNo,
        value: ctx.value == const BdBool(true),
        onChanged: (on) {
          ctx.set(BdBool(on));
          ctx.commit();
        },
      );
}

// ── Icon select ──────────────────────────────────────────────────────────

class BdIconSelectControl extends StatefulWidget {
  const BdIconSelectControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdIconSelectControl> createState() => _BdIconSelectControlState();
}

class _BdIconSelectControlState extends State<BdIconSelectControl> {
  var _query = '';
  List<String> _all = const [];
  String? _loadedFrom;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final curated = widget.ctx.field.iconConfig?.allowedIcons ?? const [];
    final base = BdFormScope.of(context).iconBaseUrl;
    if (curated.isEmpty && _loadedFrom != base) {
      _loadedFrom = base;
      BdIconStore.allNames(base).then((names) {
        if (mounted) setState(() => _all = names);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final cfg = ctx.field.iconConfig;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final curated = cfg?.allowedIcons ?? const <String>[];
    final current = ctx.value?.stringValue ?? '';
    final q = BdJS.trim(_query).toLowerCase();
    final source = curated.isEmpty ? _all : curated;
    final names = (q.isEmpty ? source : source.where((n) => n.contains(q))).take(120).toList();
    final columns = (cfg?.columns ?? 6).clamp(2, 12);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        if (curated.isEmpty)
          BdTextInput(
            value: _query,
            onChanged: (t) => setState(() => _query = t),
            placeholder: strings.searchIcons,
            keyboard: BdKeyboard.url,
            textInputAction: TextInputAction.search,
          ),
        // Not a lazy grid: the form already scrolls.
        GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          children: [
            for (final name in names)
              Semantics(
                button: true,
                selected: name == current,
                label: name.replaceAll('-', ' '),
                excludeSemantics: true,
                child: Material(
                  color: name == current ? colors.primary : colors.fill,
                  borderRadius: BorderRadius.circular(scope.style.cornerRadius * 0.75),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(scope.style.cornerRadius * 0.75),
                    onTap: () {
                      ctx.setText(name == current ? '' : name);
                      ctx.commit();
                    },
                    child: Center(
                      child: BdIcon(name, size: 22, color: name == current ? colors.onPrimary : colors.onSurface),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (current.isNotEmpty)
          Row(
            children: [
              Expanded(
                child: Text(
                  current,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(fontFamily: 'monospace', color: colors.muted),
                ),
              ),
              BdTextButton(label: strings.clear, onPressed: () => ctx.setText('')),
            ],
          ),
      ],
    );
  }
}

// ── Services ─────────────────────────────────────────────────────────────

class BdServiceControl extends StatelessWidget {
  const BdServiceControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final cfg = ctx.field.serviceConfig;
    final strings = BdFormScope.of(context).strings;
    final colors = BdColors.of(context);
    final multi = cfg?.multi != false;
    final picked = ctx.value?.stringArray ?? const <String>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final opt in cfg?.options ?? const <BdServiceOption>[])
          BdChoiceRow(
            selected: picked.contains(opt.id),
            multi: multi,
            onTap: () {
              final next = multi
                  ? toggledList(picked, opt.id)
                  : (picked.length == 1 && picked.first == opt.id ? <String>[] : [opt.id]);
              ctx.set(_strings(next));
              ctx.commit();
            },
            child: Row(
              children: [
                Expanded(child: Text(opt.title, style: Theme.of(context).textTheme.bodyLarge)),
                if (opt.estimatedHours case final h? when h > 0)
                  Text(
                    '${BdJS.formatNumber(h)} ${h == 1 ? strings.hour : strings.hours}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.muted),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

// ── Collection records ───────────────────────────────────────────────────

class BdCollectionControl extends StatefulWidget {
  const BdCollectionControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdCollectionControl> createState() => _BdCollectionControlState();
}

class _BdCollectionControlState extends State<BdCollectionControl> {
  @override
  void initState() {
    super.initState();
    // After this frame: loading publishes a new state, which rebuilds the form.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.ctx.controller.loadCollectionOptions(widget.ctx.field.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final f = ctx.field;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final multi = f.collectionSelectConfig?.multi == true;

    switch (scope.state.collectionOptions[f.id]) {
      case BdLoaded(:final value):
        final options = [for (final o in value) BdOption(o.value, o.label, image: o.image)];
        final selection = multi ? (ctx.value?.stringArray ?? const <String>[]) : [?ctx.value?.stringValue.nonEmpty];
        void write(List<String> next) {
          ctx.set(multi ? _strings(next) : BdStr(next.isEmpty ? '' : next.first));
          ctx.commit();
        }

        if (options.length > BdFormRules.searchableThreshold || f.display == 'combobox') {
          return BdOptionPicker(
            title: f.label,
            placeholder: f.placeholder.nonEmpty ?? strings.select,
            options: options,
            selection: selection,
            onSelect: write,
            multi: multi,
            searchable: true,
            isError: ctx.error != null,
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final o in options)
              BdChoiceRow(
                selected: selection.contains(o.value),
                multi: multi,
                onTap: () => write(
                  multi
                      ? toggledList(selection, o.value)
                      : (selection.length == 1 && selection.first == o.value ? <String>[] : [o.value]),
                ),
                child: BdOptionLabel(o),
              ),
          ],
        );
      case BdLoadFailed(:final message):
        return BdRetryRow(message, onRetry: () => ctx.controller.reloadCollectionOptions(f.id));
      default:
        return BdLoadingRow(strings.loadingOptions);
    }
  }
}

// ── Color ────────────────────────────────────────────────────────────────

Color? _parseHex(String hex) {
  final argb = logic.hexToArgb(hex);
  return argb == null ? null : Color(argb);
}

Color _contrasting(Color? c) => c == null || c.computeLuminance() > 0.45 ? Colors.black : Colors.white;

class BdColorControl extends StatelessWidget {
  const BdColorControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final current = ctx.value?.stringValue ?? '';
    final presets = ctx.field.options ?? const <String>[];
    final isCustom = current.isNotEmpty && !presets.any((p) => p.toLowerCase() == current.toLowerCase());

    Future<void> editCustom() async {
      final hex = await showAdaptiveDialog<String>(
        context: context,
        builder: (dialogContext) => bdLocalized(
          dialogContext,
          Theme(data: Theme.of(context), child: scope.over(_HexDialog(initial: isCustom ? current : '#3B82F6'))),
        ),
      );
      if (hex != null) {
        ctx.setText(hex);
        ctx.commit();
      }
    }

    final customColor = isCustom ? _parseHex(current) : null;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final hex in presets)
          _Swatch(
            color: _parseHex(hex),
            selected: hex.toLowerCase() == current.toLowerCase(),
            label: hex,
            onTap: () {
              ctx.setText(hex);
              ctx.commit();
            },
          ),
        // A hex entry, previewed live (Flutter has no system color picker).
        Semantics(
          button: true,
          label: strings.customColor,
          selected: isCustom,
          excludeSemantics: true,
          child: GestureDetector(
            onTap: editCustom,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: customColor ?? colors.fill,
                border: Border.all(color: isCustom ? colors.primary : colors.outlineVariant, width: isCustom ? 3 : 1),
              ),
              child: isCustom ? null : Icon(scope.cupertino ? CupertinoIcons.add : Icons.add, color: colors.muted),
            ),
          ),
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, required this.selected, required this.label, required this.onTap});

  final Color? color;
  final bool selected;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = BdColors.of(context);
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color ?? Colors.transparent,
            border: Border.all(color: colors.outlineVariant),
          ),
          child: selected ? Icon(Icons.check, size: 18, color: _contrasting(color)) : null,
        ),
      ),
    );
  }
}

class _HexDialog extends StatefulWidget {
  const _HexDialog({required this.initial});

  final String initial;

  @override
  State<_HexDialog> createState() => _HexDialogState();
}

final _hexChars = RegExp(r'[^#0-9a-zA-Z]');

class _HexDialogState extends State<_HexDialog> {
  late String _text = widget.initial;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final parsed = _parseHex(_text);
    final preview = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: parsed ?? Colors.transparent,
        border: Border.all(color: colors.outlineVariant),
      ),
    );
    final field = BdTextInput(
      value: _text,
      onChanged: (t) => setState(() => _text = t),
      transform: (t) {
        final clean = t.replaceAll(_hexChars, '');
        return clean.length > 7 ? clean.substring(0, 7) : clean;
      },
      label: strings.hexColor,
      keyboard: BdKeyboard.url,
      isError: parsed == null,
      textInputAction: TextInputAction.done,
    );
    void done() => Navigator.pop(context, logic.normalizeHex(_text) ?? _text);
    final content = Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(spacing: 12, children: [preview, Expanded(child: field)]),
    );
    if (scope.cupertino) {
      return CupertinoAlertDialog(
        title: Text(strings.customColor),
        content: Material(type: MaterialType.transparency, child: content),
        actions: [
          CupertinoDialogAction(onPressed: () => Navigator.pop(context), child: Text(strings.cancel)),
          CupertinoDialogAction(onPressed: parsed == null ? null : done, isDefaultAction: true, child: Text(strings.done)),
        ],
      );
    }
    return AlertDialog(
      title: Text(strings.customColor),
      content: content,
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(strings.cancel)),
        TextButton(onPressed: parsed == null ? null : done, child: Text(strings.done)),
      ],
    );
  }
}

// ── Slider, ratings, stepper ─────────────────────────────────────────────

class BdSliderControl extends StatefulWidget {
  const BdSliderControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdSliderControl> createState() => _BdSliderControlState();
}

class _BdSliderControlState extends State<BdSliderControl> {
  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final cfg = ctx.field.sliderConfig;
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final lo = cfg?.min ?? 0;
    final hi = (cfg?.max ?? 100) > lo ? (cfg?.max ?? 100) : lo + 1;
    final step = (cfg?.step ?? 1) > 0 ? (cfg?.step ?? 1) : 1.0;
    final v = (ctx.value?.doubleValue ?? lo).clamp(lo, hi).toDouble();
    String fmt(double n) => switch (cfg?.unit) {
          'currency' => '\$${BdJS.formatNumber(n)}',
          'percent' => '${BdJS.formatNumber(n)}%',
          _ => BdJS.formatNumber(n),
        };
    final stops = ((hi - lo) / step).round();
    // Tick marks only when there are few enough to read.
    final divisions = stops >= 2 && stops <= 20 ? stops : null;

    void changed(double raw) {
      final snapped = lo + ((raw - lo) / step).round() * step;
      ctx.set(BdNum(double.parse(snapped.toStringAsFixed(10))));
    }

    final slider = scope.cupertino
        ? CupertinoSlider(
            value: v,
            min: lo,
            max: hi,
            divisions: divisions,
            activeColor: colors.primary,
            onChanged: changed,
            onChangeEnd: (_) => ctx.commit(),
          )
        : Slider(
            value: v,
            min: lo,
            max: hi,
            divisions: divisions,
            label: fmt(v),
            onChanged: changed,
            onChangeEnd: (_) => ctx.commit(),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 4,
      children: [
        Row(
          children: [
            Text(fmt(lo), style: theme.textTheme.labelMedium?.copyWith(color: colors.muted)),
            Expanded(
              child: Text(
                fmt(v),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ),
            Text(fmt(hi), style: theme.textTheme.labelMedium?.copyWith(color: colors.muted)),
          ],
        ),
        Semantics(label: ctx.field.label, value: fmt(v), child: slider),
      ],
    );
  }
}

class BdStarsControl extends StatelessWidget {
  const BdStarsControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final colors = BdColors.of(context);
    final max = (ctx.field.starRatingConfig?.maxStars ?? 5).clamp(1, 10);
    final v = ctx.value?.doubleValue?.toInt() ?? 0;
    return Wrap(
      spacing: 2,
      children: [
        for (var i = 1; i <= max; i++)
          Semantics(
            button: true,
            selected: i == v,
            label: strings.format(strings.ratingOf, [i, max]),
            excludeSemantics: true,
            child: IconButton(
              onPressed: () {
                ctx.set(BdNum(i.toDouble()));
                ctx.commit();
              },
              icon: Icon(
                i <= v ? Icons.star_rounded : Icons.star_outline_rounded,
                size: 32,
                color: i <= v ? const Color(0xFFFFB300) : colors.outlineVariant,
              ),
            ),
          ),
      ],
    );
  }
}

class BdHappinessControl extends StatelessWidget {
  const BdHappinessControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  static const _faces = ['😞', '😕', '😐', '🙂', '😄'];

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final colors = BdColors.of(context);
    // 0 is a real answer (😞), so "unanswered" is null, not 0.
    final v = ctx.value?.doubleValue?.toInt() ?? -1;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        for (var i = 0; i < _faces.length; i++)
          Semantics(
            button: true,
            selected: i == v,
            label: i < strings.happinessNames.length ? strings.happinessNames[i] : _faces[i],
            excludeSemantics: true,
            child: GestureDetector(
              onTap: () {
                ctx.set(BdNum(i.toDouble()));
                ctx.commit();
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i == v ? colors.primary.withValues(alpha: 0.2) : Colors.transparent,
                ),
                child: AnimatedScale(
                  scale: i == v ? 1.15 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: Opacity(
                    opacity: v < 0 || i == v ? 1 : 0.5,
                    child: Text(_faces[i], style: const TextStyle(fontSize: 32)),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class BdStepperControl extends StatelessWidget {
  const BdStepperControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final v = ctx.value?.doubleValue ?? 0;
    final lo = ctx.field.validation?.min ?? -1000000;
    final hiRaw = ctx.field.validation?.max ?? 1000000;
    final hi = hiRaw < lo ? lo : hiRaw;
    void write(double n) {
      ctx.set(BdNum(n.clamp(lo, hi).toDouble()));
      ctx.commit();
    }

    Widget button(IconData icon, String label, bool enabled, VoidCallback onTap) => Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: scope.cupertino
              ? CupertinoButton.tinted(
                  onPressed: enabled ? onTap : null,
                  sizeStyle: CupertinoButtonSize.medium,
                  child: Icon(icon, size: 20),
                )
              : IconButton.outlined(onPressed: enabled ? onTap : null, icon: Icon(icon)),
        );

    return Row(
      spacing: 16,
      children: [
        button(scope.cupertino ? CupertinoIcons.minus : Icons.remove, strings.decrease, v - 1 >= lo, () => write(v - 1)),
        Semantics(
          label: '${ctx.field.label}, ${BdJS.formatNumber(v)}',
          excludeSemantics: true,
          child: Text(
            BdJS.formatNumber(v),
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ),
        button(scope.cupertino ? CupertinoIcons.add : Icons.add, strings.increase, v + 1 <= hi, () => write(v + 1)),
      ],
    );
  }
}
