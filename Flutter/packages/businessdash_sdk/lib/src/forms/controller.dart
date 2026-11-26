import 'dart:async';
import 'dart:math';

import 'backend.dart';
import 'calculation.dart';
import 'formula.dart';
import 'json.dart';
import 'rules.dart';
import 'schema.dart';

/// One step into a repeater: entry [index] of repeater [repeaterId].
typedef BdEntry = ({String repeaterId, int index});

/// Where a value lives: a field id, inside zero or more repeater entries.
class BdFieldPath {
  const BdFieldPath(this.fieldId, [this.entries = const []]);

  final String fieldId;
  final List<BdEntry> entries;

  /// `email`, or `kids[1].name` inside a repeater. Errors are keyed by this.
  String get key =>
      '${entries.map((e) => '${e.repeaterId}[${e.index}].').join()}$fieldId';

  BdFieldPath child(String id) => BdFieldPath(id, entries);

  /// The entries a field inside this repeater's entry [index] sits in.
  List<BdEntry> entry(int index) =>
      [...entries, (repeaterId: fieldId, index: index)];

  @override
  bool operator ==(Object other) => other is BdFieldPath && other.key == key;

  @override
  int get hashCode => key.hashCode;

  @override
  String toString() => 'BdFieldPath($key)';
}

/// Something loaded from BD on demand: collection options, booking times.
sealed class BdLoadState<T> {
  const BdLoadState();

  T? get valueOrNull => switch (this) {
        BdLoaded<T>(:final value) => value,
        _ => null,
      };
}

final class BdLoadIdle<T> extends BdLoadState<T> {
  const BdLoadIdle();
}

final class BdLoading<T> extends BdLoadState<T> {
  const BdLoading();
}

final class BdLoaded<T> extends BdLoadState<T> {
  const BdLoaded(this.value);

  final T value;
}

final class BdLoadFailed<T> extends BdLoadState<T> {
  const BdLoadFailed(this.message);

  final String message;
}

/// Where the form itself is: not loaded, loading, ready, or failed.
sealed class BdFormPhase {
  const BdFormPhase();
}

final class BdPhaseIdle extends BdFormPhase {
  const BdPhaseIdle();
}

final class BdPhaseLoading extends BdFormPhase {
  const BdPhaseLoading();
}

final class BdPhaseReady extends BdFormPhase {
  const BdPhaseReady();
}

final class BdPhaseFailed extends BdFormPhase {
  const BdPhaseFailed(this.message);

  final String message;
}

/// Options sent with every submit.
class BdSubmitOptions {
  const BdSubmitOptions({
    this.submitterEmail,
    this.submitterName,
    this.dryRun = false,
    this.source = 'flutter-app',
    this.referrer,
    this.metadata,
  });

  final String? submitterEmail;
  final String? submitterName;
  final bool dryRun;

  /// Where the submission came from, e.g. `flutter-app`.
  final String? source;
  final String? referrer;
  final Map<String, BdJson>? metadata;
}

const Object _keep = Object();

/// Everything a form UI draws from, as one immutable snapshot.
class BdFormState {
  const BdFormState({
    this.phase = const BdPhaseIdle(),
    this.schema,
    this.values = const {},
    this.errors = const {},
    this.step = 0,
    this.movingForward = true,
    this.isSubmitting = false,
    this.uploadingCount = 0,
    this.result,
    this.hasAttempted = false,
    this.errorScrollToken = 0,
    this.collectionOptions = const {},
    this.scheduleSlots = const {},
  });

  final BdFormPhase phase;
  final BdFormSchema? schema;
  final Map<String, BdJson> values;

  /// Field path key → message.
  final Map<String, String> errors;
  final int step;
  final bool movingForward;
  final bool isSubmitting;
  final int uploadingCount;
  final BdSubmitResult? result;

  /// Set when the visitor has tried to submit or advance: from then on
  /// required errors show as they edit, not just on the next attempt.
  final bool hasAttempted;

  /// Bumped each time an attempt surfaces errors, so a view can scroll to
  /// the first one.
  final int errorScrollToken;
  final Map<String, BdLoadState<List<BdCollectionOption>>> collectionOptions;
  final Map<String, BdLoadState<List<String>>> scheduleSlots;

