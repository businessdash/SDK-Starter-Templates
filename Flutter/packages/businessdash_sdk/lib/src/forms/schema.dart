import 'dart:math';

import 'json.dart';

/// Reads one JSON object leniently. A value of the wrong type reads as
/// absent, so a malformed config on one element falls back to its defaults
/// instead of taking the whole form down.
extension type const _Reader(Map<String, Object?> m) {
  static _Reader? of(Object? value) =>
      value is Map<String, Object?> ? _Reader(value) : null;

  String? str(String key) => switch (m[key]) {
        final String s => s,
        _ => null,
      };

  bool? flag(String key) => switch (m[key]) {
        final bool b => b,
        _ => null,
      };

  double? dbl(String key) => switch (m[key]) {
        final num n => n.toDouble(),
        _ => null,
      };

  int? integer(String key) => switch (m[key]) {
        final int n => n,
        final double d when d.isFinite && d == d.truncateToDouble() => d.toInt(),
        _ => null,
      };

  List<String>? strings(String key) => switch (m[key]) {
        final List<Object?> list => [
            for (final item in list)
              if (item is String) item,
          ],
        _ => null,
      };

  List<T>? list<T>(String key, T? Function(_Reader) read) => switch (m[key]) {
        final List<Object?> items => [
            for (final item in items)
              if (_Reader.of(item) case final r?)
                if (read(r) case final T value) value,
          ],
        _ => null,
      };

  T? obj<T>(String key, T? Function(_Reader) read) =>
      switch (_Reader.of(m[key])) {
        final r? => read(r),
        null => null,
      };

  BdJson? json(String key) =>
      m.containsKey(key) && m[key] != null ? BdJson.of(m[key]) : null;
}

/// A Live form as BD publishes it: `GET /api/package/v1/forms/{slug}`.
///
/// The full builder tree, not a flattened field list: layout containers,
/// condition blocks, either/or branches, repeaters, and each field's own
/// configuration. The renderer needs all of it to show the form the way the
/// BD builder previews it.
class BdFormSchema {
  const BdFormSchema({
    required this.id,
    required this.slug,
    this.title,
    this.description,
    required this.fields,
    this.settings = const BdFormSettings(),
    this.orgIcon,
    this.actions = const [],
    this.businessFunctions = const [],
  });

  final String id;
  final String slug;

  /// The form's name. BD publishes `name`; older payloads used `title`.
  final String? title;
  final String? description;
  final List<BdFormField> fields;
  final BdFormSettings settings;

  /// The org's avatar, present only when the form opts into showing it.
  final String? orgIcon;
  final List<BdFormAction> actions;

  /// Non-sensitive business functions, published so `calculation` fields
  /// compute live. Sensitive ones are computed by the server on submit.
  final List<BdBusinessFunction> businessFunctions;

  factory BdFormSchema.fromJson(Map<String, Object?> json) {
    final o = _Reader(json);
    return BdFormSchema(
      id: o.str('id') ?? '',
      slug: o.str('slug') ?? '',
      title: o.str('name') ?? o.str('title'),
      description: o.str('description'),
      fields: o.list('fields', (r) => BdFormField.fromJson(r.m)) ?? const [],
      settings: o.obj('settings', BdFormSettings._read) ?? const BdFormSettings(),
      orgIcon: o.str('orgIcon'),
      actions: o.list('actions', BdFormAction._read) ?? const [],
      businessFunctions:
          o.list('businessFunctions', BdBusinessFunction._read) ?? const [],
    );
  }

  factory BdFormSchema.parse(String text) {
    final plain = BdJson.parse(text).toPlain();
    return BdFormSchema.fromJson(
      plain is Map<String, Object?> ? plain : const {},
    );
  }
}

class BdFormSettings {
  const BdFormSettings({
    this.animation,
    this.isConsecutive,
    this.showProgress,
    this.progressStyle,
    this.exitConfirm,
    this.urlSafety,
  });

  /// `"none" | "fade" | "slide" | "scale" | "scroll"`.
  final String? animation;

