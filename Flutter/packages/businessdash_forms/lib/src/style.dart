import 'dart:typed_data';

import 'package:businessdash_sdk/forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

/// Which platform's controls a [BdForm] draws.
enum BdControlStyle {
  /// Cupertino controls on iOS and macOS, Material everywhere else.
  adaptive,

  /// Material controls on every platform.
  material,

  /// Cupertino controls on every platform.
  cupertino,
}

/// How each question sits on the screen.
enum BdFormLayout {
  /// Questions stacked on the screen's background, like a native form.
  plain,

  /// Each question on its own rounded surface, like grouped settings.
  grouped,
}

enum BdButtonProminence { filled, tonal, outlined }

/// How a [BdForm] looks. Everything defaults to the app's theme (colors,
/// typography, shapes), so a form looks like the rest of the app. Change
/// what you want and the rest stays native.
///
/// ```dart
/// BdForm(form: 'contact', publishableKey: 'pk_live_…', style: const BdFormStyle(layout: BdFormLayout.grouped));
/// ```
@immutable
class BdFormStyle {
  const BdFormStyle({
    this.controls = BdControlStyle.adaptive,
    this.layout = BdFormLayout.plain,
    this.tint,
    this.errorColor,
    this.showsTitle = true,
    this.showsDescription = true,
    this.requiredMarker = ' *',
    this.spacing = 24,
    this.cornerRadius = 12,
    this.submitButton = BdButtonProminence.filled,
    this.animated = true,
    this.showsProgress = true,
    this.padding = const EdgeInsets.all(16),
  });

  final BdControlStyle controls;
  final BdFormLayout layout;

  /// Tint for controls, selections and the submit button. Null = the
  /// theme's primary color.
  final Color? tint;

  /// Null = the theme's error color.
  final Color? errorColor;
  final bool showsTitle;
  final bool showsDescription;

  /// Appended to required labels. Empty to hide.
  final String requiredMarker;

  /// Space between questions.
  final double spacing;

  /// Corner radius of cards, chips and grouped rows.
  final double cornerRadius;
  final BdButtonProminence submitButton;

  /// Step changes, reveals and errors animate.
  final bool animated;

  /// Show the step progress when the form asks for it.
  final bool showsProgress;

  /// Padding around the form's content.
  final EdgeInsets padding;

  BdFormStyle copyWith({
    BdControlStyle? controls,
    BdFormLayout? layout,
    Color? tint,
    Color? errorColor,
    bool? showsTitle,
    bool? showsDescription,
    String? requiredMarker,
    double? spacing,
    double? cornerRadius,
    BdButtonProminence? submitButton,
    bool? animated,
    bool? showsProgress,
    EdgeInsets? padding,
  }) =>
      BdFormStyle(
        controls: controls ?? this.controls,
        layout: layout ?? this.layout,
        tint: tint ?? this.tint,
        errorColor: errorColor ?? this.errorColor,
        showsTitle: showsTitle ?? this.showsTitle,
        showsDescription: showsDescription ?? this.showsDescription,
        requiredMarker: requiredMarker ?? this.requiredMarker,
        spacing: spacing ?? this.spacing,
        cornerRadius: cornerRadius ?? this.cornerRadius,
        submitButton: submitButton ?? this.submitButton,
        animated: animated ?? this.animated,
        showsProgress: showsProgress ?? this.showsProgress,
        padding: padding ?? this.padding,
      );
}