  BdFormState copyWith({
    BdFormPhase? phase,
    BdFormSchema? schema,
    Map<String, BdJson>? values,
    Map<String, String>? errors,
    int? step,
    bool? movingForward,
    bool? isSubmitting,
    int? uploadingCount,
    Object? result = _keep,
    bool? hasAttempted,
    int? errorScrollToken,
    Map<String, BdLoadState<List<BdCollectionOption>>>? collectionOptions,
    Map<String, BdLoadState<List<String>>>? scheduleSlots,
  }) =>
      BdFormState(
        phase: phase ?? this.phase,
        schema: schema ?? this.schema,
        values: values ?? this.values,
        errors: errors ?? this.errors,
        step: step ?? this.step,
        movingForward: movingForward ?? this.movingForward,
        isSubmitting: isSubmitting ?? this.isSubmitting,
        uploadingCount: uploadingCount ?? this.uploadingCount,
        result:
            identical(result, _keep) ? this.result : result as BdSubmitResult?,
        hasAttempted: hasAttempted ?? this.hasAttempted,
        errorScrollToken: errorScrollToken ?? this.errorScrollToken,
        collectionOptions: collectionOptions ?? this.collectionOptions,
        scheduleSlots: scheduleSlots ?? this.scheduleSlots,
      );
}

/// What a visitor reads for a problem: `(reason, label, field) → message`.
typedef BdMessages = String Function(
    String reason, String label, BdFormField? field);

/// Collects a card for a `credit_card` field and returns the confirmed
/// intent id.
typedef BdPaymentHandler = Future<String> Function(
    BdPaymentIntent intent, BdFormField field);

/// The headless form: state and behaviour, no UI.
///
/// The Flutter `BdForm` widget renders one of these, and an app that wants
/// its own UI can drive it directly. It is the native `useForm`: values,
/// errors, steps and submission, with BD's rules applied exactly as the
/// server applies them.
///
/// ```dart
/// final form = BdFormController('contact', backend: backend)..load();
///
/// ListenableBuilder(
///   listenable: form.listenable, // from businessdash_forms
///   builder: (context, _) => TextField(
///     onChanged: (text) => form.setValue(BdStr(text), 'email'),
///     decoration: InputDecoration(errorText: form.error('email')),
///   ),
/// );
/// ```
///
/// State lives in [state]; every mutation publishes a new snapshot and calls
/// the listeners. Call it from the UI isolate, as a UI does.
class BdFormController {
  BdFormController(this.form,
      {required BdFormsBackend this.backend,
      this.submitOptions = const BdSubmitOptions()});

  /// A form you already have (prefetched, bundled, or built in code). Pass a
  /// backend to be able to submit it.
  BdFormController.fromSchema(BdFormSchema schema,
      {this.backend, this.submitOptions = const BdSubmitOptions()})
      : form = schema.slug {
    _adopt(schema);
  }

  final BdFormsBackend? backend;

  /// The form's slug.
  final String form;
  BdSubmitOptions submitOptions;

  BdFormState _state = const BdFormState();

  /// The current snapshot.
  BdFormState get state => _state;

  final _listeners = <void Function()>[];
  final _changes = StreamController<BdFormState>.broadcast(sync: true);
  var _disposed = false;

  /// Every new snapshot, as it's published.
  Stream<BdFormState> get changes => _changes.stream;

  void addListener(void Function() listener) => _listeners.add(listener);

  void removeListener(void Function() listener) => _listeners.remove(listener);

  /// Stop publishing. Work in flight finishes quietly.
  void dispose() {
    _disposed = true;
    _listeners.clear();
    _changes.close();
  }

  void _update(BdFormState Function(BdFormState s) change) {
    _state = change(_state);
    if (_disposed) return;
    for (final listener in List.of(_listeners)) {
      listener();
    }
    _changes.add(_state);
  }

  void Function(BdSubmitSuccess)? onSuccess;
  void Function(BdSubmitFailure)? onFailure;

  /// Collect a card for a `credit_card` field. BD creates the Stripe intent
  /// on the org's connected account; your handler presents Stripe's own
  /// sheet with it and returns the confirmed intent id. Card details never
  /// pass through this package or BD.
  BdPaymentHandler? paymentHandler;

  /// What a visitor reads for a problem. Replace to localize or reword.
  BdMessages messages = BdFormMessages.message;

  String _message(String reason, String label, BdFormField? field) =>
      messages(reason, label, field);

  final _pendingFiles = <String, BdPickedFile>{};
  Map<String, BdJson> _seed = const {};
  Map<String, BdBusinessFunction> _functionsById = const {};
  Map<String, BdUserFunction> _userFunctions = const {};
  List<BdFormField> _calcFields = const [];
  Map<String, BdFormField> _fieldIndex = const {};