  /// One top-level element per step, with Next/Back.
  final bool? isConsecutive;
  final bool? showProgress;

  /// `"bar" | "steps"`.
  final String? progressStyle;
  final BdExitConfirm? exitConfirm;

  /// The org is entitled to link-safety checks on `url` fields.
  final bool? urlSafety;

  static BdFormSettings _read(_Reader o) => BdFormSettings(
        animation: o.str('animation'),
        isConsecutive: o.flag('isConsecutive'),
        showProgress: o.flag('showProgress'),
        progressStyle: o.str('progressStyle'),
        exitConfirm: o.obj(
          'exitConfirm',
          (r) => BdExitConfirm(enabled: r.flag('enabled'), message: r.str('message')),
        ),
        urlSafety: o.flag('urlSafety'),
      );
}

class BdExitConfirm {
  const BdExitConfirm({this.enabled, this.message});

  final bool? enabled;
  final String? message;
}

/// A post-submit action, previewed so a form can say "you'll get coupon X".
class BdFormAction {
  const BdFormAction({required this.type, this.coupon});

  final String type;
  final BdCoupon? coupon;

  static BdFormAction? _read(_Reader o) {
    final type = o.str('type');
    if (type == null) return null;
    return BdFormAction(
      type: type,
      coupon: o.obj(
        'coupon',
        (r) => BdCoupon(
          code: r.str('code'),
          notice: r.str('notice'),
          finePrint: r.str('finePrint'),
        ),
      ),
    );
  }
}

class BdCoupon {
  const BdCoupon({this.code, this.notice, this.finePrint});

  final String? code;
  final String? notice;
  final String? finePrint;
}

class BdBusinessFunction {
  const BdBusinessFunction({
    required this.id,
    required this.slug,
    required this.inputs,
    required this.outputs,
  });

  final String id;
  final String slug;
  final List<BdFunctionInput> inputs;
  final List<BdFunctionOutput> outputs;

  factory BdBusinessFunction.fromJson(Map<String, Object?> json) =>
      _read(_Reader(json)) ??
      const BdBusinessFunction(id: '', slug: '', inputs: [], outputs: []);

  static BdBusinessFunction? _read(_Reader o) {
    final id = o.str('id');
    final slug = o.str('slug');
    if (id == null || slug == null) return null;
    return BdBusinessFunction(
      id: id,
      slug: slug,
      inputs: o.list('inputs', BdFunctionInput._read) ?? const [],
      outputs: o.list('outputs', BdFunctionOutput._read) ?? const [],
    );
  }
}

class BdFunctionInput {
  const BdFunctionInput({
    required this.key,
    this.label,
    required this.type,
    this.required,
    this.defaultValue,
  });

  final String key;
  final String? label;

  /// `number | text | boolean | date | object | any`
  final String type;
  final bool? required;
  final BdJson? defaultValue;

  static BdFunctionInput? _read(_Reader o) {
    final key = o.str('key');
    final type = o.str('type');
    if (key == null || type == null) return null;
    return BdFunctionInput(
      key: key,
      label: o.str('label'),
      type: type,
      required: o.flag('required'),
      defaultValue: o.json('default'),
    );
  }
}

class BdFunctionOutput {
  const BdFunctionOutput({
    required this.key,
    this.label,
    required this.type,
    required this.formula,
    this.fallback,
  });

  final String key;
  final String? label;
  final String type;
  final String formula;
  final BdJson? fallback;

  static BdFunctionOutput? _read(_Reader o) {
    final key = o.str('key');
    final type = o.str('type');
    final formula = o.str('formula');
    if (key == null || type == null || formula == null) return null;
    return BdFunctionOutput(
      key: key,
      label: o.str('label'),
      type: type,
      formula: formula,
      fallback: o.json('fallback'),
    );
  }
}

