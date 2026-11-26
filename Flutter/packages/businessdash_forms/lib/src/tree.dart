import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'controls/choice.dart';
import 'controls/dates.dart';
import 'controls/media.dart';
import 'controls/static.dart';
import 'controls/text.dart';
import 'primitives.dart';
import 'style.dart';

/// The native control for one element, by type. Custom renderers can fall
/// back to it.
class BdFieldControl extends StatelessWidget {
  const BdFieldControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) => switch (ctx.field.type) {
        // Static
        'title' ||
        'subtitle' ||
        'separator' ||
        'richtext' ||
        'body_text' ||
        'bullet_list' ||
        'table' ||
        'image' =>
          BdStaticContent(ctx.field),
        'calculation' => BdCalculationView(ctx),
        // Text
        'textarea' => BdTextAreaControl(ctx),
        'email' => BdTextControl(ctx, email: true),
        'phone' => BdPhoneControl(ctx),
        'url' => BdUrlControl(ctx),
        'number' => BdNumberControl(ctx),
        'currency' => BdCurrencyControl(ctx),
        'measurement' => BdMeasurementControl(ctx),
        'name' => BdNameControl(ctx),
        'address' => BdAddressControl(ctx),
        'tags' => BdTagsControl(ctx),
        'rich_text_input' => BdRichTextControl(ctx),
        // Choices
        'select' => BdSelectControl(ctx),
        'radio' => BdRadioControl(ctx),
        'checkbox' => BdCheckboxControl(ctx),
        'choice_cards' => BdChoiceCardsControl(ctx),
        'boolean' => BdBooleanControl(ctx),
        'icon_select' => BdIconSelectControl(ctx),
        'service_selector' => BdServiceControl(ctx),
        'collection_select' => BdCollectionControl(ctx),
        'color_picker' => BdColorControl(ctx),
        'slider' => BdSliderControl(ctx),
        'star_rating' => BdStarsControl(ctx),
        'happiness_rating' => BdHappinessControl(ctx),
        'stepper' => BdStepperControl(ctx),
        // Dates
        'date' => BdDateControl(ctx),
        'date_range' => BdDateRangeControl(ctx),
        'time_picker' => BdTimeControl(ctx),
        'month_year' => BdMonthYearControl(ctx),
        'schedule' => ctx.field.scheduleConfig?.mode == 'auto'
            ? BdBookingControl(ctx)
            : BdAvailabilityControl(ctx),
        // Media & payment
        'file_upload' => BdFileControl(ctx),
        'image_input' => BdImageInputControl(ctx),
        'credit_card' => BdCardControl(ctx),
        _ => BdTextControl(ctx),
      };
}

/// Space between the nodes a tree lays out in the current container.
class _TreeSpacing extends InheritedWidget {
  const _TreeSpacing({required this.spacing, required super.child});

  final double spacing;

  static double of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_TreeSpacing>()?.spacing ??
      BdFormScope.of(context).style.spacing;

  @override
  bool updateShouldNotify(_TreeSpacing old) => spacing != old.spacing;
}

/// Whether a node draws anything right now.
bool _shows(BdFormController c, BdFormField node, List<BdEntry> entries) =>
    switch (node.type) {
      'condition_block' ||
      'flex_row' ||
      'input_group' ||
      'or_condition' =>
        c.isVisible(node, entries),
      'reference_value' => false,
      'calculation' => node.calculationConfig?.display?.show != false,
      _ => true,
    };

/// Walks a list of elements: containers apply their conditions and lay out
/// their children; everything else becomes a [BdFieldRow]. A hidden branch
/// leaves no gap: each node carries the space above it, and folds it away
/// with itself.
class BdFieldTree extends StatelessWidget {
  const BdFieldTree(this.nodes, this.entries, {super.key});

  final List<BdFormField> nodes;
  final List<BdEntry> entries;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    final spacing = _TreeSpacing.of(context);
    var anyAbove = false;
    final children = <Widget>[];
    for (final node in nodes) {
      final shows = _shows(c, node, entries);
      final gap = anyAbove ? spacing : 0.0;
      if (shows) anyAbove = true;
      children.add(KeyedSubtree(
          key: ValueKey(node.id),
          child: _NodeView(node, entries, shows: shows, gap: gap)));
    }
    return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: children);
  }
}

class _NodeView extends StatelessWidget {
  const _NodeView(this.node, this.entries,
      {required this.shows, required this.gap});

