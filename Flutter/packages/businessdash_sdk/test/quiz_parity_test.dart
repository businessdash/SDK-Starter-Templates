// Replays `fixtures/quiz-parity.json`: quizzes run through the TypeScript
// forms-core by `sdk/scripts/quiz-parity.ts`, with every screen and state TS
// produced. The Dart quiz must show a taker exactly what the web quiz shows.
//
// Each test collects every disagreement before failing.

import 'dart:io';

import 'package:businessdash_sdk/forms.dart';
import 'package:test/test.dart';

final Map<String, BdJson> fixtures =
    BdJson.parse(File('test/fixtures/quiz-parity.json').readAsStringSync())
        .objectValue!;

List<Map<String, BdJson>> cases(String key) {
  final list = [for (final c in fixtures[key]!.arrayValue!) c.objectValue!];
  if (list.isEmpty) throw StateError('no $key cases');
  return list;
}

bool _nullish(BdJson? v) => v == null || v.isNull;

/// JSON equality where a missing key equals `null`, with float tolerance.
/// The path of the first difference, or null.
String? diff(BdJson? a, BdJson? b, [String path = r'$']) {
  if (_nullish(a) && _nullish(b)) return null;
  if (a is BdNum && b is BdNum) {
    final x = a.value;
    final y = b.value;
    final scale = x.abs() > y.abs() ? x.abs() : y.abs();
    return x == y || (x - y).abs() <= 1e-9 * scale ? null : '$path: $x ≠ $y';
  }
  if (a is BdArr && b is BdArr) {
    if (a.items.length != b.items.length) {
      return '$path: ${a.items.length} items ≠ ${b.items.length}';
    }
    for (var i = 0; i < a.items.length; i++) {
      final d = diff(a.items[i], b.items[i], '$path[$i]');
      if (d != null) return d;
    }
    return null;
  }
  if (a is BdObj && b is BdObj) {
    final keys = {...a.fields.keys, ...b.fields.keys}.toList()..sort();
    for (final k in keys) {
      final d = diff(a.fields[k], b.fields[k], '$path.$k');
      if (d != null) return d;
    }
    return null;
  }
  return a == b ? null : '$path: ${a?.toJsonString()} ≠ ${b?.toJsonString()}';
}

BdJson json(Object? plain) => BdJson.of(plain);

class _PageInvitation implements BdQuizInvitationPageInfo {
  _PageInvitation(this.j);
  final BdJson j;
  @override
  String get name => j['name']?.stringValue ?? '';
  @override
  String get description => j['description']?.stringValue ?? '';
  @override
  double? get estimatedMinutes => j['estimatedMinutes']?.doubleValue;
  @override
  double? get timeLimitMinutes => j['timeLimitMinutes']?.doubleValue;
  @override
  String? get recipientName => j['recipientName']?.stringValue;
  @override
  bool get requireAuthentication =>
      j['requireAuthentication']?.boolValue == true;
  @override
  String get authenticationStatus =>
      j['authenticationStatus']?.stringValue ?? 'not_required';
  @override
  String get recipientEmailHint => j['recipientEmailHint']?.stringValue ?? '';
  @override
  String get status => j['status']?.stringValue ?? 'pending';
  @override
  bool get expired => j['expired']?.boolValue == true;
  @override
  bool get active => j['active']?.boolValue != false;
}

class _PagePractice implements BdQuizPageInfo {
  _PagePractice(this.j);
  final BdJson j;
  @override
  String get name => j['name']?.stringValue ?? '';
  @override
  String get description => j['description']?.stringValue ?? '';
  @override
  double? get estimatedMinutes => j['estimatedMinutes']?.doubleValue;
  @override
  double? get timeLimitMinutes => j['timeLimitMinutes']?.doubleValue;
}