/// A visibility rule on a `condition_block`, or on an `input_group` (which
/// makes a whole page conditional in a stepped form).
class BdConditionRule {
  const BdConditionRule({
    this.fieldId,
    this.operator,
    this.value,
    this.clauses,
    this.match,
    this.matchField,
  });

  final String? fieldId;

  /// Legacy single clause, read as the first clause.
  final String? operator;
  final String? value;
  final List<BdClause>? clauses;

  /// `"all"` (default) or `"any"`.
  final String? match;

  /// For a `collection_select` source: compare this column of the chosen
  /// record (`"__label__"` = its label) instead of the stored record id.
  final String? matchField;

  factory BdConditionRule.fromJson(Map<String, Object?> json) => _read(_Reader(json));

  static BdConditionRule _read(_Reader o) => BdConditionRule(
        fieldId: o.str('fieldId'),
        operator: o.str('operator'),
        value: o.str('value'),
        clauses: o.list('clauses', (r) {
          final op = r.str('operator');
          return op == null ? null : BdClause(op, r.str('value'));
        }),
        match: o.str('match'),
        matchField: o.str('matchField'),
      );
}

class BdClause {
  const BdClause(this.operator, [this.value]);

  final String operator;
  final String? value;
}

/// One node of the form tree: an input, a static block, or a container.
///
/// [type] stays a string. A form built tomorrow can use an element this
/// build has never heard of, and the right behaviour then is to decode it,
/// keep its value, and fall back to a plain text input, not to fail the
/// whole form.
class BdFormField {
  BdFormField._(this.raw, _Reader o)
      : id = o.str('id') ?? _uuid(),
        type = o.str('type') ?? 'text',
        label = o.str('label') ?? '',
        required = o.flag('required') ?? false,
        key = o.str('key'),
        outputKey = o.str('outputKey'),
        content = o.str('content'),
        moreContent = o.str('moreContent'),
        placeholder = o.str('placeholder'),
        helpText = o.str('helpText'),
        stepTitle = o.str('stepTitle'),
        regexPattern = o.str('regexPattern'),
        options = o.strings('options'),
        optionIcons = switch (o.m['optionIcons']) {
          final Map<String, Object?> icons => {
              for (final e in icons.entries)
                if (e.value is String) e.key: e.value as String,
            },
          _ => null,
        },
        defaultValue = o.json('defaultValue'),
        display = o.str('display'),
        allowCustom = o.flag('allowCustom'),
        allowDecimal = o.flag('allowDecimal'),
        allowNegative = o.flag('allowNegative'),
        mustBeTrue = o.flag('mustBeTrue'),
        autocomplete = o.str('autocomplete'),
        concurrentReveal = o.flag('concurrentReveal'),
        showGroupLabel = o.flag('showGroupLabel'),
        explodeOptions = o.flag('explodeOptions'),
        explodeMonthYear = o.flag('explodeMonthYear'),
        referenceFieldId = o.str('referenceFieldId'),
        conditionRule = o.obj('conditionRule', BdConditionRule._read),
        validation = o.obj(
          'validation',
          (r) => BdValidation(min: r.dbl('min'), max: r.dbl('max')),
        ),
        children = o.list('children', (r) => BdFormField.fromJson(r.m)),
        emailConfig = o.obj(
          'emailConfig',
          (r) => BdEmailConfig(businessOnly: r.flag('businessOnly')),
        ),
        nameConfig = o.obj(
          'nameConfig',
          (r) => BdNameConfig(
            prefix: r.flag('prefix'),
            middle: r.flag('middle'),
            suffix: r.flag('suffix'),
            nicknames: r.flag('nicknames'),
          ),
        ),
        phoneConfig = o.obj(
          'phoneConfig',
          (r) => BdPhoneConfig(
            format: r.str('format'),
            international: r.flag('international'),
            showFlags: r.flag('showFlags'),
          ),
        ),
        textareaConfig = o.obj(
          'textareaConfig',
          (r) => BdTextareaConfig(rows: r.integer('rows'), resizable: r.flag('resizable')),
        ),
        richTextConfig = o.obj(
          'richTextConfig',
          (r) => BdRichTextConfig(minHeight: r.dbl('minHeight')),
        ),
        sliderConfig = o.obj(
          'sliderConfig',
          (r) => BdSliderConfig(
            min: r.dbl('min'),
            max: r.dbl('max'),
            step: r.dbl('step'),
            unit: r.str('unit'),
          ),
        ),
        imageConfig = o.obj(
          'imageConfig',
          (r) => BdImageConfig(
            src: r.str('src'),
            alt: r.str('alt'),
            width: r.dbl('width'),
            height: r.dbl('height'),
          ),
        ),
        fileConfig = o.obj(
          'fileConfig',
          (r) => BdFileConfig(
            allowedTypes: r.strings('allowedTypes'),
            maxFiles: r.integer('maxFiles'),
            maxSize: r.dbl('maxSize'),
          ),
        ),
        iconConfig = o.obj(
          'iconConfig',
          (r) => BdIconConfig(
            set: r.str('set'),
            allowedIcons: r.strings('allowedIcons'),
            columns: r.integer('columns'),
          ),
        ),
        imageInputConfig = o.obj(
          'imageInputConfig',
          (r) => BdImageInputConfig(
            allowedTypes: r.strings('allowedTypes'),
            maxSize: r.dbl('maxSize'),
            showPreview: r.flag('showPreview'),
            sources: r.str('sources'),
          ),
        ),
        flexConfig = o.obj(
          'flexConfig',
          (r) => BdFlexConfig(justify: r.str('justify'), align: r.str('align'), gap: r.dbl('gap')),
        ),
        starRatingConfig = o.obj(
          'starRatingConfig',
          (r) => BdStarRatingConfig(
            maxStars: r.integer('maxStars'),
            defaultValue: r.dbl('defaultValue'),
          ),
        ),
        dateRangeConfig = o.obj(
          'dateRangeConfig',
          (r) => BdDateRangeConfig(allowSameDay: r.flag('allowSameDay')),
        ),
        orConditionConfig = o.obj(
          'orConditionConfig',
          (r) => BdOrConditionConfig(leftLabel: r.str('leftLabel'), rightLabel: r.str('rightLabel')),
        ),
        timeConfig = o.obj(
          'timeConfig',
          (r) => BdTimeConfig(
            mode: r.str('mode'),
            format: r.str('format'),
            stepMinutes: r.integer('stepMinutes'),
          ),
        ),
        choiceConfig = o.obj(
          'choiceConfig',
          (r) => BdChoiceConfig(
            mode: r.str('mode'),
            options: r.list('options', BdChoiceOption._read),
          ),
        ),
        listConfig = o.obj(
          'listConfig',
          (r) => BdListConfig(
            variant: r.str('variant'),
            title: r.str('title'),
            items: r.list('items', (i) {
              final text = i.str('text');
              return text == null
                  ? null
                  : BdListItem(text: text, description: i.str('description'), icon: i.str('icon'));
            }),
          ),
        ),
        populatorConfig = o.obj(
          'populatorConfig',
          (r) => BdPopulatorConfig(
            maxInstances: r.integer('maxInstances'),
            minInstances: r.integer('minInstances'),
            addButtonLabel: r.str('addButtonLabel'),
            itemLabel: r.str('itemLabel'),
          ),
        ),
        unitConfig = o.obj(
          'unitConfig',
          (r) => BdUnitConfig(
            category: r.str('category'),
            units: r.strings('units'),
            mode: r.str('mode'),
            defaultUnit: r.str('defaultUnit'),
            outputUnit: r.str('outputUnit'),
            allowDecimal: r.flag('allowDecimal'),
          ),
        ),
        currencyConfig = o.obj(
          'currencyConfig',
          (r) => BdCurrencyConfig(
            currency: r.str('currency'),
            symbol: r.str('symbol'),
            allowNegative: r.flag('allowNegative'),
            allowDecimal: r.flag('allowDecimal'),
          ),
        ),
        tableConfig = o.obj(
          'tableConfig',
          (r) => BdTableConfig(
            columns: r.list('columns', (c) {
              final header = c.str('header');
              return header == null
                  ? null
                  : BdTableColumn(header: header, type: c.str('type'), align: c.str('align'));
            }),
            rows: r.list('rows', (row) => BdTableRow(cells: row.strings('cells'))),
            highlightColumn: r.integer('highlightColumn'),
          ),
        ),
        calculationConfig = o.obj('calculationConfig', BdCalculationConfig._read),
        paymentConfig = o.obj(
          'paymentConfig',
          (r) => BdPaymentConfig(
            mode: r.str('mode'),
            amountCents: r.integer('amountCents'),
            currency: r.str('currency'),
            buttonLabel: r.str('buttonLabel'),
            description: r.str('description'),
          ),
        ),
        serviceConfig = o.obj(
          'serviceConfig',
          (r) => BdServiceConfig(
            options: r.list('options', (s) {
              final id = s.str('id');
              final title = s.str('title');
              return id == null || title == null
                  ? null
                  : BdServiceOption(id: id, title: title, estimatedHours: s.dbl('estimatedHours'));
            }),
            multi: r.flag('multi'),
          ),
        ),
        scheduleConfig = o.obj(
          'scheduleConfig',
          (r) => BdScheduleConfig(
            mode: r.str('mode'),
            allowAsap: r.flag('allowAsap'),
            days: r.strings('days'),
            timeWindows: r.strings('timeWindows'),
            granularTimes: r.flag('granularTimes'),
            allowNotes: r.flag('allowNotes'),
            durationMinutes: r.dbl('durationMinutes'),
          ),
        ),
        collectionSelectConfig = o.obj(
          'collectionSelectConfig',
          (r) => BdCollectionSelectConfig(
            collectionKey: r.str('collectionKey'),
            labelField: r.str('labelField'),
            imageField: r.str('imageField'),
            valueMode: r.str('valueMode'),
            valueField: r.str('valueField'),
            multi: r.flag('multi'),
          ),
        ),
        monthYearConfig = o.obj(
          'monthYearConfig',
          (r) => BdMonthYearConfig(minYear: r.integer('minYear'), maxYear: r.integer('maxYear')),
        );