/// Every word the renderer shows that isn't from the form itself. Replace
/// any to reword or localize; validation messages go through [messages].
///
/// Templates use `{}` placeholders, filled in order by [format].
@immutable
class BdFormStrings {
  const BdFormStrings({
    this.next = 'Next',
    this.back = 'Back',
    this.submit = 'Submit',
    this.sending = 'Sending…',
    this.successTitle = 'Thank you',
    this.successMessage = 'Thanks — your response was received.',
    this.submitAnother = 'Submit another response',
    this.errorNotice = 'Please complete the highlighted field(s).',
    this.loading = 'Loading form…',
    this.loadFailed = "This form couldn't be loaded.",
    this.retry = 'Try again',
    this.stepOf = 'Step {} of {}',
    this.select = 'Select…',
    this.search = 'Search',
    this.noResults = 'No matches',
    this.useCustom = 'Use “{}”',
    this.done = 'Done',
    this.clear = 'Clear',
    this.cancel = 'Cancel',
    this.addAnother = 'Add another',
    this.entry = 'Entry',
    this.removeEntry = 'Remove entry',
    this.fillOneSide = 'Fill at least one side',
    this.or = 'OR',
    this.yesNo = 'Yes / No',
    this.addDate = 'Add date',
    this.addTime = 'Add time',
    this.start = 'Start',
    this.end = 'End',
    this.date = 'Date',
    this.time = 'Time',
    this.selectTime = 'Select time',
    this.month = 'Month',
    this.year = 'Year',
    this.namePrefix = 'Title',
    this.firstName = 'First name',
    this.middleName = 'Middle name',
    this.lastName = 'Last name',
    this.nameSuffix = 'Suffix',
    this.nicknames = 'Nicknames',
    this.nicknamesPlaceholder = 'Johnny, JM — separate with commas',
    this.addressLine1 = 'Address Line 1',
    this.addressLine2 = 'Address Line 2',
    this.city = 'City',
    this.state = 'State',
    this.selectState = 'Select state',
    this.zip = 'Zip',
    this.customColor = 'Custom color',
    this.hexColor = 'Hex color',
    this.chooseFiles = 'Choose files',
    this.choosePhotos = 'Choose photos',
    this.uploadsOnSubmit = 'Uploads on submit',
    this.upload = 'Upload',
    this.pasteURL = 'Paste URL',
    this.removeFile = 'Remove',
    this.addTag = 'Add a tag',
    this.removeTag = 'Remove {}',
    this.asap = 'As soon as possible',
    this.preferredDays = 'Preferred days',
    this.preferredTimes = 'Preferred times',
    this.schedulingNotes = 'Anything we should know about timing?',
    this.loadingTimes = 'Loading available times…',
    this.noOpenTimes = 'No open times in the next few weeks.',
    this.loadingOptions = 'Loading options…',
    this.calculatedOnSubmit = 'Calculated on submit.',
    this.cardOnFile = 'Card on file',
    this.deposit = 'Deposit',
    this.addCard = 'Add card',
    this.cardSaved = 'Card saved',
    this.searchIcons = 'Search icons…',
    this.view = 'View',
    this.hour = 'hr',
    this.hours = 'hrs',
    this.ratingOf = '{} of {}',
    this.increase = 'Increase',
    this.decrease = 'Decrease',
    this.couponApplied = 'Coupon {} will be applied to this submission.',
    this.exitTitle = 'Leave this form?',
    this.exitMessage = "Your answers haven't been sent.",
    this.exitLeave = 'Leave',
    this.exitStay = 'Keep editing',
    this.bold = 'Bold',
    this.italic = 'Italic',
    this.strikethrough = 'Strikethrough',
    this.bulletList = 'Bulleted list',
    this.numberedList = 'Numbered list',
    this.filePickerMissing = "File picking isn't set up in this app.",
    this.dayNames = const {
      'mon': 'Mon',
      'tue': 'Tue',
      'wed': 'Wed',
      'thu': 'Thu',
      'fri': 'Fri',
      'sat': 'Sat',
      'sun': 'Sun',
    },
    this.timeWindowNames = const {
      'morning': 'Morning',
      'afternoon': 'Afternoon',
      'evening': 'Evening',
      'morning_8_10': '8–10 AM',
      'morning_10_12': '10 AM–12 PM',
      'afternoon_12_2': '12–2 PM',
      'afternoon_2_4': '2–4 PM',
      'evening_4_6': '4–6 PM',
      'evening_6_8': '6–8 PM',
    },
    this.monthNames = const [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    this.happinessNames = const ['Very unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very happy'],
    this.messages = BdFormMessages.message,
  });

  final String next, back, submit, sending, successTitle, successMessage, submitAnother, errorNotice;
  final String loading, loadFailed, retry, stepOf, select, search, noResults, useCustom, done, clear, cancel;
  final String addAnother, entry, removeEntry, fillOneSide, or, yesNo, addDate, addTime, start, end, date, time;
  final String selectTime, month, year, namePrefix, firstName, middleName, lastName, nameSuffix, nicknames;
  final String nicknamesPlaceholder, addressLine1, addressLine2, city, state, selectState, zip, customColor;
  final String hexColor, chooseFiles, choosePhotos, uploadsOnSubmit, upload, pasteURL, removeFile, addTag;
  final String removeTag, asap, preferredDays, preferredTimes, schedulingNotes, loadingTimes, noOpenTimes;
  final String loadingOptions, calculatedOnSubmit, cardOnFile, deposit, addCard, cardSaved, searchIcons, view;
  final String hour, hours, ratingOf, increase, decrease, couponApplied, exitTitle, exitMessage, exitLeave;
  final String exitStay, bold, italic, strikethrough, bulletList, numberedList, filePickerMissing;
  final Map<String, String> dayNames;
  final Map<String, String> timeWindowNames;

  /// January first.
  final List<String> monthNames;
  final List<String> happinessNames;

  /// Validation messages, by reason (`required`, `format`, `max`, …).
  final BdMessages messages;

  /// Fills each `{}` in [template] with the next of [args].
  String format(String template, List<Object> args) {
    var i = 0;
    return template.replaceAllMapped('{}', (_) => i < args.length ? '${args[i++]}' : '');
  }
}

/// What the app's file picker is asked for.
@immutable
class BdFileRequest {
  const BdFileRequest({required this.kind, required this.multiple, required this.allowedTypes});

