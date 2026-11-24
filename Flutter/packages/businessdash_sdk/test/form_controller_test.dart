// The headless controller and the Package API backend: the same cases the
// Kotlin suite runs (FormControllerTest, PackageFormsBackendTest).

import 'dart:convert';
import 'dart:typed_data';

import 'package:businessdash_sdk/forms.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

BdJson json(String text) => BdJson.parse(text);

BdJson str(String s) => BdStr(s);

/// A backend that records what it was sent and answers from a script.
class MockBackend implements BdFormsBackend {
  MockBackend(String fields, [String settings = '{}'])
      : schemaJson = '{"id":"form_1","slug":"contact","name":"Contact","fields":$fields,"settings":$settings,"actions":[]}';

  final String schemaJson;
  (int, Map<String, BdJson>) submitAnswer = (201, {'submissionId': const BdStr('sub_1')});
  final submissions = <BdSubmission>[];
  final uploads = <String>[];
  var failUploads = false;
  BdFormsException? schemaError;

  Map<String, BdJson> get lastData => submissions.isEmpty ? const {} : submissions.last.data;

  @override
  Future<BdFormSchema> schema(String form) async {
    if (schemaError != null) throw schemaError!;
    return BdFormSchema.parse(schemaJson);
  }

  @override
  Future<BdSubmitResult> submit(String form, BdSubmission submission) async {
    submissions.add(submission);
    final (status, body) = submitAnswer;
    if (status >= 200 && status < 300) {
      return BdSubmitSuccess(status: status, submissionId: body['submissionId']?.stringValue, body: body);
    }
    return BdPackageFormsBackend.failure(status, body);
  }

  @override
  Future<BdUploadedFile> upload(String form, String fieldId, BdPickedFile file) async {
    if (failUploads) throw const BdFormsException('Upload failed.', status: 500);
    uploads.add(file.name);
    return BdUploadedFile(
      storageId: 's/${file.name}',
      url: 'https://cdn.example.com/${file.name}',
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    );
  }

  @override
  Future<List<String>> scheduleSlots(String form, String fieldId, int fromMs, int toMs) async =>
      ['2026-11-24T15:00:00Z', '2026-11-24T16:00:00Z', '2026-11-25T15:00:00Z'];

  @override
  Future<BdPaymentIntent> paymentIntent(String form, String fieldId) async => const BdPaymentIntent(
        mode: 'card_on_file',
        clientSecret: 'cs',
        intentId: 'seti_1',
        publishableKey: 'pk',
        connectedAccountId: 'acct',
      );

  @override
  Future<List<BdCollectionOption>> collectionOptions(String form, String fieldId) async => const [
        BdCollectionOption(value: 'r1', label: 'Gold', match: {'tier': 'premium'}),
        BdCollectionOption(value: 'r2', label: 'Basic', match: {'tier': 'standard'}),
      ];
}

Future<BdFormController> loaded(MockBackend backend) async {
  final c = BdFormController('contact', backend: backend);
  await c.load();
  return c;
}

BdPickedFile file(String name, String type, List<int> bytes) =>
    BdPickedFile(data: Uint8List.fromList(bytes), name: name, mimeType: type);