  factory BdFormField.fromJson(Map<String, Object?> json) =>
      BdFormField._(BdJson.of(json), _Reader(json));

  /// Build a field in code: previews, tests, or a form defined in the app.
  factory BdFormField.make(BdJson json) {
    final plain = json.toPlain();
    return BdFormField.fromJson(plain is Map<String, Object?> ? plain : const {});
  }

  /// The element as received; equality compares it.
  final BdJson raw;
  final String id;
  final String type;
  final String label;
  final bool required;

  /// The published output key: what the submission sends this value under.
  final String? key;
  final String? outputKey;
  final String? content;
  final String? moreContent;
  final String? placeholder;
  final String? helpText;
  final String? stepTitle;
  final String? regexPattern;
  final List<String>? options;
  final Map<String, String>? optionIcons;
  final BdJson? defaultValue;

  /// Render variant: `"checkbox"` on a boolean, `"dropdown"` on a checkbox
  /// group, `"combobox"` on a select. Never changes the value's shape.
  final String? display;
  final bool? allowCustom;
  final bool? allowDecimal;
  final bool? allowNegative;

  /// Consent: the value must be `true` to submit.
  final bool? mustBeTrue;
  final String? autocomplete;
  final bool? concurrentReveal;
  final bool? showGroupLabel;
  final bool? explodeOptions;
  final bool? explodeMonthYear;
  final String? referenceFieldId;
  final BdConditionRule? conditionRule;
  final BdValidation? validation;
  final List<BdFormField>? children;