  /// `files` (any document) or `images` (the photo library).
  final String kind;
  final bool multiple;

  /// The author's allowed types: MIME types, `image/*`, or `.pdf`-style
  /// extensions. Empty = any.
  final List<String> allowedTypes;
}

/// Opens the app's document or photo picker. Return `[]` when the visitor
/// cancels. Wire it to `file_picker` / `image_picker` (see the starter's
/// form page), or any picker that gives back bytes.
typedef BdFilePicker = Future<List<BdPickedFile>> Function(BdFileRequest request);

/// Opens a link the visitor tapped (choice cards' "View", links in rich
/// text). Wire it to `url_launcher`. Without one, links aren't tappable.
typedef BdLinkOpener = Future<void> Function(Uri uri);

/// What a custom renderer gets: the field, its value and error, and the
/// controller to write through.
class BdFieldContext {
  BdFieldContext(this.field, this.path, this.controller);

  final BdFormField field;
  final BdFieldPath path;
  final BdFormController controller;

  BdJson? get value => controller.valueAt(path);
  String? get error => controller.errorAt(path);

  /// The value as text, for string-valued fields.
  String get text => value?.stringValue ?? '';

  void set(BdJson? value) => controller.setValueAt(value, path);

  void setText(String text) => set(BdStr(text));

  /// Call when the visitor leaves the control, to show a format problem.
  void commit() => controller.validate(path);

  /// Write one key of an object-valued field (an address, a URL, a range).
  void setKey(String key, BdJson v) {
    final next = Map<String, BdJson>.of(value?.objectValue ?? const {});
    next[key] = v;
    set(BdObj(next));
  }
}

/// Draws one field. The field's label, help and error are still drawn
/// around it.
typedef BdFieldRenderer = Widget Function(BuildContext context, BdFieldContext field);

/// Replace how an element type, or one specific field, is drawn.
///
/// ```dart
/// final renderers = const BdFieldRenderers()
///     .forType('star_rating', (context, f) => MyStars(f.value?.doubleValue ?? 0, onChanged: (v) => f.set(BdNum(v))));
/// BdForm(form: 'feedback', publishableKey: key, renderers: renderers);
/// ```
@immutable
class BdFieldRenderers {
  const BdFieldRenderers() : _byType = const {}, _byField = const {};

  const BdFieldRenderers._(this._byType, this._byField);

  final Map<String, BdFieldRenderer> _byType;
  final Map<String, BdFieldRenderer> _byField;

  /// Draw every field of [type] with [render].
  BdFieldRenderers forType(String type, BdFieldRenderer render) =>
      BdFieldRenderers._({..._byType, type: render}, _byField);

  /// Draw one field, by id or output key, with [render].
  BdFieldRenderers forField(String idOrKey, BdFieldRenderer render) =>
      BdFieldRenderers._(_byType, {..._byField, idOrKey: render});

  BdFieldRenderer? rendererFor(BdFormField field) =>
      _byField[field.id] ?? (field.key == null ? null : _byField[field.key]) ?? _byType[field.type];
}

const bdDefaultHost = 'https://businessdash.us';

/// Everything a control reaches beyond its own value, handed down the tree.
/// Rebuilt with each new snapshot, so reading it subscribes a widget to
/// every change.
class BdFormScope extends InheritedWidget {
  const BdFormScope({
    super.key,
    required this.controller,
    required this.state,
    required this.style,
    required this.strings,
    required this.renderers,
    required this.cupertino,
    required this.iconBaseUrl,
    required this.pickFiles,
    required this.openLink,
    required this.timeZone,
    required this.scrollTargets,
    required super.child,
  });

