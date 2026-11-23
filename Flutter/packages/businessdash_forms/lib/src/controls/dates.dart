import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../logic.dart' as logic;
import '../primitives.dart';
import '../style.dart';

String _shortDate(BuildContext context, DateTime d) => MaterialLocalizations.of(context).formatShortDate(d);

String _timeOfDay(BuildContext context, TimeOfDay t) => MaterialLocalizations.of(context).formatTimeOfDay(
      t,
      alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
    );

TimeOfDay? _time(String? hhmm) {
  final t = logic.parseTime(hhmm);
  if (t == null) return null;
  return TimeOfDay(hour: int.parse(t.substring(0, 2)), minute: int.parse(t.substring(3, 5)));
}

String _hhmm(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// A date that can be unset: tap to pick, clear to unset.
class BdDateField extends StatelessWidget {
  const BdDateField({
    super.key,
    required this.value,
    required this.onChanged,
    this.label,
    this.description,
    this.min,
    this.isError = false,
  });

  final String? value;
  final ValueChanged<String?> onChanged;
  final String? label;
  final String? description;
  final DateTime? min;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final day = logic.parseDay(value);
    final date = day == null ? null : logic.dateOf(day);
    return BdPickerField(
      text: date == null ? '' : _shortDate(context, date),
      placeholder: scope.strings.addDate,
      label: label,
      description: description,
      isError: isError,
      trailing: Icon(scope.cupertino ? CupertinoIcons.calendar : Icons.calendar_today, size: 20, color: BdColors.of(context).muted),
      onClear: () => onChanged(null),
      onTap: () async {
        final picked = await bdPickDate(context, initial: date, min: min);
        if (picked != null) onChanged(logic.formatDay(logic.dayOf(picked)));
      },
    );
  }
}

/// A time of day that can be unset.
class BdTimeField extends StatelessWidget {
  const BdTimeField({super.key, required this.value, required this.onChanged, this.label, this.isError = false});

  final String? value;
  final ValueChanged<String?> onChanged;
  final String? label;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final scope = BdFormScope.of(context);
    final time = _time(value);
    return BdPickerField(
      text: time == null ? '' : _timeOfDay(context, time),
      placeholder: scope.strings.addTime,
      label: label,
      isError: isError,
      trailing: Icon(scope.cupertino ? CupertinoIcons.clock : Icons.schedule, size: 20, color: BdColors.of(context).muted),
      onClear: () => onChanged(null),
      onTap: () async {
        final picked = await bdPickTime(context, initial: time);
        if (picked != null) onChanged(_hhmm(picked));
      },
    );
  }
}

class BdDateControl extends StatelessWidget {
  const BdDateControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) => BdDateField(
        value: ctx.value?.stringValue,
        onChanged: (v) {
          ctx.setText(v ?? '');
          ctx.commit();
        },
        description: ctx.field.label,
        isError: ctx.error != null,
      );
}

class BdDateRangeControl extends StatelessWidget {
  const BdDateRangeControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final start = logic.parseDay(ctx.value?['start']?.stringValue);
    final sameDayOk = ctx.field.dateRangeConfig?.allowSameDay != false;
    final minEnd = start == null ? null : logic.dateOf(sameDayOk ? start : logic.addDays(start, 1));
    void write(String key, String? v) {
      ctx.setKey(key, BdStr(v ?? ''));
      ctx.commit();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        BdDateField(
          value: ctx.value?['start']?.stringValue,
          onChanged: (v) => write('start', v),
          label: strings.start,
          isError: ctx.error != null,
        ),
        BdDateField(
          value: ctx.value?['end']?.stringValue,
          onChanged: (v) => write('end', v),
          label: strings.end,
          min: minEnd,
          isError: ctx.error != null,
        ),
      ],
    );
  }
}

class BdTimeControl extends StatelessWidget {
  const BdTimeControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final cfg = ctx.field.timeConfig;
    final error = ctx.error != null;
    void write(String key, String? v) {
      ctx.setKey(key, BdStr(v ?? ''));
      ctx.commit();
    }

    String? part(String key) => ctx.value?[key]?.stringValue;