  final BdEmailConfig? emailConfig;
  final BdNameConfig? nameConfig;
  final BdPhoneConfig? phoneConfig;
  final BdTextareaConfig? textareaConfig;
  final BdRichTextConfig? richTextConfig;
  final BdSliderConfig? sliderConfig;
  final BdImageConfig? imageConfig;
  final BdFileConfig? fileConfig;
  final BdIconConfig? iconConfig;
  final BdImageInputConfig? imageInputConfig;
  final BdFlexConfig? flexConfig;
  final BdStarRatingConfig? starRatingConfig;
  final BdDateRangeConfig? dateRangeConfig;
  final BdOrConditionConfig? orConditionConfig;
  final BdTimeConfig? timeConfig;
  final BdChoiceConfig? choiceConfig;
  final BdListConfig? listConfig;
  final BdPopulatorConfig? populatorConfig;
  final BdUnitConfig? unitConfig;
  final BdCurrencyConfig? currencyConfig;
  final BdTableConfig? tableConfig;
  final BdCalculationConfig? calculationConfig;
  final BdPaymentConfig? paymentConfig;
  final BdServiceConfig? serviceConfig;
  final BdScheduleConfig? scheduleConfig;
  final BdCollectionSelectConfig? collectionSelectConfig;
  final BdMonthYearConfig? monthYearConfig;