  /// Fetch the form. Safe to call again (a retry after a failure).
  Future<void> load() async {
    if (_state.phase is BdPhaseReady) return;
    final backend = this.backend;
    if (backend == null) {
      _update((s) =>
          s.copyWith(phase: BdPhaseFailed('No backend to load "$form" from.')));
      return;
    }
    _update((s) => s.copyWith(phase: const BdPhaseLoading()));
    try {
      _adopt(await backend.schema(form));
    } on BdFormsException catch (e) {
      _update((s) => s.copyWith(phase: BdPhaseFailed(e.message)));
    } catch (_) {
      _update((s) =>
          s.copyWith(phase: const BdPhaseFailed("Couldn't load the form.")));
    }
  }

  void _adopt(BdFormSchema loaded) {
    _fieldIndex = BdFormRules.fieldsById(loaded.fields);
    // First definition wins on a duplicate, as on the other platforms.
    final reversed = loaded.businessFunctions.reversed;
    _functionsById = {for (final f in reversed) f.id: f};
    _userFunctions = BdFormula.userFunctions(
        {for (final f in reversed) f.slug.toUpperCase(): f});
    _calcFields = [
      for (final f in _fieldIndex.values)
        if (f.type == 'calculation') f
    ];
    _seed = _applyCalcs(BdFormRules.seedInitialData(loaded.fields));
    _pendingFiles.clear();
    _update(
      (s) => s.copyWith(
        phase: const BdPhaseReady(),
        schema: loaded,
        values: _seed,
        errors: const {},
        step: 0,
        movingForward: true,
        result: null,
        hasAttempted: false,
      ),
    );
    // Conditions that compare a collection record's column need the records
    // loaded before they can evaluate.
    for (final f in _fieldIndex.values) {
      final rule = f.conditionRule;
      final source = rule?.fieldId;
      if (rule?.matchField != null && source != null) {
        unawaited(loadCollectionOptions(source));
      }
    }
  }

  // ── Schema accessors ───────────────────────────────────────────────────

  BdFormPhase get phase => _state.phase;
  BdFormSchema? get schema => _state.schema;
  Map<String, BdJson> get values => _state.values;
  Map<String, String> get errors => _state.errors;
  List<BdFormField> get fields => _state.schema?.fields ?? const [];
  BdFormSettings get settings =>
      _state.schema?.settings ?? const BdFormSettings();

  BdFormField? field(String id) => _fieldIndex[id];

  bool get isConsecutive => settings.isConsecutive == true;

  /// The steps the visitor will walk: one holding everything, or one per
  /// visible top-level element. Re-derived as answers change, because a
  /// condition can add or remove a page.
  List<List<BdFormField>> get steps =>
      BdFormRules.computeSteps(fields, isConsecutive, resolver(const []));

  int get stepCount => max(steps.length, 1);
  int get currentStep => _state.step.clamp(0, stepCount - 1);

  List<BdFormField> get visibleFields {
    if (!isConsecutive) return fields;
    final all = steps;
    return currentStep < all.length ? all[currentStep] : const [];
  }

  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => currentStep == stepCount - 1;
  double get progress => (currentStep + 1) / stepCount;

  String stepTitle(int index) {
    final all = steps;
    final f = index >= 0 && index < all.length && all[index].isNotEmpty
        ? all[index].first
        : null;
    if (f?.stepTitle case final title?) return title;
    if (f != null && f.label.isNotEmpty) return f.label;
    return 'Step ${index + 1}';
  }

  bool get canAdvance {
    final all = steps;
    return _problems(currentStep < all.length ? all[currentStep] : const [])
        .isEmpty;
  }

  bool get canSubmit => _problems(fields).isEmpty;
  bool get isSubmitted => _state.result?.isSuccess == true;

  /// Anything changed since the form loaded (for an exit confirmation).
  bool get isDirty => BdObj(_state.values) != BdObj(_seed);

  // ── Values ─────────────────────────────────────────────────────────────

  BdJson? valueAt(BdFieldPath path) => scopeValues(path.entries)[path.fieldId];

  BdJson? value(String id) => _state.values[id];

  void setValueAt(BdJson? value, BdFieldPath path) {
    _update(
        (s) => s.copyWith(values: _applyCalcs(write(value, path, s.values))));
    _revalidate(path);
  }

  void setValue(BdJson? value, String id) => setValueAt(value, BdFieldPath(id));