void main() {
  test('the comparison forgives only missing-vs-null', () {
    expect(diff(json({'a': 1}), json({'a': 2})), isNotNull);
    expect(diff(json({'a': 1}), json({})), isNotNull);
    expect(diff(json({'a': 'x'}), json({'a': 'y'})), isNotNull);
    expect(diff(json([1, 2]), json([1])), isNotNull);
    expect(
        diff(
            json({
              'a': {'b': true}
            }),
            json({
              'a': {'b': false}
            })),
        isNotNull);
    expect(diff(json({'a': null}), json({})), isNull);
  });

  test('words', () {
    final expected = {
      for (final e in fixtures['words']!.objectValue!.entries)
        e.key: e.value.stringValue
    };
    expect(const BdQuizWords().toMap(), expected);
  });

  test('seed hash', () {
    final misses = <String>[];
    for (final c in cases('seedHash')) {
      final text = c['text']!.stringValue!;
      final got = BdQuizArrange.seedHash(text);
      if (got != c['hash']!.doubleValue!.toInt()) {
        misses.add('hash("$text"): $got');
      }
    }
    expect(misses, isEmpty);
  });

  test('seeded order', () {
    final misses = <String>[];
    for (final c in cases('seededOrder')) {
      final count = c['count']!.doubleValue!.toInt();
      final seed = c['seed']!.stringValue!;
      final want = [
        for (final i in c['order']!.arrayValue!) i.doubleValue!.toInt()
      ];
      final got = BdQuizArrange.seededOrder(count, seed);
      if (got.join(',') != want.join(',')) {
        misses.add('order($count, "$seed"): $got ≠ $want');
      }
    }
    expect(misses, isEmpty);
  });

  test('durations', () {
    final misses = <String>[];
    for (final c in cases('durations')) {
      final seconds = c['seconds']!.doubleValue!;
      final got = BdQuizEngine.durationLabel(seconds);
      if (got != c['label']!.stringValue) {
        misses.add('duration($seconds): $got');
      }
    }
    expect(misses, isEmpty);
  });

  test('answer text', () {
    final misses = <String>[];
    for (final c in cases('answerText')) {
      final got = BdQuizEngine.answerText(c['value']);
      if (got != c['text']!.stringValue) {
        misses.add('answerText(${c['value']}): "$got"');
      }
    }
    expect(misses, isEmpty);
  });

  test('scoring', () {
    final misses = <String>[];
    for (final c in cases('scoring')) {
      final fields = [
        for (final f in c['fields']!.arrayValue!) BdFormField.make(f)
      ];
      final score = BdQuizScoring.score(
          fields,
          c['answers']?.objectValue ?? const {},
          c['passingScore']!.doubleValue!);
      final d = diff(json(score.toJson()), c['score']);
      if (d != null) misses.add('scoring “${c['name']?.stringValue}”: $d');
    }
    expect(misses, isEmpty);
  });

  test('results round-trip through the wire types', () {
    final misses = <String>[];
    for (final c in cases('scoring')) {
      final results = c['score']!['results']!;
      final again = [
        for (final r in results.arrayValue!)
          BdQuizQuestionResult.fromJson(r).toJson()
      ];
      final d = diff(json(again), results);
      if (d != null) misses.add('round trip “${c['name']?.stringValue}”: $d');
    }
    expect(misses, isEmpty);
  });

  test('pages', () {
    final misses = <String>[];
    for (final c in cases('pages')) {
      final BdQuizPage page;
      if (c['practice'] case final practice?) {
        page = BdQuizPage.practice(_PagePractice(practice));
      } else {
        final invitation = c['invitation'];
        page = BdQuizPage.invitation(
          invitation == null || invitation.isNull
              ? null
              : _PageInvitation(invitation),
          signInHref: c['links']?['signInHref']?.stringValue,
          switchAccountHref: c['links']?['switchAccountHref']?.stringValue,
        );
      }
      final d = diff(json(page.toJson()), c['page']);
      if (d != null) misses.add('page “${c['name']?.stringValue}”: $d');
    }
    expect(misses, isEmpty);
  });

  test('runs: every screen and state', () {
    final misses = <String>[];
    for (final run in cases('runs')) {
      final name = run['name']!.stringValue!;
      final config = BdQuizConfig(
          BdQuizOptions.fromJson(run['options']!), run['seed']!.stringValue!);
      final initial = run['initial'] == null
          ? const BdQuizInitial()
          : BdQuizInitial.fromJson(run['initial']!);
      final start = run['start']!.doubleValue!;
      var state = BdQuizEngine.initialState(config, initial, start);
      final views = run['views']!.arrayValue!;
      final states = run['states']!.arrayValue!;

      bool check(int i, double at) {
        final v = diff(
            json(BdQuizEngine.screen(config, state, at).toJson()), views[i]);
        if (v != null) {
          misses.add('run “$name”, view $i: $v');
          return false;
        }
        final s = diff(json(state.toJson()), states[i]);
        if (s != null) {
          misses.add('run “$name”, state $i: $s');
          return false;
        }
        return true;
      }

      if (!check(0, start)) continue;
      final events = run['events']!.arrayValue!;
      for (var i = 0; i < events.length; i++) {
        final e = events[i];
        final at = e['at']!.doubleValue!;
        BdQuizCompletion completion(Map<String, BdJson> answers) =>
            e['completion'] != null
                ? BdQuizCompletion.fromJson(e['completion']!)
                : BdQuizEngine.localCompletion(config, state, answers, at);
        switch (e['do']!.stringValue!) {
          case 'answer':
            state = BdQuizEngine.setAnswer(config, state,
                e['fieldId']!.stringValue!, e['value'] ?? const BdNull());
          case 'dontKnow':
            state = BdQuizEngine.chooseDontKnow(
                config, state, e['fieldId']!.stringValue!);
          case 'back':
            state = BdQuizEngine.back(config, state);
          case 'start':
            final info = e['info'] != null
                ? BdQuizStartInfo.fromJson(e['info']!)
                : BdQuizEngine.localStart(config, at);
            state = BdQuizEngine.started(state, info, at);
          case 'fail':
            state = BdQuizEngine.failed(state, e['message']!.stringValue!);
          case 'view':
            break;
          case 'advance':
            final step = BdQuizEngine.advance(config, state, at);
            state = step.state;
            switch (step) {
              case BdQuizLock(:final fieldId, :final answer):
                final result = e['result'] != null
                    ? BdQuizQuestionResult.fromJson(e['result']!)
                    : BdQuizEngine.localResult(config, fieldId, answer);
                state = result != null
                    ? BdQuizEngine.locked(
                        config, state, fieldId, answer, result, at)
                    : BdQuizEngine.failed(state, config.words.unscorable);
              case BdQuizSubmit(:final answers):
                state = BdQuizEngine.completed(state, completion(answers));
              case BdQuizStay():
                break;
            }
          case 'tick':
            if (BdQuizEngine.deadlinePassed(config, state, at)) {
              final answers = state.answers;
              state = BdQuizEngine.timeUp(state);
              state = BdQuizEngine.completed(state, completion(answers));
            }
          case final other:
            misses.add('run “$name”: unknown event $other');
        }
        if (!check(i + 1, at)) break;
      }
    }
    expect(misses, isEmpty);
  });
}