  /// The key this value is submitted under.
  String get submissionKey => key ?? id;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is BdFormField && other.id == id && other.raw == raw);

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'BdFormField($type $id)';

  static final _random = Random();

  static String _uuid() {
    String hex(int n) => [
          for (var i = 0; i < n; i++) _random.nextInt(16).toRadixString(16),
        ].join();
    return '${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[_random.nextInt(4)]}${hex(3)}-${hex(12)}';
  }
}

class BdValidation {
  const BdValidation({this.min, this.max});

  final double? min;
  final double? max;
}

class BdEmailConfig {
  const BdEmailConfig({this.businessOnly});

  final bool? businessOnly;
}

class BdNameConfig {
  const BdNameConfig({this.prefix, this.middle, this.suffix, this.nicknames});

  final bool? prefix;
  final bool? middle;
  final bool? suffix;
  final bool? nicknames;
}

class BdPhoneConfig {
  const BdPhoneConfig({this.format, this.international, this.showFlags});

  final String? format;
  final bool? international;
  final bool? showFlags;
}

class BdTextareaConfig {
  const BdTextareaConfig({this.rows, this.resizable});

  final int? rows;
  final bool? resizable;
}

class BdRichTextConfig {
  const BdRichTextConfig({this.minHeight});

  final double? minHeight;
}

class BdSliderConfig {
  const BdSliderConfig({this.min, this.max, this.step, this.unit});

  final double? min;
  final double? max;
  final double? step;

  /// `"currency" | "percent"` or absent.
  final String? unit;
}

class BdImageConfig {
  const BdImageConfig({this.src, this.alt, this.width, this.height});

  final String? src;
  final String? alt;
  final double? width;
  final double? height;
}

class BdFileConfig {
  const BdFileConfig({this.allowedTypes, this.maxFiles, this.maxSize});

  final List<String>? allowedTypes;
  final int? maxFiles;

  /// Megabytes.
  final double? maxSize;
}

class BdIconConfig {
  const BdIconConfig({this.set, this.allowedIcons, this.columns});

  final String? set;
  final List<String>? allowedIcons;
  final int? columns;
}

class BdImageInputConfig {
  const BdImageInputConfig({this.allowedTypes, this.maxSize, this.showPreview, this.sources});

  final List<String>? allowedTypes;

  /// Megabytes; 5 when absent.
  final double? maxSize;
  final bool? showPreview;

  /// `"both" | "upload" | "url"`.
  final String? sources;
}

class BdFlexConfig {
  const BdFlexConfig({this.justify, this.align, this.gap});

  final String? justify;
  final String? align;
  final double? gap;
}

class BdStarRatingConfig {
  const BdStarRatingConfig({this.maxStars, this.defaultValue});

  final int? maxStars;
  final double? defaultValue;
}

class BdDateRangeConfig {
  const BdDateRangeConfig({this.allowSameDay});