  /// The values a field inside these repeater entries sees.
  Map<String, BdJson> scopeValues(List<BdEntry> entries) {
    var scope = _state.values;
    for (final e in entries) {
      final list = scope[e.repeaterId]?.arrayValue;
      scope = (list != null && e.index < list.length
              ? list[e.index].objectValue
              : null) ??
          const {};
    }
    return scope;
  }

  Map<String, BdJson> _applyCalcs(Map<String, BdJson> vals) {
    if (_calcFields.isEmpty) return vals;
    final next = Map<String, BdJson>.of(vals);
    for (final f in _calcFields) {
      final cfg = f.calculationConfig;
      if (cfg == null) continue;
      final r = BdCalculation.compute(
        cfg,
        (id) => next[id],
        functionsById: _functionsById,
        userFunctions: _userFunctions,
      );
      next[f.id] = r.ok ? r.value ?? const BdNull() : const BdNull();
    }
    return next;
  }

  // ── Repeaters ──────────────────────────────────────────────────────────

  List<Map<String, BdJson>> entries(BdFieldPath repeater) {
    final objects = [
      for (final item in valueAt(repeater)?.arrayValue ?? const <BdJson>[])
        item.objectValue ?? const <String, BdJson>{},
    ];
    return objects.isEmpty ? [const {}] : objects;
  }

  void addEntry(BdFieldPath repeater) {
    final f = field(repeater.fieldId);
    if (f == null) return;
    final list = entries(repeater);
    if (list.length >= (f.populatorConfig?.maxInstances ?? 10)) return;
    setValueAt(
        BdArr([
          for (final e in [...list, const <String, BdJson>{}]) BdObj(e)
        ]),
        repeater);
  }

  void removeEntry(int index, BdFieldPath repeater) {
    final list = [...entries(repeater)];
    if (index < 0 || index >= list.length || list.length <= 1) return;
    list.removeAt(index);
    // Errors are keyed by entry index; shifting entries invalidates them.
    final prefix = '${repeater.key}[';
    _update(
      (s) => s.copyWith(
        errors: {
          for (final e in s.errors.entries)
            if (!e.key.startsWith(prefix)) e.key: e.value,
        },
      ),
    );
    setValueAt(BdArr([for (final e in list) BdObj(e)]), repeater);
  }

  // ── Conditions ─────────────────────────────────────────────────────────

  /// Resolve the value a condition compares, inside the given entries.
  BdRuleResolver resolver(List<BdEntry> entries) {
    final scope = entries.isEmpty
        ? BdFormRules.withDerivedFieldValues(
            fields, BdFormRules.deriveReferenceValues(fields, _state.values))
        : scopeValues(entries);
    return BdFormRules.resolver(scope, _matchResolver);
  }

  /// Is this block/page showing right now?
  bool isVisible(BdFormField node, [List<BdEntry> entries = const []]) =>
      BdFormRules.isNodeVisible(node, resolver(entries));

  /// Children of a concurrent-reveal group shown so far.
  int revealCount(BdFormField group, [List<BdEntry> entries = const []]) {
    final children = group.children ?? const <BdFormField>[];
    if (group.concurrentReveal != true) return children.length;
    return BdFormRules.concurrentRevealCount(children, scopeValues(entries));
  }

  BdMatchResolver get _matchResolver {
    final options = _state.collectionOptions;
    return (rule, raw) {
      final column = rule.matchField;
      final sourceId = rule.fieldId;
      final loaded = sourceId == null ? null : options[sourceId]?.valueOrNull;
      if (column == null || loaded == null) return raw;
      final index = <String, BdCollectionOption>{};
      for (final o in loaded) {
        index.putIfAbsent(o.value, () => o);
      }
      BdJson one(BdJson v) {
        final opt = index[BdJS.string(v)];
        if (opt == null) return v;
        if (column == '__label__') return BdStr(opt.label);
        final matched = opt.match?[column];
        return matched == null ? v : BdStr(matched);
      }

      final arr = raw?.arrayValue;
      if (arr != null) {
        return BdStr(arr.map((v) => BdJS.string(one(v))).join(', '));
      }
      return raw == null ? null : one(raw);
    };
  }

  // ── Validation ─────────────────────────────────────────────────────────

  String? errorAt(BdFieldPath path) => _state.errors[path.key];

  String? error(String id) => _state.errors[id];

