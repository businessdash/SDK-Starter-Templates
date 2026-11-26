import 'package:businessdash_forms/businessdash_forms.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import '../forms/form_hooks.dart';

/// A BusinessDash form in native widgets.
///
/// Run with `--dart-define=BD_FORM=<slug>` (and `BD_PK`) and this is that
/// live form: validation, conditions, steps, uploads and submit all run
/// against BusinessDash. Without it, it's a built-in sample with every kind
/// of field that submits nowhere, so the tab works on a fresh clone.
class FormPage extends StatelessWidget {
  const FormPage(
      {super.key,
      required this.host,
      required this.publishableKey,
      required this.form});

  final String host;
  final String publishableKey;
  final String form;

  bool get isLive => form.isNotEmpty && publishableKey.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    void submitted(BdSubmitSuccess result) {
      final text = isLive
          ? 'Sent (${result.submissionId ?? 'ok'}).'
          : 'Sample submitted — nothing was sent; the payload is in the log.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Form')),
      body: isLive
          ? BdForm(
              form: form,
              publishableKey: publishableKey,
              host: host,
              pickFiles: pickFiles,
              openLink: openLink,
              onSubmitted: submitted,
            )
          : BdForm.backend(
              form: demoSchema.slug,
              backend: DemoFormsBackend(),
              host: host,
              pickFiles: pickFiles,
              openLink: openLink,
              onSubmitted: submitted,
            ),
    );
  }
}