void main() {
  group('controller', () {
    test('loads and submits with output keys', () async {
      final b = MockBackend('''[{"id":"f1","type":"text","label":"Your name","required":true,"key":"full_name"},
          {"id":"f2","type":"email","label":"Email","required":true},
          {"id":"t","type":"title","label":"Hello"}]''');
      final c = await loaded(b);
      expect(c.phase, isA<BdPhaseReady>());
      c.setValue(str('Ada'), 'f1');
      c.setValue(str('ada@example.com'), 'f2');
      final r = await c.submit();
      expect(r.isSuccess, isTrue);
      expect(c.isSubmitted, isTrue);
      expect(b.lastData['full_name'], str('Ada'));
      expect(b.lastData['f2'], str('ada@example.com'));
      expect(b.lastData.containsKey('t'), isFalse);
    });

    test('required and format errors block submit', () async {
      final b = MockBackend(
        '[{"id":"name","type":"text","label":"Name","required":true},{"id":"email","type":"email","label":"Email"}]',
      );
      final c = await loaded(b);
      c.setValue(str('not-an-email'), 'email');
      final f = await c.submit() as BdSubmitFailure;
      expect(f.reason, BdSubmitFailureReason.clientValidationFailed);
      expect(c.error('name'), 'Name is required.');
      expect(c.error('email'), 'Enter a valid email address.');
      expect(b.submissions, isEmpty);
      expect(c.state.errorScrollToken, greaterThan(0));
    });

    test('blur shows format problems, but required only once attempted', () async {
      final c = await loaded(MockBackend('[{"id":"email","type":"email","label":"Email","required":true}]'));
      c.validate(const BdFieldPath('email'));
      expect(c.error('email'), isNull, reason: 'an untouched required field stays quiet on blur');
      c.setValue(str('bad'), 'email');
      c.validate(const BdFieldPath('email'));
      expect(c.error('email'), 'Enter a valid email address.');
      c.setValue(str('good@example.com'), 'email');
      expect(c.error('email'), isNull, reason: 'fixing the value clears the error as they type');
    });

    test('business email rule', () async {
      final c = await loaded(
        MockBackend('[{"id":"email","type":"email","label":"Work email","emailConfig":{"businessOnly":true}}]'),
      );
      c.setValue(str('someone@gmail.com'), 'email');
      c.validate(const BdFieldPath('email'));
      expect(c.error('email'), 'Please use your work email address.');
    });

    test('a stepped form validates each step and follows conditions', () async {
      final b = MockBackend(
        '''[{"id":"kind","type":"radio","label":"Kind","required":true,"options":["Home","Business"]},
            {"id":"biz","type":"condition_block","label":"",
             "conditionRule":{"fieldId":"kind","operator":"eq","value":"Business"},
             "children":[{"id":"company","type":"text","label":"Company","required":true}]},
            {"id":"notes","type":"textarea","label":"Notes"}]''',
        '{"isConsecutive":true}',
      );
      final c = await loaded(b);
      expect(c.stepCount, 2, reason: 'the business page is hidden until chosen');
      expect(c.next(), isFalse);
      expect(c.error('kind'), 'Kind is required.');
      c.setValue(str('Business'), 'kind');
      expect(c.stepCount, 3);
      expect(c.next(), isTrue);
      expect(c.currentStep, 1);
      expect(c.next(), isFalse);
      expect(c.error('company'), 'Company is required.');
      c.back();
      expect(c.errors, isEmpty);
      c.setValue(str('Home'), 'kind');
      expect(c.stepCount, 2);
      expect((await c.submit()).isSuccess, isTrue, reason: "a hidden required field doesn't block");
    });

    test('repeater errors land on the entry field', () async {
      final b = MockBackend(
        '''[{"id":"kids","type":"multi_populator","label":"Children","populatorConfig":{"maxInstances":3},
             "children":[{"id":"kname","type":"text","label":"Name","required":true},
                         {"id":"kage","type":"number","label":"Age","validation":{"min":0,"max":17}}]}]''',
      );
      final c = await loaded(b);
      const kids = BdFieldPath('kids');
      c.setValueAt(str('Sam'), BdFieldPath('kname', kids.entry(0)));
      c.addEntry(kids);
      c.setValueAt(const BdNum(30), BdFieldPath('kage', kids.entry(1)));
      await c.submit();
      expect(c.errorAt(BdFieldPath('kname', kids.entry(1))), 'Name is required.');
      expect(c.errorAt(BdFieldPath('kage', kids.entry(1))), 'Enter 17 or less.');
      expect(c.errors['kids[1].kage'], isNotNull);
      c.removeEntry(1, kids);
      expect(c.entries(kids).length, 1);
      expect((await c.submit()).isSuccess, isTrue);
      expect(b.lastData['kids'], json('[{"kname":"Sam"}]'));
    });

    test('calculations recompute on edit', () async {
      final b = MockBackend(
        '''[{"id":"qty","type":"number","label":"Qty"},{"id":"price","type":"currency","label":"Price"},
            {"id":"total","type":"calculation","label":"Total",
             "calculationConfig":{"formula":"q * p","inputMap":[{"variable":"q","fieldId":"qty"},{"variable":"p","fieldId":"price"}]}}]''',
      );
      final c = await loaded(b);
      c.setValue(const BdNum(3), 'qty');
      c.setValue(const BdNum(2.5), 'price');
      expect(c.value('total'), const BdNum(7.5));
      c.setValue(null, 'qty');
      expect(c.value('total'), const BdNull(), reason: 'a missing input leaves the result empty');
    });

    test('files upload on submit and swap their placeholders', () async {
      final b = MockBackend(
        '''[{"id":"docs","type":"file_upload","label":"Docs","fileConfig":{"maxFiles":2,"allowedTypes":["application/pdf"]}},
            {"id":"pic","type":"image_input","label":"Photo"}]''',
      );
      final c = await loaded(b);
      c.addFiles([file('a.pdf', 'application/pdf', List.filled(10, 1)), file('b.png', 'image/png', List.filled(10, 2))],
          const BdFieldPath('docs'));
      expect(c.value('docs')?.arrayValue?.length, 1, reason: "the png isn't an allowed type");
      expect(c.error('docs'), 'File type not allowed: image/png');
      c.setImage(file('me.heic', 'image/heic', [255]), const BdFieldPath('pic'));
      expect(BdFormRules.isPendingUpload(c.value('pic')), isTrue);
      expect((await c.submit()).isSuccess, isTrue);
      expect([...b.uploads]..sort(), ['a.pdf', 'me.heic']);
      expect(b.lastData['docs']?.arrayValue?.first['url'], str('https://cdn.example.com/a.pdf'));
      expect(b.lastData['pic'], str('https://cdn.example.com/me.heic'));
    });

    test('a failed upload keeps the form open', () async {
      final b = MockBackend('[{"id":"docs","type":"file_upload","label":"Docs"}]')..failUploads = true;
      final c = await loaded(b);
      c.addFiles([file('x.txt', 'text/plain', [1])], const BdFieldPath('docs'));
      final f = await c.submit() as BdSubmitFailure;
      expect(f.reason, BdSubmitFailureReason.networkError);
      expect(c.error('docs'), 'Upload failed.');
      expect(b.submissions, isEmpty);
      expect(BdFormRules.isPendingUpload(c.value('docs')?.arrayValue?.firstOrNull), isTrue,
          reason: 'the file is still there to retry');
      expect(c.state.isSubmitting, isFalse);
      expect(c.state.uploadingCount, 0);
    });

    test('server issues map back to fields', () async {
      final b = MockBackend('[{"id":"f1","type":"text","label":"Code","key":"promo"}]')
        ..submitAnswer = (
          422,
          json('{"error":"validation_failed","message":"Bad","issues":[{"id":"promo","label":"Code","reason":"regex"}]}')
              .objectValue!,
        );
      final c = await loaded(b);
      c.setValue(str('x'), 'f1');
      final f = await c.submit() as BdSubmitFailure;
      expect(f.reason, BdSubmitFailureReason.validationFailed);
      expect(c.error('f1'), "Code isn't in the expected format.");
    });

    test('status codes map like the JS SDK', () {
      BdSubmitFailureReason reason(int status, [String body = '{}']) =>
          BdPackageFormsBackend.failure(status, json(body).objectValue!).reason;
      expect(reason(401), BdSubmitFailureReason.unauthorized);
      expect(reason(403), BdSubmitFailureReason.forbidden);
      expect(reason(402), BdSubmitFailureReason.planRequired);
      expect(reason(402, '{"reason":"payment_required"}'), BdSubmitFailureReason.paymentRequired);
      expect(reason(402, '{"reason":"service_suspended"}'), BdSubmitFailureReason.serviceSuspended);
      expect(reason(429), BdSubmitFailureReason.rateLimited);
      expect(reason(404), BdSubmitFailureReason.notFound);
      expect(reason(400), BdSubmitFailureReason.invalidRequest);
      expect(reason(400, '{"error":"validation_failed"}'), BdSubmitFailureReason.validationFailed);
      expect(reason(500), BdSubmitFailureReason.serverError);
    });

    test('collection match conditions', () async {
      final b = MockBackend(
        '''[{"id":"plan","type":"collection_select","label":"Plan"},
            {"id":"vip","type":"condition_block","label":"",
             "conditionRule":{"fieldId":"plan","operator":"eq","value":"premium","matchField":"tier"},
             "children":[{"id":"concierge","type":"text","label":"Concierge","required":true}]}]''',
      );
      final c = await loaded(b);
      await c.loadCollectionOptions('plan');
      c.setValue(str('r2'), 'plan');
      expect(c.isVisible(c.field('vip')!), isFalse);
      c.setValue(str('r1'), 'plan');
      expect(c.isVisible(c.field('vip')!), isTrue);
      expect((await c.submit()).isSuccess, isFalse);
      expect(c.error('concierge'), isNotNull);
    });

    test('the payment handler stores the intent', () async {
      final c = await loaded(MockBackend('[{"id":"card","type":"credit_card","label":"Card","required":true}]'));
      await c.collectPayment(const BdFieldPath('card'));
      expect(c.error('card'), "Card entry isn't set up in this app.");
      c.paymentHandler = (intent, _) async => intent.intentId;
      await c.collectPayment(const BdFieldPath('card'));
      expect(c.value('card'), str('seti_1'));
      expect(c.error('card'), isNull);
    });

    test('date range order', () async {
      final c = await loaded(MockBackend('[{"id":"trip","type":"date_range","label":"Trip"}]'));
      c.setValue(json('{"start":"2026-12-10","end":"2026-12-01"}'), 'trip');
      c.validate(const BdFieldPath('trip'));
      expect(c.error('trip'), 'The end must come after the start.');
    });

    test('custom messages', () async {
      final c = await loaded(MockBackend('[{"id":"n","type":"text","label":"Nom","required":true}]'));
      c.messages = (reason, label, _) => reason == 'required' ? '$label est obligatoire.' : reason;
      await c.submit();
      expect(c.error('n'), 'Nom est obligatoire.');
    });

    test('reset restores the seed, and dirty tracks edits', () async {
      final c = await loaded(MockBackend('[{"id":"n","type":"text","label":"N","defaultValue":"hi"}]'));
      expect(c.isDirty, isFalse);
      c.setValue(str('changed'), 'n');
      expect(c.isDirty, isTrue);
      c.reset();
      expect(c.value('n'), str('hi'));
      expect(c.isDirty, isFalse);
    });

    test('schedule slots load', () async {
      final c = await loaded(
        MockBackend('[{"id":"when","type":"schedule","label":"When","scheduleConfig":{"mode":"auto"}}]'),
      );
      await c.loadScheduleSlots('when');
      expect(c.state.scheduleSlots['when']?.valueOrNull?.length, 3);
    });

    test('a load failure is a phase, not a throw', () async {
      final b = MockBackend('[]')..schemaError = const BdFormsException('Form not found.', status: 404);
      final c = BdFormController('missing', backend: b);
      await c.load();
      expect((c.phase as BdPhaseFailed).message, 'Form not found.');
    });

    test('listeners hear every change', () async {
      final c = await loaded(MockBackend('[{"id":"n","type":"text","label":"N"}]'));
      var calls = 0;
      void listener() => calls++;
      c.addListener(listener);
      c.setValue(str('a'), 'n');
      expect(calls, greaterThan(0));
      final seen = calls;
      c.removeListener(listener);
      c.setValue(str('b'), 'n');
      expect(calls, seen);
    });
  });

  group('package backend', () {
    final seen = <http.Request>[];

    BdPackageFormsBackend backend(Future<http.Response> Function(http.Request) handler) {
      seen.clear();
      return BdPackageFormsBackend(
        publishableKey: 'pk_test_123',
        host: 'https://bd.test/',
        httpClient: MockClient((req) {
          seen.add(req);
          return handler(req);
        }),
      );
    }

    http.Response ok(String body, [int status = 200]) =>
        http.Response(body, status, headers: {'content-type': 'application/json'});

    test('refuses a secret key', () {
      // Real secret keys are bd_…; sk_ stays to prove it's an allowlist.
      expect(() => BdPackageFormsBackend(publishableKey: 'bd_3ZxQf9'), throwsArgumentError);
      expect(() => BdPackageFormsBackend(publishableKey: 'sk_live_oops'), throwsArgumentError);
    });

    test('fetches the schema with the publishable key', () async {
      final b = backend(
        (_) async => ok('{"id":"f","slug":"contact form","name":"Contact","fields":[{"id":"a","type":"text","label":"A"}]}'),
      );
      final schema = await b.schema('contact form');
      expect(schema.title, 'Contact');
      expect(schema.fields.length, 1);
      final req = seen.single;
      // The slug is one path segment, encoded, under the apex /api/package/v1.
      expect(req.url.toString(), 'https://bd.test/api/package/v1/forms/contact%20form');
      expect(req.headers['Authorization'], 'Bearer pk_test_123');
      expect(req.headers['X-BD-Client'], 'dart-forms/1');
    });

    test("a missing form is an exception with the server's message", () async {
      final b = backend((_) async => ok('{"message":"Form not found."}', 404));
      await expectLater(
        b.schema('nope'),
        throwsA(isA<BdFormsException>().having((e) => e.status, 'status', 404).having((e) => e.message, 'message', 'Form not found.')),
      );
    });

    test('submits the body and reads the submission id', () async {
      final b = backend((_) async => ok('{"submissionId":"sub_9","dryRun":false}', 201));
      final r = await b.submit('contact', const BdSubmission(data: {'email': BdStr('a@b.co')}, source: 'flutter-app'));
      expect((r as BdSubmitSuccess).submissionId, 'sub_9');
      final req = seen.single;
      expect(req.method, 'POST');
      // Absent options are left out, not sent as null.
      expect(req.body, '{"data":{"email":"a@b.co"},"source":"flutter-app"}');
    });

    test('validation failures carry their issues', () async {
      final b = backend(
        (_) async => ok(
          '{"error":"validation_failed","message":"Fix it","issues":[{"id":"email","label":"Email","reason":"format"}]}',
          422,
        ),
      );
      final f = await b.submit('contact', const BdSubmission(data: {})) as BdSubmitFailure;
      expect(f.reason, BdSubmitFailureReason.validationFailed);
      expect(f.message, 'Fix it');
      expect(f.issues.single.reason, 'format');
    });

    test('an unreachable server is a network failure, not a throw', () async {
      final b = backend((_) async => throw http.ClientException('offline'));
      final f = await b.submit('contact', const BdSubmission(data: {})) as BdSubmitFailure;
      expect(f.reason, BdSubmitFailureReason.networkError);
      expect(f.status, 0);
    });

    test('uploads through the presigned URL without the key', () async {
      final b = backend((req) async {
        if (req.url.host == 'bd.test') {
          return ok('{"uploadUrl":"https://storage.test/put/1","storageId":"s1","publicUrl":"https://cdn.test/1"}');
        }
        return http.Response('', 200);
      });
      final stored = await b.upload('contact', 'docs', file('a.txt', 'text/plain', utf8.encode('hello')));
      expect(stored.url, 'https://cdn.test/1');
      expect(stored.size, 5);
      final [presign, put] = seen;
      expect(presign.url.toString(), 'https://bd.test/api/package/v1/forms/contact/upload-url');
      expect(presign.body, '{"fieldId":"docs","filename":"a.txt","contentType":"text/plain","sizeBytes":5}');
      expect(put.method, 'PUT');
      expect(put.headers['Authorization'], isNull, reason: 'the presigned URL carries its own authorization');
      expect(put.body, 'hello');
    });

    test('reads collection options and slots', () async {
      final b = backend((req) async {
        if (req.url.path.endsWith('collection-options')) {
          return ok('{"options":[{"value":"r1","label":"Gold","match":{"tier":"premium"}}]}');
        }
        return ok('{"slots":[{"startAt":"2026-11-24T15:00:00Z"}]}');
      });
      expect((await b.collectionOptions('contact', 'plan')).single.match?['tier'], 'premium');
      expect(await b.scheduleSlots('contact', 'when', 0, 86400000), ['2026-11-24T15:00:00Z']);
      expect(seen[0].url.queryParameters['fieldId'], 'plan');
      expect(seen[1].url.queryParameters['to'], '1970-01-02T00:00:00.000Z');
    });
  });
}