    switch (cfg?.mode ?? 'simple') {
      case 'time_block':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            BdTimeField(value: part('start'), onChanged: (v) => write('start', v), label: strings.start, isError: error),
            BdTimeField(value: part('end'), onChanged: (v) => write('end', v), label: strings.end, isError: error),
          ],
        );
      case 'appointment':
        final now = DateTime.now();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            BdDateField(
              value: part('date'),
              onChanged: (v) => write('date', v),
              label: strings.date,
              min: DateTime(now.year, now.month, now.day),
              isError: error,
            ),
            BdTimeField(value: part('time'), onChanged: (v) => write('time', v), label: strings.time, isError: error),
          ],
        );
      default:
        final twelve = (cfg?.format ?? '12h') != '24h';
        final options = [
          for (final t in logic.timesOfDay(cfg?.stepMinutes ?? 30)) BdOption(t, logic.formatTime(t, twelve)),
        ];
        return BdOptionPicker(
          title: ctx.field.label,
          placeholder: ctx.field.placeholder.nonEmpty ?? strings.selectTime,
          options: options,
          selection: [?ctx.value?.stringValue.nonEmpty],
          onSelect: (picked) {
            ctx.setText(picked.isEmpty ? '' : picked.first);
            ctx.commit();
          },
          multi: false,
          searchable: false,
          isError: error,
          // Nothing chosen yet: open on the working day, not midnight.
          startAt: '09:00',
        );
    }
  }
}

class BdMonthYearControl extends StatefulWidget {
  const BdMonthYearControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdMonthYearControl> createState() => _BdMonthYearControlState();
}

class _BdMonthYearControlState extends State<BdMonthYearControl> {
  // Held here so half an answer (a month, no year yet) survives.
  int? _month;
  int? _year;

  @override
  void initState() {
    super.initState();
    _adopt(widget.ctx.value?.stringValue);
  }

  @override
  void didUpdateWidget(BdMonthYearControl old) {
    super.didUpdateWidget(old);
    _adopt(widget.ctx.value?.stringValue);
  }

  void _adopt(String? raw) {
    if (raw == null || raw.length != 7) return;
    final y = int.tryParse(raw.substring(0, 4));
    final m = int.tryParse(raw.substring(5, 7));
    if (y != null && m != null) {
      _year = y;
      _month = m;
    }
  }

  void _emit(int? m, int? y) {
    setState(() {
      _month = m;
      _year = y;
    });
    final ctx = widget.ctx;
    ctx.setText(m != null && y != null ? '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}' : '');
    ctx.commit();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final strings = BdFormScope.of(context).strings;
    final thisYear = DateTime.now().year;
    final minYear = ctx.field.monthYearConfig?.minYear ?? thisYear - 100;
    final maxRaw = ctx.field.monthYearConfig?.maxYear ?? thisYear + 10;
    final maxYear = maxRaw < minYear ? minYear : maxRaw;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      spacing: 8,
      children: [
        Expanded(
          flex: 13,
          child: BdOptionPicker(
            title: strings.month,
            placeholder: strings.month,
            options: [
              for (var m = 1; m <= 12; m++)
                BdOption('$m', m <= strings.monthNames.length ? strings.monthNames[m - 1] : '$m'),
            ],
            selection: [if (_month != null) '$_month'],
            onSelect: (p) => _emit(p.isEmpty ? null : int.tryParse(p.first), _year),
            multi: false,
            searchable: false,
            isError: ctx.error != null,
          ),
        ),
        Expanded(
          flex: 10,
          child: BdOptionPicker(
            title: strings.year,
            placeholder: strings.year,
            options: [for (var y = maxYear; y >= minYear; y--) BdOption('$y', '$y')],
            selection: [if (_year != null) '$_year'],
            onSelect: (p) => _emit(_month, p.isEmpty ? null : int.tryParse(p.first)),
            multi: false,
            searchable: false,
            isError: ctx.error != null,
          ),
        ),
      ],
    );
  }
}

// ── Schedule ─────────────────────────────────────────────────────────────

/// Availability: "as soon as possible", preferred days and times, notes.
class BdAvailabilityControl extends StatelessWidget {
  const BdAvailabilityControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  Widget build(BuildContext context) {
    final strings = BdFormScope.of(context).strings;
    final cfg = ctx.field.scheduleConfig;
    final v = ctx.value;
    final days = (cfg?.days?.isNotEmpty ?? false) ? cfg!.days! : const ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    final windows = (cfg?.timeWindows?.isNotEmpty ?? false)
        ? cfg!.timeWindows!
        : cfg?.granularTimes == true
            ? const ['morning_8_10', 'morning_10_12', 'afternoon_12_2', 'afternoon_2_4', 'evening_4_6', 'evening_6_8']
            : const ['morning', 'afternoon', 'evening'];

    void toggle(String key, String item) {
      final cur = v?[key]?.stringArray ?? const <String>[];
      ctx.setKey(key, BdArr([for (final x in toggledList(cur, item)) BdStr(x)]));
      ctx.commit();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        if (cfg?.allowAsap != false)
          BdSwitchRow(
            label: strings.asap,
            value: v?['asap'] == const BdBool(true),
            onChanged: (on) {
              ctx.setKey('asap', BdBool(on));
              ctx.commit();
            },
          ),
        _ChipGroup(
          title: strings.preferredDays,
          items: days,
          picked: v?['days']?.stringArray ?? const [],
          name: (d) => strings.dayNames[d] ?? d,
          onToggle: (d) => toggle('days', d),
        ),
        _ChipGroup(
          title: strings.preferredTimes,
          items: windows,
          picked: v?['times']?.stringArray ?? const [],
          name: (w) => strings.timeWindowNames[w] ?? w,
          onToggle: (w) => toggle('times', w),
        ),
        if (cfg?.allowNotes != false)
          BdTextInput(
            value: v?['notes']?.stringValue ?? '',
            onChanged: (t) => ctx.setKey('notes', BdStr(t)),
            placeholder: strings.schedulingNotes,
            multiline: true,
            minLines: 2,
            maxLines: 5,
            onCommit: ctx.commit,
          ),
      ],
    );
  }
}