  final bool? allowSameDay;
}

class BdOrConditionConfig {
  const BdOrConditionConfig({this.leftLabel, this.rightLabel});

  final String? leftLabel;
  final String? rightLabel;
}

class BdTimeConfig {
  const BdTimeConfig({this.mode, this.format, this.stepMinutes});

  /// `"simple" | "time_block" | "appointment"`.
  final String? mode;

  /// `"12h" | "24h"`.
  final String? format;
  final int? stepMinutes;
}

class BdChoiceConfig {
  const BdChoiceConfig({this.mode, this.options});

  /// `"single" | "multi"`.
  final String? mode;
  final List<BdChoiceOption>? options;
}

class BdChoiceOption {
  const BdChoiceOption({
    required this.label,
    this.icon,
    this.imageUrl,
    this.price,
    this.description,
    this.productId,
    this.href,
  });

  final String label;
  final String? icon;
  final String? imageUrl;
  final String? price;
  final String? description;
  final String? productId;
  final String? href;

  static BdChoiceOption? _read(_Reader o) {
    final label = o.str('label');
    if (label == null) return null;
    return BdChoiceOption(
      label: label,
      icon: o.str('icon'),
      imageUrl: o.str('imageUrl'),
      price: o.str('price'),
      description: o.str('description'),
      productId: o.str('productId'),
      href: o.str('href'),
    );
  }
}

class BdListConfig {
  const BdListConfig({this.variant, this.title, this.items});

  /// `"bullets" | "details"`.
  final String? variant;
  final String? title;
  final List<BdListItem>? items;
}

class BdListItem {
  const BdListItem({required this.text, this.description, this.icon});

  final String text;
  final String? description;
  final String? icon;
}

class BdPopulatorConfig {
  const BdPopulatorConfig({this.maxInstances, this.minInstances, this.addButtonLabel, this.itemLabel});

  final int? maxInstances;
  final int? minInstances;
  final String? addButtonLabel;
  final String? itemLabel;
}

class BdUnitConfig {
  const BdUnitConfig({
    this.category,
    this.units,
    this.mode,
    this.defaultUnit,
    this.outputUnit,
    this.allowDecimal,
  });

  final String? category;
  final List<String>? units;

  /// `"select" | "fixed"`.
  final String? mode;
  final String? defaultUnit;
  final String? outputUnit;
  final bool? allowDecimal;
}

class BdCurrencyConfig {
  const BdCurrencyConfig({this.currency, this.symbol, this.allowNegative, this.allowDecimal});

  final String? currency;
  final String? symbol;
  final bool? allowNegative;
  final bool? allowDecimal;
}

class BdTableConfig {
  const BdTableConfig({this.columns, this.rows, this.highlightColumn});

  final List<BdTableColumn>? columns;
  final List<BdTableRow>? rows;
  final int? highlightColumn;
}

class BdTableColumn {
  const BdTableColumn({required this.header, this.type, this.align});

  final String header;

  /// `"text" | "check"`.
  final String? type;

  /// `"left" | "center" | "right"`.
  final String? align;
}

class BdTableRow {
  const BdTableRow({this.cells});

  final List<String>? cells;
}

class BdCalculationConfig {
  const BdCalculationConfig({
    this.mode,
    this.formula,
    this.functionId,
    this.outputKey,
    this.inputMap,
    this.display,
    this.sensitive,
  });

  /// `"formula" | "function"`.
  final String? mode;
  final String? formula;
  final String? functionId;
  final String? outputKey;
  final List<BdBinding>? inputMap;
  final BdCalcDisplay? display;

  /// Computed by the server only; no value until submit.
  final bool? sensitive;

  factory BdCalculationConfig.fromJson(Map<String, Object?> json) => _read(_Reader(json));