  /// Required + value problems within these nodes, keyed by path.
  Map<String, String> _problems(List<BdFormField> nodes) {
    final out = <String, String>{};
    final values = _state.values;
    final match = _matchResolver;
    for (final m in BdFormRules.findMissingRequired(nodes, values, match)) {
      out[m.path] = _message('required', m.label, field(m.id));
    }
    for (final bad in BdFormRules.findInvalidValues(nodes, values, match)) {
      out.putIfAbsent(
          bad.path, () => _message(bad.reason, bad.label, field(bad.id)));
    }
    return out;
  }

  /// Check one field now (call on blur). Shows a format problem right away;
  /// a missing answer only once the visitor has tried to move on.
  void validate(BdFieldPath path) {
    final f = field(path.fieldId);
    if (f == null) return;
    final value = scopeValues(path.entries)[path.fieldId];
    final reason = BdFormRules.isPendingUpload(value)
        ? null
        : BdFormRules.validateValue(f, value) ??
            BdFormRules.clientOnlyRule(f, value);
    String? problem;
    if (reason != null) {
      problem = _message(reason, f.label, f);
    } else if (_state.hasAttempted &&
        (f.required || f.mustBeTrue == true) &&
        !BdFieldType.staticOrLayout.contains(f.type) &&
        BdFormRules.isEmpty(f, value)) {
      problem = _message('required', f.label, f);
    }
    _setError(path.key, problem);
  }

  void _setError(String key, String? message) {
    _update((s) {
      final next = Map<String, String>.of(s.errors);
      if (message == null) {
        next.remove(key);
      } else {
        next[key] = message;
      }
      return s.copyWith(errors: next);
    });
  }

  static String _lastSegment(String key) =>
      key.substring(key.lastIndexOf('.') + 1);

  /// After an edit: clear a fixed error, refresh one still wrong, and keep
  /// either/or and repeater errors in step.
  void _revalidate(BdFieldPath path) {
    if (_state.errors.containsKey(path.key)) validate(path);
    // An either/or or repeater error clears once its requirement is met.
    if (!_state.hasAttempted) return;
    final current = _problems(fields);
    final stale = _state.errors.keys.where((key) {
      if (current.containsKey(key)) return false;
      final f = field(_lastSegment(key));
      return f != null &&
          (f.type == 'or_condition' || f.type == 'multi_populator');
    }).toSet();
    if (stale.isNotEmpty) {
      _update(
        (s) => s.copyWith(
          errors: {
            for (final e in s.errors.entries)
              if (!stale.contains(e.key)) e.key: e.value,
          },
        ),
      );
    }
  }

