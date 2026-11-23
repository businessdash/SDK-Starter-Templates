import 'package:businessdash_forms/businessdash_forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/cupertino.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class MockBackend implements BdFormsBackend {
  MockBackend(String fields, [String settings = '{}', String extra = ''])
      : schemaJson =
            '{"id":"form_1","slug":"contact","title":"Contact us","fields":$fields,"settings":$settings,"actions":[]$extra}';

  final String schemaJson;
  final submissions = <BdSubmission>[];
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
    return const BdSubmitSuccess(submissionId: 'sub_1');
  }

  @override
  Future<BdUploadedFile> upload(String form, String fieldId, BdPickedFile file) async => BdUploadedFile(
        storageId: 's/${file.name}',
        url: 'https://cdn.example.com/${file.name}',
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      );

  @override
  Future<List<String>> scheduleSlots(String form, String fieldId, int fromMs, int toMs) async => const [];

  @override
  Future<BdPaymentIntent> paymentIntent(String form, String fieldId) => throw UnimplementedError();

  @override
  Future<List<BdCollectionOption>> collectionOptions(String form, String fieldId) async => const [
        BdCollectionOption(value: 'r1', label: 'Oak table'),
        BdCollectionOption(value: 'r2', label: 'Pine shelf'),
      ];
}

const _contact = '''[
  {"id":"name","type":"text","label":"Full name","required":true,"outputKey":"name"},
  {"id":"email","type":"email","label":"Email","outputKey":"email"},
  {"id":"subscribe","type":"boolean","label":"Newsletter","placeholder":"Send me news","outputKey":"subscribe"},
  {"id":"topics_block","type":"condition_block","label":"",
   "conditionRule":{"fieldId":"subscribe","operator":"eq","value":"true"},
   "children":[{"id":"topics","type":"checkbox","label":"Topics","options":["Product","Events"],"outputKey":"topics"}]}
]''';

Widget _app(Widget form, {TargetPlatform? platform}) => MaterialApp(
      theme: ThemeData(platform: platform),
      home: Scaffold(body: form),
    );

Future<void> _pumpForm(WidgetTester tester, MockBackend backend, {TargetPlatform? platform, BdFormStyle? style}) async {
  await tester.pumpWidget(
    _app(
      BdForm.backend(form: 'contact', backend: backend, style: style ?? const BdFormStyle(animated: false)),
      platform: platform,
    ),
  );
  await tester.pumpAndSettle();
}

Finder _rich(String text) => find.text(text, findRichText: true);