  final BdFormController controller;
  final BdFormState state;
  final BdFormStyle style;
  final BdFormStrings strings;
  final BdFieldRenderers renderers;

  /// Cupertino controls rather than Material ones.
  final bool cupertino;
  final String iconBaseUrl;
  final BdFilePicker? pickFiles;
  final BdLinkOpener? openLink;
  final String? timeZone;

  /// Rows register here so an attempt with errors can scroll to the first.
  final Map<String, GlobalKey> scrollTargets;

  static BdFormScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<BdFormScope>();
    assert(scope != null, 'No BdForm above this widget.');
    return scope!;
  }

  /// The same scope over [child]: for sheets and dialogs, whose routes sit
  /// above the form in the tree.
  BdFormScope over(Widget child) => BdFormScope(
        controller: controller,
        state: state,
        style: style,
        strings: strings,
        renderers: renderers,
        cupertino: cupertino,
        iconBaseUrl: iconBaseUrl,
        pickFiles: pickFiles,
        openLink: openLink,
        timeZone: timeZone,
        scrollTargets: scrollTargets,
        child: child,
      );

  @override
  bool updateShouldNotify(BdFormScope old) =>
      state != old.state ||
      style != old.style ||
      strings != old.strings ||
      renderers != old.renderers ||
      cupertino != old.cupertino ||
      iconBaseUrl != old.iconBaseUrl ||
      pickFiles != old.pickFiles ||
      openLink != old.openLink ||
      timeZone != old.timeZone;
}

/// Set inside a surface (a repeater entry, an either/or box): rows there
/// don't draw their own.
class BdInCard extends InheritedWidget {
  const BdInCard({super.key, required super.child});

  static bool of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<BdInCard>() != null;

  @override
  bool updateShouldNotify(BdInCard oldWidget) => false;
}

/// Colors a form draws with, from the app's theme and the form's style.
class BdColors {
  BdColors._(this.scheme, this.error, this.cupertino, this.context);

  factory BdColors.of(BuildContext context) {
    final scope = BdFormScope.of(context);
    final scheme = Theme.of(context).colorScheme;
    return BdColors._(scheme, scope.style.errorColor ?? scheme.error, scope.cupertino, context);
  }

  final ColorScheme scheme;
  final Color error;
  final bool cupertino;
  final BuildContext context;

  Color get primary => scheme.primary;
  Color get onPrimary => scheme.onPrimary;
  Color get onSurface => scheme.onSurface;
  Color get muted => cupertino ? CupertinoColors.secondaryLabel.resolveFrom(context) : scheme.onSurfaceVariant;
  Color get outline => cupertino ? CupertinoColors.separator.resolveFrom(context) : scheme.outline;
  Color get outlineVariant => cupertino ? CupertinoColors.separator.resolveFrom(context) : scheme.outlineVariant;

  /// A grouped row or card.
  Color get card =>
      cupertino ? CupertinoColors.secondarySystemGroupedBackground.resolveFrom(context) : scheme.surfaceContainerLow;

  /// A card inside a card.
  Color get innerCard =>
      cupertino ? CupertinoColors.tertiarySystemGroupedBackground.resolveFrom(context) : scheme.surfaceContainer;

  /// Unselected chips, swatches, tiles.
  Color get fill => cupertino ? CupertinoColors.tertiarySystemFill.resolveFrom(context) : scheme.surfaceContainerHighest;

  /// A text field's background on iOS.
  Color get field => cupertino ? CupertinoColors.tertiarySystemFill.resolveFrom(context) : Colors.transparent;
}

/// A picked file's bytes, as an image provider for a preview.
ImageProvider<Object> bdMemoryImage(Uint8List bytes) => MemoryImage(bytes);

extension BdNonEmpty on String? {
  /// This string, or null when it's null or empty.
  String? get nonEmpty => this == null || this!.isEmpty ? null : this;
}

extension BdDisplayText on BdJson? {
  /// `String(value)` for display, empty for null.
  String get displayText => this == null || this!.isNull ? '' : BdJS.string(this);
}