  final BdFormField node;
  final List<BdEntry> entries;
  final bool shows;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final c = scope.controller;
    Widget? content;
    switch (node.type) {
      case 'condition_block' || 'flex_row':
        content = BdFieldTree(node.children ?? const [], entries);
      case 'input_group':
        final children = (node.children ?? const <BdFormField>[])
            .take(c.revealCount(node, entries))
            .toList();
        final heading = node.showGroupLabel == true && node.label.isNotEmpty;
        content = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: heading ? _TreeSpacing.of(context) : 0,
          children: [
            if (heading)
              Semantics(
                  header: true,
                  child: Text(node.label,
                      style: Theme.of(context).textTheme.titleMedium)),
            BdFieldTree(children, entries),
          ],
        );
      case 'or_condition':
        content = _EitherOr(node, entries);
      case 'multi_populator':
        content = _Repeater(node, entries);
      case 'reference_value':
        content = null;
      default:
        content =
            shows ? BdFieldRow(node, BdFieldPath(node.id, entries)) : null;
    }
    final body = shows && content != null
        ? Padding(padding: EdgeInsets.only(top: gap), child: content)
        : null;
    if (!scope.style.animated) return body ?? const SizedBox.shrink();
    // A conditional branch grows in when it starts to apply, and folds away
    // when it stops.
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeInOut,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        child: body ?? const SizedBox(width: double.infinity),
      ),
    );
  }
}

/// Registers a row so a failed attempt can scroll to it.
class _ScrollTarget extends StatefulWidget {
  const _ScrollTarget({required this.pathKey, required this.child});

  final String pathKey;
  final Widget child;

  @override
  State<_ScrollTarget> createState() => _ScrollTargetState();
}

class _ScrollTargetState extends State<_ScrollTarget> {
  final _key = GlobalKey();
  Map<String, GlobalKey>? _targets;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _targets = BdFormScope.of(context).scrollTargets..[widget.pathKey] = _key;
  }

  @override
  void didUpdateWidget(_ScrollTarget old) {
    super.didUpdateWidget(old);
    if (old.pathKey != widget.pathKey) {
      if (_targets?[old.pathKey] == _key) _targets?.remove(old.pathKey);
      _targets?[widget.pathKey] = _key;
    }
  }

  @override
  void dispose() {
    if (_targets?[widget.pathKey] == _key) _targets?.remove(widget.pathKey);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      KeyedSubtree(key: _key, child: widget.child);
}

/// Label, control, error and help for one field.
class BdFieldRow extends StatelessWidget {
  const BdFieldRow(this.field, this.path, {super.key});

  final BdFormField field;
  final BdFieldPath path;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final ctx = BdFieldContext(field, path, scope.controller);
    final isStatic =
        BdFieldType.noLabel.contains(field.type) || field.type == 'image';
    final grouped =
        scope.style.layout == BdFormLayout.grouped && !BdInCard.of(context);
    // In the grouped layout the cards already separate questions.
    if (grouped && field.type == 'separator') return const SizedBox.shrink();

    final custom = scope.renderers.rendererFor(field);
    final control = custom != null
        ? Builder(builder: (context) => custom(context, ctx))
        : BdFieldControl(ctx);
    final surface = grouped &&
        !(isStatic && (field.type == 'title' || field.type == 'subtitle'));
    final content = isStatic
        ? control
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 8,
            children: [
              BdFieldLabel(field),
              control,
              BdFootnotes(error: ctx.error, help: field.helpText),
            ],
          );
    final colors = BdColors.of(context);
    return _ScrollTarget(
      pathKey: path.key,
      child: surface
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius:
                      BorderRadius.circular(scope.style.cornerRadius)),
              child: content,
            )
          : content,
    );
  }
}

class BdFieldLabel extends StatelessWidget {
  const BdFieldLabel(this.field, {super.key});

  final BdFormField field;

  @override
  Widget build(BuildContext context) {
    if (field.label.isEmpty) return const SizedBox.shrink();
    final required = (field.required || field.mustBeTrue == true) &&
        !BdFieldType.staticOrLayout.contains(field.type);
    return BdRequiredLabel(field.label, required: required);
  }
}

class BdRequiredLabel extends StatelessWidget {
  const BdRequiredLabel(this.text, {super.key, required this.required});

  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final style = BdFormScope.of(context).style;
    final colors = BdColors.of(context);
    return Semantics(
      label: text + (required ? ', required' : ''),
      excludeSemantics: true,
      child: Text.rich(
        TextSpan(
          text: text,
          children: [
            if (required && style.requiredMarker.isNotEmpty)
              TextSpan(
                  text: style.requiredMarker,
                  style: TextStyle(color: colors.error)),
          ],
        ),
        style: Theme.of(context).textTheme.titleSmall,
      ),
    );
  }
}

class BdFootnotes extends StatelessWidget {
  const BdFootnotes({super.key, required this.error, required this.help});

  final String? error;
  final String? help;

  @override
  Widget build(BuildContext context) {
    final help = this.help.nonEmpty;
    if (error == null && help == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 4,
      children: [
        if (error != null) BdErrorText(error!),
        if (help != null)
          Text(help,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: BdColors.of(context).muted)),
      ],
    );
  }
}

class BdErrorText extends StatelessWidget {
  const BdErrorText(this.error, {super.key});

  final String error;