  /// Check the whole form and show every problem. Returns true when clean.
  bool validateAll() {
    _update((s) => s.copyWith(hasAttempted: true));
    final found = _problems(fields);
    _update(
      (s) => s.copyWith(
          errors: found,
          errorScrollToken: s.errorScrollToken + (found.isEmpty ? 0 : 1)),
    );
    return found.isEmpty;
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  /// Advance if the current step is complete; otherwise show what's missing.
  bool next() {
    final all = steps;
    final index = currentStep;
    if (index >= all.length - 1) return false;
    _update((s) => s.copyWith(hasAttempted: true));
    final found = _problems(all[index]);
    if (found.isNotEmpty) {
      _update((s) =>
          s.copyWith(errors: found, errorScrollToken: s.errorScrollToken + 1));
      return false;
    }
    _update((s) =>
        s.copyWith(errors: const {}, movingForward: true, step: index + 1));
    return true;
  }

  void back() {
    final index = currentStep;
    if (index <= 0) return;
    _update((s) =>
        s.copyWith(movingForward: false, step: index - 1, errors: const {}));
  }

  void goToStep(int index) {
    final target = index.clamp(0, stepCount - 1);
    final from = currentStep;
    _update((s) => s.copyWith(movingForward: target >= from, step: target));
  }

  // ── Files ──────────────────────────────────────────────────────────────

  /// Add picked files to a `file_upload` field. Files the field doesn't
  /// accept are refused with a message; the rest upload on submit.
  void addFiles(List<BdPickedFile> files, BdFieldPath path) {
    final f = field(path.fieldId);
    if (f == null) return;
    final list = [...?valueAt(path)?.arrayValue];
    final maxFiles = f.fileConfig?.maxFiles ?? 1;
    String? problem;
    for (final file in files) {
      if (list.length >= maxFiles) {
        problem = _message('max', f.label, f);
        break;
      }
      final p = BdFormRules.fileProblem(
        file.name,
        file.mimeType,
        file.size,
        f.fileConfig?.allowedTypes,
        f.fileConfig?.maxSize,
      );
      if (p != null) {
        problem = p;
        continue;
      }
      list.add(_placeholder(file, f.id));
    }
    setValueAt(BdArr(list), path);
    if (problem != null) _setError(path.key, problem);
  }

  void removeFile(int index, BdFieldPath path) {
    final list = [...?valueAt(path)?.arrayValue];
    if (index < 0 || index >= list.length) return;
    final localId = list[index]['localId']?.stringValue;
    if (localId != null) _pendingFiles.remove(localId);
    list.removeAt(index);
    setValueAt(BdArr(list), path);
  }

  /// Set an `image_input` from a picked image; it uploads on submit.
  void setImage(BdPickedFile file, BdFieldPath path) {
    final f = field(path.fieldId);
    if (f == null) return;
    final cfg = f.imageInputConfig;
    final p = BdFormRules.fileProblem(
      file.name,
      file.mimeType,
      file.size,
      cfg?.allowedTypes ?? const ['image/*'],
      cfg?.maxSize ?? 5,
    );
    if (p != null) {
      _setError(path.key, p);
      return;
    }
    setValueAt(_placeholder(file, f.id), path);
  }

  /// The bytes behind a pending placeholder, for a preview.
  BdPickedFile? pendingFile(BdJson? value) {
    final id = value?['localId']?.stringValue;
    return id == null ? null : _pendingFiles[id];
  }

  static final _random = Random();
  static var _counter = 0;

  BdJson _placeholder(BdPickedFile file, String fieldId) {
    final id =
        'local-${DateTime.now().microsecondsSinceEpoch}-${_counter++}-${_random.nextInt(0x7fffffff)}';
    _pendingFiles[id] = file;
    return BdObj({
      'pending': const BdBool(true),
      'localId': BdStr(id),
      'fieldId': BdStr(fieldId),
      'name': BdStr(file.name),
      'size': BdNum(file.size.toDouble()),
      'mimeType': BdStr(file.mimeType),
    });
  }

  // ── Remote data ────────────────────────────────────────────────────────

  void _setOptions(
      String fieldId, BdLoadState<List<BdCollectionOption>>? state) {
    _update((s) {
      final next = Map<String, BdLoadState<List<BdCollectionOption>>>.of(
          s.collectionOptions);
      if (state == null) {
        next.remove(fieldId);
      } else {
        next[fieldId] = state;
      }
      return s.copyWith(collectionOptions: next);
    });
  }

  Future<void> loadCollectionOptions(String fieldId) async {
    final current = _state.collectionOptions[fieldId];
    if (current is BdLoaded || current is BdLoading) return;
    final backend = this.backend;
    if (backend == null) {
      _setOptions(
          fieldId, const BdLoadFailed("Options can't load without a backend."));
      return;
    }
    _setOptions(fieldId, const BdLoading());
    try {
      _setOptions(
          fieldId, BdLoaded(await backend.collectionOptions(form, fieldId)));
    } catch (_) {
      _setOptions(fieldId, const BdLoadFailed("Couldn't load the options."));
    }
  }

  /// Drop loaded (or failed) options and fetch them again.
  Future<void> reloadCollectionOptions(String fieldId) {
    _setOptions(fieldId, null);
    return loadCollectionOptions(fieldId);
  }

  void _setSlots(String fieldId, BdLoadState<List<String>> state) {
    _update(
        (s) => s.copyWith(scheduleSlots: {...s.scheduleSlots, fieldId: state}));
  }

  /// Open booking times for an auto-schedule field, three weeks ahead.
  Future<void> loadScheduleSlots(String fieldId, {bool reload = false}) async {
    if (!reload && _state.scheduleSlots[fieldId] is BdLoaded) return;
    final backend = this.backend;
    if (backend == null) {
      _setSlots(fieldId,
          const BdLoadFailed("Booking times can't load without a backend."));
      return;
    }
    _setSlots(fieldId, const BdLoading());
    final from = DateTime.now().millisecondsSinceEpoch;
    try {
      _setSlots(
          fieldId,
          BdLoaded(await backend.scheduleSlots(
              form, fieldId, from, from + 21 * 86400000)));
    } catch (_) {
      _setSlots(fieldId, const BdLoadFailed("Couldn't load open times."));
    }
  }

  /// Run the app's payment handler for a `credit_card` field.
  Future<void> collectPayment(BdFieldPath path) async {
    final f = field(path.fieldId);
    if (f == null) return;
    final backend = this.backend;
    final handler = paymentHandler;
    if (backend == null || handler == null) {
      _setError(path.key, "Card entry isn't set up in this app.");
      return;
    }
    try {
      final intent = await backend.paymentIntent(form, f.id);
      final intentId = await handler(intent, f);
      setValueAt(BdStr(intentId), path);
      _setError(path.key, null);
    } on BdFormsException catch (e) {
      _setError(path.key,
          e.message.trim().isEmpty ? "The card couldn't be saved." : e.message);
    } catch (e) {
      final text =
          e is Exception ? e.toString().replaceFirst('Exception: ', '') : '';
      _setError(
          path.key, text.trim().isEmpty ? "The card couldn't be saved." : text);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  /// Validate everything, upload picked files, and submit. Never throws for
  /// a failed submission: every outcome, including a network failure, comes
  /// back as a result, and field-level problems land in [errors].
  Future<BdSubmitResult> submit() async {
    _update((s) => s.copyWith(hasAttempted: true));
    final found = _problems(fields);
    if (found.isNotEmpty) {
      return _fail(BdSubmitFailureReason.clientValidationFailed, 0,
          _summary(found.length), found);
    }
    // Form-wide file cap across every file field.
    final fileFields = [
      for (final f in _fieldIndex.values)
        if (f.type == 'file_upload') f
    ];
    final total = fileFields.fold<int>(
        0, (n, f) => n + (_state.values[f.id]?.arrayValue?.length ?? 0));
    if (total > BdFormRules.formWideMaxFiles) {
      final e = <String, String>{
        for (final f in fileFields)
          if (_state.values[f.id]?.arrayValue?.isNotEmpty ?? false)
            f.id: 'At most ${BdFormRules.formWideMaxFiles} files in total.',
      };
      return _fail(
        BdSubmitFailureReason.clientValidationFailed,
        0,
        'Please attach at most ${BdFormRules.formWideMaxFiles} files in total.',
        e,
      );
    }
    final backend = this.backend;
    if (backend == null) {
      return _fail(BdSubmitFailureReason.networkError, 0,
          'This form has no backend to submit to.', const {});
    }

    _update((s) => s.copyWith(errors: const {}, isSubmitting: true));
    try {
      // Upload every picked file, swapping placeholders for stored files.
      final uploadErrors = <String, String>{};
      final uploaded =
          await _resolveUploads(_state.values, '', backend, uploadErrors);
      _update((s) => s.copyWith(values: uploaded));
      if (uploadErrors.isNotEmpty) {
        return _fail(
          BdSubmitFailureReason.networkError,
          0,
          "Some files couldn't be uploaded. Please try again.",
          uploadErrors,
        );
      }

      final payload = BdFormRules.toSubmissionPayload(fields, uploaded);
      final opts = submitOptions;
      final res = await backend.submit(
        form,
        BdSubmission(
          data: payload,
          submitterEmail: opts.submitterEmail,
          submitterName: opts.submitterName,
          dryRun: opts.dryRun ? true : null,
          source: opts.source,
          referrer: opts.referrer,
          metadata: opts.metadata,
        ),
      );
      _update((s) => s.copyWith(result: res));
      switch (res) {
        case BdSubmitSuccess():
          onSuccess?.call(res);
        case BdSubmitFailure():
          _update((s) => s.copyWith(errors: _mapIssues(res.issues)));
          _jumpToFirstError();
          onFailure?.call(res);
      }
      return res;
    } finally {
      _update((s) => s.copyWith(isSubmitting: false));
    }
  }

  static String _summary(int count) =>
      'Please fix the highlighted field${count == 1 ? '' : 's'}.';

  BdSubmitResult _fail(BdSubmitFailureReason reason, int status, String message,
      Map<String, String> errors) {
    final issues = [
      for (final MapEntry(:key, value: msg) in errors.entries)
        BdFormIssue(
          fieldId: _lastSegment(key),
          label: field(_lastSegment(key))?.label ?? _lastSegment(key),
          reason: reason == BdSubmitFailureReason.clientValidationFailed
              ? 'invalid'
              : 'upload',
          message: msg,
        ),
    ];
    final failure = BdSubmitFailure(
        status: status, reason: reason, message: message, issues: issues);
    _update((s) => s.copyWith(errors: errors, result: failure));
    _jumpToFirstError();
    onFailure?.call(failure);
    return failure;
  }

  /// Server issues arrive by field id (or output key); map them onto field
  /// errors with readable messages.
  Map<String, String> _mapIssues(List<BdFormIssue> issues) {
    final keyToId = <String, String>{
      for (final f in _fieldIndex.values)
        if (f.key != null) f.key!: f.id,
    };
    final out = <String, String>{};
    for (final issue in issues) {
      if (issue.fieldId.isEmpty) continue;
      final id = _fieldIndex.containsKey(issue.fieldId)
          ? issue.fieldId
          : keyToId[issue.fieldId] ?? issue.fieldId;
      final f = field(id);
      out[id] = _message(issue.reason, f?.label ?? issue.label, f);
    }
    return out;
  }

  /// In a stepped form, move to the step holding the first error.
  void _jumpToFirstError() {
    _update((s) => s.copyWith(errorScrollToken: s.errorScrollToken + 1));
    final first = _state.errors.keys.firstOrNull;
    if (!isConsecutive || first == null) return;
    final rootId = first.split('[').first.split('.').first;
    final index = steps.indexWhere((step) =>
        step.any((f) => BdFormRules.fieldsById([f]).containsKey(rootId)));
    if (index < 0 || index == currentStep) return;
    final from = currentStep;
    _update((s) => s.copyWith(movingForward: index > from, step: index));
  }

  Future<Map<String, BdJson>> _resolveUploads(
    Map<String, BdJson> scope,
    String prefix,
    BdFormsBackend backend,
    Map<String, String> errors,
  ) async {
    final out = Map<String, BdJson>.of(scope);
    for (final MapEntry(:key, :value) in scope.entries) {
      final f = field(key);
      if (f == null) continue;
      switch (f.type) {
        case 'file_upload':
          final list = value.arrayValue;
          if (list == null || !list.any(BdFormRules.isPendingUpload)) continue;
          final done = <BdJson>[];
          for (final item in list) {
            final id = item['localId']?.stringValue;
            final file = id == null ? null : _pendingFiles[id];
            if (!BdFormRules.isPendingUpload(item) || file == null) {
              done.add(item);
              continue;
            }
            done.add(
                (await _upload(f, file, id!, prefix + key, errors))?.json ??
                    item);
          }
          out[key] = BdArr(done);
        case 'image_input':
          final id = value['localId']?.stringValue;
          final file = id == null ? null : _pendingFiles[id];
          if (!BdFormRules.isPendingUpload(value) || file == null) continue;
          final stored = await _upload(f, file, id!, prefix + key, errors);
          if (stored != null) out[key] = BdStr(stored.url);
        case 'multi_populator':
          final list = value.arrayValue;
          if (list == null) continue;
          out[key] = BdArr([
            for (var i = 0; i < list.length; i++)
              if (list[i].objectValue case final o?)
                BdObj(await _resolveUploads(
                    o, '$prefix$key[$i].', backend, errors))
              else
                list[i],
          ]);
      }
    }
    return out;
  }

  Future<BdUploadedFile?> _upload(
    BdFormField f,
    BdPickedFile file,
    String localId,
    String errorKey,
    Map<String, String> errors,
  ) async {
    final backend = this.backend;
    if (backend == null) return null;
    _update((s) => s.copyWith(uploadingCount: s.uploadingCount + 1));
    try {
      final stored = await backend.upload(form, f.id, file);
      _pendingFiles.remove(localId);
      return stored;
    } on BdFormsException catch (e) {
      errors[errorKey] = e.message;
      return null;
    } catch (_) {
      errors[errorKey] = "Couldn't upload ${file.name}.";
      return null;
    } finally {
      _update((s) => s.copyWith(uploadingCount: s.uploadingCount - 1));
    }
  }

  /// Back to the first step with the starting values.
  void reset() {
    final schema = _state.schema;
    if (schema != null) _adopt(schema);
  }

  /// [root] with [value] written at [path], creating repeater entries on
  /// the way as needed.
  static Map<String, BdJson> write(
      BdJson? value, BdFieldPath path, Map<String, BdJson> root) {
    Map<String, BdJson> go(Map<String, BdJson> scope, List<BdEntry> entries) {
      final next = Map<String, BdJson>.of(scope);
      if (entries.isEmpty) {
        next[path.fieldId] = value ?? const BdNull();
        return next;
      }
      final e = entries.first;
      final arr = [...?scope[e.repeaterId]?.arrayValue];
      while (arr.length <= e.index) {
        arr.add(const BdObj({}));
      }
      arr[e.index] =
          BdObj(go(arr[e.index].objectValue ?? const {}, entries.sublist(1)));
      next[e.repeaterId] = BdArr(arr);
      return next;
    }

    return go(root, path.entries);
  }
}