class _ChipGroup extends StatelessWidget {
  const _ChipGroup({required this.title, required this.items, required this.picked, required this.name, required this.onToggle});

  final String title;
  final List<String> items;
  final List<String> picked;
  final String Function(String) name;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: BdColors.of(context).muted)),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in items) BdChip(label: name(item), selected: picked.contains(item), onTap: () => onToggle(item)),
            ],
          ),
        ],
      );
}

/// Live booking: open slots from BD, grouped by day.
class BdBookingControl extends StatefulWidget {
  const BdBookingControl(this.ctx, {super.key});

  final BdFieldContext ctx;

  @override
  State<BdBookingControl> createState() => _BdBookingControlState();
}

class _BdBookingControlState extends State<BdBookingControl> {
  logic.BdDay? _day;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.ctx.controller.loadScheduleSlots(widget.ctx.field.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final scope = BdFormScope.of(context);
    final strings = scope.strings;
    final colors = BdColors.of(context);
    final theme = Theme.of(context);

    switch (scope.state.scheduleSlots[ctx.field.id]) {
      case BdLoaded(:final value):
        final slots = <({String raw, DateTime at})>[];
        for (final raw in value) {
          final ms = BdDates.parseInstant(raw);
          if (ms != null) slots.add((raw: raw, at: DateTime.fromMillisecondsSinceEpoch(ms.toInt())));
        }
        if (slots.isEmpty) return Text(strings.noOpenTimes, style: TextStyle(color: colors.muted));
        final byDay = <logic.BdDay, List<({String raw, DateTime at})>>{};
        for (final s in slots) {
          byDay.putIfAbsent(logic.dayOf(s.at), () => []).add(s);
        }
        final days = byDay.keys.toList()..sort(logic.compareDays);
        final selectedStart = ctx.value?['slotStartAt']?.stringValue;
        logic.BdDay? selectedDay;
        for (final s in slots) {
          if (s.raw == selectedStart) selectedDay = logic.dayOf(s.at);
        }
        final current = _day ?? selectedDay ?? days.first;
        final corner = scope.style.cornerRadius;
        final local = MaterialLocalizations.of(context);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                spacing: 8,
                children: [
                  for (final d in days)
                    Builder(
                      builder: (context) {
                        final on = d == current;
                        final date = logic.dateOf(d);
                        final weekday = const ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][logic.weekday(d)];
                        final month = d.m <= strings.monthNames.length ? strings.monthNames[d.m - 1] : '${d.m}';
                        final fg = on ? colors.onPrimary : colors.onSurface;
                        return Semantics(
                          button: true,
                          selected: on,
                          label: local.formatFullDate(date),
                          excludeSemantics: true,
                          child: Material(
                            color: on ? colors.primary : colors.fill,
                            borderRadius: BorderRadius.circular(corner),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(corner),
                              onTap: () => setState(() => _day = d),
                              child: SizedBox(
                                width: 56,
                                height: 68,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(strings.dayNames[weekday] ?? weekday, style: theme.textTheme.labelSmall?.copyWith(color: fg)),
                                    Text('${d.d}', style: theme.textTheme.titleMedium?.copyWith(color: fg)),
                                    Text(
                                      month.length > 3 ? month.substring(0, 3) : month,
                                      style: theme.textTheme.labelSmall?.copyWith(color: fg),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in byDay[current] ?? const <({String raw, DateTime at})>[])
                  BdChip(
                    label: _timeOfDay(context, TimeOfDay.fromDateTime(s.at)),
                    selected: s.raw == selectedStart,
                    onTap: () {
                      ctx.set(BdObj({'slotStartAt': BdStr(s.raw), if (scope.timeZone case final tz?) 'timezone': BdStr(tz)}));
                      ctx.commit();
                    },
                  ),
              ],
            ),
          ],
        );
      case BdLoadFailed(:final message):
        return BdRetryRow(message, onRetry: () => ctx.controller.loadScheduleSlots(ctx.field.id, reload: true));
      default:
        return BdLoadingRow(strings.loadingTimes);
    }
  }
}