  @override
  Widget build(BuildContext context) => Semantics(
        // Read out as it appears.
        liveRegion: true,
        child: Text(error,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: BdColors.of(context).error)),
      );
}

/// A surface inside a row: a repeater entry, the either/or box.
class _InnerSurface extends StatelessWidget {
  const _InnerSurface({super.key, required this.children, this.error = false});

  final List<Widget> children;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final colors = BdColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BdInCard.of(context) ? colors.innerCard : colors.card,
        borderRadius: BorderRadius.circular(scope.style.cornerRadius),
        border: error ? Border.all(color: colors.error) : null,
      ),
      child: BdInCard(
        child: _TreeSpacing(
          spacing: 16,
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: children),
        ),
      ),
    );
  }
}

// ── Either/or ────────────────────────────────────────────────────────────

/// Two (or more) alternatives where at least one must be filled.
class _EitherOr extends StatelessWidget {
  const _EitherOr(this.node, this.entries);

  final BdFormField node;
  final List<BdEntry> entries;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);
    final path = BdFieldPath(node.id, entries);
    final error = scope.controller.errorAt(path);
    final branches = node.children ?? const <BdFormField>[];

    String sideLabel(int i, BdFormField child) {
      if (i == 0 && node.orConditionConfig?.leftLabel.nonEmpty != null) {
        return node.orConditionConfig!.leftLabel!;
      }
      if (i == 1 && node.orConditionConfig?.rightLabel.nonEmpty != null) {
        return node.orConditionConfig!.rightLabel!;
      }
      if (child.label.isNotEmpty) return child.label;
      return i < 3
          ? const ['Option A', 'Option B', 'Option C'][i]
          : 'Option ${i + 1}';
    }

    return _ScrollTarget(
      pathKey: path.key,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          if (node.label.isNotEmpty)
            Text(node.label, style: theme.textTheme.titleSmall),
          Text(strings.fillOneSide,
              style: theme.textTheme.bodySmall?.copyWith(color: colors.muted)),
          _InnerSurface(
            error: error != null,
            children: [
              for (var i = 0; i < branches.length; i++) ...[
                if (i > 0)
                  Row(
                    spacing: 12,
                    children: [
                      Expanded(child: Divider(color: colors.outlineVariant)),
                      Text(strings.or,
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: colors.muted)),
                      Expanded(child: Divider(color: colors.outlineVariant)),
                    ],
                  ),
                Builder(
                  key: ValueKey(branches[i].id),
                  builder: (context) {
                    final child = branches[i];
                    final side = sideLabel(i, child);
                    final showsOwnLabel =
                        !BdFieldType.containerTypes.contains(child.type) &&
                            !BdFieldType.noLabel.contains(child.type) &&
                            child.label.isNotEmpty;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 8,
                      children: [
                        // A plain field already shows its own label; don't say it twice.
                        if (!(showsOwnLabel && side == child.label))
                          Text(side, style: theme.textTheme.labelLarge),
                        BdFieldTree([child], entries),
                      ],
                    );
                  },
                ),
              ],
            ],
          ),
          if (error != null) BdErrorText(error),
        ],
      ),
    );
  }
}

// ── Repeater ─────────────────────────────────────────────────────────────

/// A `multi_populator`: the same fields once per entry, with add and remove.
class _Repeater extends StatelessWidget {
  const _Repeater(this.node, this.entries);

  final BdFormField node;
  final List<BdEntry> entries;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final c = scope.controller;
    final path = BdFieldPath(node.id, entries);
    final list = c.entries(path);
    final cfg = node.populatorConfig;
    final max = cfg?.maxInstances ?? 10;
    final itemLabel =
        cfg?.itemLabel.nonEmpty ?? node.label.nonEmpty ?? strings.entry;
    final error = c.errorAt(path);

    return _ScrollTarget(
      pathKey: path.key,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          if (node.label.isNotEmpty)
            BdRequiredLabel(node.label, required: node.required),
          for (var index = 0; index < list.length; index++)
            _InnerSurface(
              key: ValueKey(index),
              children: [
                Row(
                  children: [
                    Expanded(
                        child: Text('$itemLabel ${index + 1}',
                            style: Theme.of(context).textTheme.titleSmall)),
                    if (list.length > 1)
                      IconButton(
                        onPressed: () => c.removeEntry(index, path),
                        tooltip: '${strings.removeEntry} ${index + 1}',
                        icon: Icon(scope.cupertino
                            ? CupertinoIcons.xmark
                            : Icons.close),
                      ),
                  ],
                ),
                BdFieldTree(node.children ?? const [], path.entry(index)),
              ],
            ),
          if (list.length < max)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: BdButton(
                label: cfg?.addButtonLabel.nonEmpty ?? strings.addAnother,
                icon: Icon(scope.cupertino ? CupertinoIcons.add : Icons.add,
                    size: 18),
                onPressed: () => c.addEntry(path),
              ),
            ),
          if (error != null) BdErrorText(error),
        ],
      ),
    );
  }
}