  static BdCalculationConfig _read(_Reader o) => BdCalculationConfig(
        mode: o.str('mode'),
        formula: o.str('formula'),
        functionId: o.str('functionId'),
        outputKey: o.str('outputKey'),
        inputMap: o.list('inputMap', (b) {
          final variable = b.str('variable');
          final fieldId = b.str('fieldId');
          return variable == null || fieldId == null ? null : BdBinding(variable, fieldId);
        }),
        display: o.obj('display', BdCalcDisplay._read),
        sensitive: o.flag('sensitive'),
      );
}

class BdBinding {
  const BdBinding(this.variable, this.fieldId);

  final String variable;
  final String fieldId;
}

class BdCalcDisplay {
  const BdCalcDisplay({this.show, this.prefix, this.suffix, this.decimals});

  final bool? show;
  final String? prefix;
  final String? suffix;
  final int? decimals;

  factory BdCalcDisplay.fromJson(Map<String, Object?> json) => _read(_Reader(json));

  static BdCalcDisplay _read(_Reader o) => BdCalcDisplay(
        show: o.flag('show'),
        prefix: o.str('prefix'),
        suffix: o.str('suffix'),
        decimals: o.integer('decimals'),
      );
}

class BdPaymentConfig {
  const BdPaymentConfig({this.mode, this.amountCents, this.currency, this.buttonLabel, this.description});

  /// `"card_on_file" | "deposit"`.
  final String? mode;
  final int? amountCents;
  final String? currency;
  final String? buttonLabel;
  final String? description;
}

class BdServiceConfig {
  const BdServiceConfig({this.options, this.multi});

  final List<BdServiceOption>? options;
  final bool? multi;
}

class BdServiceOption {
  const BdServiceOption({required this.id, required this.title, this.estimatedHours});

  final String id;
  final String title;
  final double? estimatedHours;
}

class BdScheduleConfig {
  const BdScheduleConfig({
    this.mode,
    this.allowAsap,
    this.days,
    this.timeWindows,
    this.granularTimes,
    this.allowNotes,
    this.durationMinutes,
  });

  /// `"availability"` (default) or `"auto"` (instant booking).
  final String? mode;
  final bool? allowAsap;
  final List<String>? days;
  final List<String>? timeWindows;
  final bool? granularTimes;
  final bool? allowNotes;
  final double? durationMinutes;
}

class BdCollectionSelectConfig {
  const BdCollectionSelectConfig({
    this.collectionKey,
    this.labelField,
    this.imageField,
    this.valueMode,
    this.valueField,
    this.multi,
  });

  final String? collectionKey;
  final String? labelField;
  final String? imageField;
  final String? valueMode;
  final String? valueField;
  final bool? multi;
}

class BdMonthYearConfig {
  const BdMonthYearConfig({this.minYear, this.maxYear});

  final int? minYear;
  final int? maxYear;
}

/// Element type names, as BD stores them.
abstract final class BdFieldType {
  static const Set<String> staticTypes = {
    'title', 'subtitle', 'separator', 'image', 'richtext', 'body_text', 'bullet_list', 'table', //
  };

  static const Set<String> containerTypes = {
    'input_group', 'flex_row', 'condition_block', 'or_condition', //
  };

  /// Never required-checked: layout, static copy, and values the visitor
  /// doesn't type (a calculation, a hidden reference, a stepper's count).
  /// Mirrors `STATIC_OR_LAYOUT` in the server's validator.
  static const Set<String> staticOrLayout = {
    'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'condition_block', //
    'or_condition', 'image', 'richtext', 'body_text', 'bullet_list', 'table', //
    'stepper', 'calculation', 'reference_value', //
  };

  /// Carry no submitted value at all. Mirrors the server's `LAYOUT_ONLY`.
  static const Set<String> layoutOnly = {
    'title', 'subtitle', 'separator', 'flex_row', 'input_group', 'condition_block', //
    'or_condition', 'image', 'richtext', 'body_text', 'bullet_list', 'table', 'reference_value', //
  };

  /// Static/no-label elements: the field row draws no heading for them.
  static const Set<String> noLabel = {
    'title', 'subtitle', 'separator', 'richtext', 'body_text', 'bullet_list', 'table', //
  };
}