/// Scrolls [text] into view and taps it, as a visitor would.
Future<void> _tap(WidgetTester tester, String text) async {
  final target = find.text(text).last;
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders the form, shows problems, and submits', (tester) async {
    final b = MockBackend(_contact);
    await _pumpForm(tester, b);

    expect(find.text('Contact us'), findsOneWidget);
    expect(_rich('Full name *'), findsOneWidget, reason: 'required fields carry the marker');
    expect(find.text('Topics'), findsNothing, reason: 'hidden until subscribed');

    await _tap(tester, 'Submit');
    expect(find.text('Full name is required.'), findsOneWidget);
    expect(find.text('Please complete the highlighted field(s).'), findsOneWidget);
    expect(b.submissions, isEmpty);

    await tester.enterText(find.byType(TextField).first, 'Jane Doe');
    await tester.enterText(find.byType(TextField).at(1), 'not-an-email');
    await _tap(tester, 'Submit');
    expect(find.textContaining('email'), findsWidgets);
    expect(b.submissions, isEmpty, reason: 'a bad email blocks the submit');

    await tester.enterText(find.byType(TextField).at(1), 'jane@acme.co');
    await _tap(tester, 'Submit');
    expect(find.text('Thank you'), findsOneWidget);
    expect(b.lastData['name'], const BdStr('Jane Doe'));
    expect(b.lastData['email'], const BdStr('jane@acme.co'));

    await tester.tap(find.text('Submit another response'));
    await tester.pumpAndSettle();
    expect(find.text('Submit'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, isEmpty);
  });

  testWidgets('a condition reveals its fields', (tester) async {
    final b = MockBackend(_contact);
    await _pumpForm(tester, b, style: const BdFormStyle());
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(find.text('Topics'), findsOneWidget);
    await _tap(tester, 'Events');
    await tester.enterText(find.byType(TextField).first, 'Jane');
    await _tap(tester, 'Submit');
    expect(b.lastData['subscribe'], const BdBool(true));
    expect(b.lastData['topics'], BdJson.parse('["Events"]'));
  });

  testWidgets('steps move forward and back, with progress', (tester) async {
    final b = MockBackend(
      '''[{"id":"kind","type":"radio","label":"Kind","required":true,"options":["Home","Business"]},
          {"id":"notes","type":"textarea","label":"Notes"}]''',
      '{"isConsecutive":true,"showProgress":true}',
    );
    await _pumpForm(tester, b);
    expect(find.text('Step 1 of 2 · Kind'), findsOneWidget);
    expect(find.text('Back'), findsNothing);

    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Kind is required.'), findsOneWidget);

    await tester.tap(find.text('Business'));
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Step 2 of 2 · Notes'), findsOneWidget);
    expect(find.text('Submit'), findsOneWidget);

    await tester.tap(find.text('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Step 1 of 2 · Kind'), findsOneWidget);
  });

  testWidgets('animated steps slide without leaving duplicates', (tester) async {
    final b = MockBackend(
      '''[{"id":"a","type":"text","label":"First"},{"id":"b","type":"text","label":"Second"}]''',
      '{"isConsecutive":true}',
    );
    await _pumpForm(tester, b, style: const BdFormStyle());
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('First'), findsNothing);
    expect(find.text('Second'), findsOneWidget);
  });

  testWidgets('iOS gets Cupertino controls', (tester) async {
    final b = MockBackend(_contact);
    await _pumpForm(tester, b, platform: TargetPlatform.iOS);
    expect(find.byType(CupertinoTextField), findsNWidgets(2));
    expect(find.byType(CupertinoSwitch), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.byType(CupertinoButton), findsWidgets);

    await tester.enterText(find.byType(CupertinoTextField).first, 'Jane');
    await _tap(tester, 'Submit');
    expect(b.lastData['name'], const BdStr('Jane'));
  });

  testWidgets('a short select opens a menu and picks', (tester) async {
    final b = MockBackend('[{"id":"size","type":"select","label":"Size","options":["Small","Medium","Large"]}]');
    await _pumpForm(tester, b);
    await tester.tap(find.text('Select…'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Medium').last);
    await tester.pumpAndSettle();
    expect(find.text('Medium'), findsOneWidget);
    await _tap(tester, 'Submit');
    expect(b.lastData['size'], const BdStr('Medium'));
  });

  testWidgets('a long select searches in a sheet', (tester) async {
    final states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware'];
    final opts = states.map((s) => '"$s"').join(',');
    final b = MockBackend('[{"id":"st","type":"select","label":"State","display":"combobox","options":[$opts]}]');
    await _pumpForm(tester, b);
    await tester.tap(find.text('Select…'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Search'), 'ark');
    await tester.pumpAndSettle();
    expect(find.text('Alaska'), findsNothing);
    await tester.tap(find.text('Arkansas'));
    await tester.pumpAndSettle();
    expect(find.text('Arkansas'), findsOneWidget, reason: 'the sheet closed and the field shows the answer');
  });

  testWidgets('repeaters add and remove entries', (tester) async {
    final b = MockBackend(
      '''[{"id":"kids","type":"multi_populator","label":"Children","populatorConfig":{"maxInstances":3,"itemLabel":"Child"},
           "children":[{"id":"kname","type":"text","label":"Name"}]}]''',
    );
    await _pumpForm(tester, b);
    expect(find.text('Child 1'), findsOneWidget);
    await tester.tap(find.text('Add another'));
    await tester.pumpAndSettle();
    expect(find.text('Child 2'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(1), 'Sam');
    await tester.tap(find.byTooltip('Remove entry 1'));
    await tester.pumpAndSettle();
    expect(find.text('Child 2'), findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, 'Sam',
        reason: 'the remaining entry keeps its answer');
  });

  testWidgets('calculations follow the numbers typed', (tester) async {
    final b = MockBackend(
      '''[{"id":"qty","type":"number","label":"Qty"},{"id":"price","type":"currency","label":"Price"},
          {"id":"total","type":"calculation","label":"Total",
           "calculationConfig":{"formula":"q * p","inputMap":[{"variable":"q","fieldId":"qty"},{"variable":"p","fieldId":"price"}],
           "display":{"prefix":"\$","decimals":2}}}]''',
    );
    await _pumpForm(tester, b);
    await tester.enterText(find.byType(TextField).at(0), '3');
    await tester.enterText(find.byType(TextField).at(1), '2.5');
    await tester.pumpAndSettle();
    expect(find.text(r'$7.50'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(0), '3a');
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, '3', reason: 'letters are filtered out');
  });

  testWidgets('collection options load and pick', (tester) async {
    final b = MockBackend('[{"id":"item","type":"collection_select","label":"Item"}]');
    await _pumpForm(tester, b);
    expect(find.text('Oak table'), findsOneWidget);
    await tester.tap(find.text('Pine shelf'));
    await _tap(tester, 'Submit');
    expect(b.lastData['item'], const BdStr('r2'));
  });

  testWidgets('a form that fails to load offers a retry', (tester) async {
    final b = MockBackend(_contact)..schemaError = const BdFormsException('Form not found.', status: 404);
    await _pumpForm(tester, b);
    expect(find.text("This form couldn't be loaded."), findsOneWidget);
    expect(find.text('Form not found.'), findsOneWidget);
    b.schemaError = null;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Contact us'), findsOneWidget);
  });

  testWidgets('leaving with unsent answers asks first', (tester) async {
    final b = MockBackend(_contact, '{"exitConfirm":{"enabled":true}}');
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => Scaffold(body: BdForm.backend(form: 'contact', backend: b)),
                  ),
                ),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Jane');
    await tester.pump();

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    await navigator.maybePop();
    await tester.pumpAndSettle();
    expect(find.text('Leave this form?'), findsOneWidget);
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(find.text('Contact us'), findsOneWidget);

    await navigator.maybePop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Leave'));
    await tester.pumpAndSettle();
    expect(find.text('Open'), findsOneWidget);
  });

  testWidgets('custom renderers replace a type', (tester) async {
    final b = MockBackend('[{"id":"stars","type":"star_rating","label":"Rate us"}]');
    await tester.pumpWidget(
      _app(
        BdForm.backend(
          form: 'contact',
          backend: b,
          renderers: const BdFieldRenderers().forType(
            'star_rating',
            (context, f) => TextButton(onPressed: () => f.set(const BdNum(5)), child: Text('Five (${f.value?.doubleValue ?? 0})')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(_rich('Rate us'), findsOneWidget, reason: 'the label still draws around a custom control');
    await tester.tap(find.text('Five (0.0)'));
    await tester.pumpAndSettle();
    expect(find.text('Five (5.0)'), findsOneWidget);
  });

  testWidgets('the grouped layout puts each question on a card', (tester) async {
    final b = MockBackend(_contact);
    await _pumpForm(tester, b, style: const BdFormStyle(layout: BdFormLayout.grouped, animated: false));
    final cards = find.ancestor(of: _rich('Full name *'), matching: find.byType(Container));
    expect(cards, findsWidgets);
  });

  testWidgets('works inside a CupertinoApp, sheets and dialogs included', (tester) async {
    final b = MockBackend(
      '[{"id":"size","type":"select","label":"Size","options":["Small","Medium","Large"]},'
      '{"id":"when","type":"date","label":"When"}]',
    );
    for (final controls in [BdControlStyle.cupertino, BdControlStyle.material]) {
      await tester.pumpWidget(
        CupertinoApp(
          home: CupertinoPageScaffold(
            child: BdForm.backend(form: 'contact', backend: b, style: BdFormStyle(controls: controls, animated: false)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _tap(tester, 'Select…');
      await _tap(tester, 'Large');
      expect(find.text('Large'), findsOneWidget, reason: '$controls');
      await _tap(tester, 'Add date');
      expect(tester.takeException(), isNull);
      await _tap(tester, controls == BdControlStyle.cupertino ? 'Done' : 'OK');
      expect(find.text('Add date'), findsNothing, reason: 'a date was picked with $controls');
      await tester.pumpWidget(const SizedBox());
    }
  });
}
