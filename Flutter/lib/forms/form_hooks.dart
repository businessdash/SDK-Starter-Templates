import 'dart:convert';

import 'package:businessdash_forms/businessdash_forms.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'demo_form.dart';

/// The pieces `BdForm` leaves to the app: picking files, opening links,
/// and (for the sample form) a backend that submits nowhere. All three
/// plugins are Flutter's own; any picker that returns bytes works.

// ── Files ────────────────────────────────────────────────────────────────

/// Extension → (MIME type, Apple uniform type), for the document picker's
/// filters and for naming what comes back.
const _types = <String, (String, String)>{
  'pdf': ('application/pdf', 'com.adobe.pdf'),
  'jpg': ('image/jpeg', 'public.jpeg'),
  'jpeg': ('image/jpeg', 'public.jpeg'),
  'png': ('image/png', 'public.png'),
  'gif': ('image/gif', 'com.compuserve.gif'),
  'webp': ('image/webp', 'org.webmproject.webp'),
  'heic': ('image/heic', 'public.heic'),
  'txt': ('text/plain', 'public.plain-text'),
  'csv': ('text/csv', 'public.comma-separated-values-text'),
  'doc': ('application/msword', 'com.microsoft.word.doc'),
  'docx': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'org.openxmlformats.wordprocessingml.document'),
  'xls': ('application/vnd.ms-excel', 'com.microsoft.excel.xls'),
  'xlsx': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'org.openxmlformats.spreadsheetml.sheet'),
  'zip': ('application/zip', 'public.zip-archive'),
};

String _mimeOf(String name, String? reported) {
  if (reported != null && reported.isNotEmpty) return reported;
  final dot = name.lastIndexOf('.');
  final ext = dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
  return _types[ext]?.$1 ?? 'application/octet-stream';
}

/// The author's allowed types as one picker filter, or none (any file).
List<XTypeGroup> _filters(List<String> allowed) {
  if (allowed.isEmpty) return const [];
  final extensions = <String>{}, mimes = <String>{}, utis = <String>{};
  for (final raw in allowed) {
    final t = raw.trim().toLowerCase();
    if (t.startsWith('.')) {
      final known = _types[t.substring(1)];
      extensions.add(t.substring(1));
      if (known != null) {
        mimes.add(known.$1);
        utis.add(known.$2);
      }
    } else if (t == 'image/*') {
      mimes.add(t);
      utis.add('public.image');
    } else if (t.contains('/')) {
      mimes.add(t);
      for (final known in _types.values) {
        if (known.$1 == t) utis.add(known.$2);
      }
    }
  }
  // iOS filters by uniform type only; without one, let anything through and
  // leave the check to the form (it rejects types the author didn't allow).
  if (utis.isEmpty && defaultTargetPlatform == TargetPlatform.iOS) return const [];
  return [
    XTypeGroup(
      label: 'Allowed files',
      extensions: extensions.toList(),
      mimeTypes: mimes.toList(),
      uniformTypeIdentifiers: utis.toList(),
    ),
  ];
}

/// Documents through the system file picker, photos through the library.
Future<List<BdPickedFile>> pickFiles(BdFileRequest request) async {
  final List<XFile> files;
  if (request.kind == 'images') {
    final picker = ImagePicker();
    if (request.multiple) {
      files = await picker.pickMultiImage(imageQuality: 90);
    } else {
      final one = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
      files = [?one];
    }
  } else {
    final groups = _filters(request.allowedTypes);
    if (request.multiple) {
      files = await openFiles(acceptedTypeGroups: groups);
    } else {
      final one = await openFile(acceptedTypeGroups: groups);
      files = [?one];
    }
  }
  return [
    for (final f in files) BdPickedFile(data: await f.readAsBytes(), name: f.name, mimeType: _mimeOf(f.name, f.mimeType)),
  ];
}

// ── Links ────────────────────────────────────────────────────────────────

/// Opens a link from the form in the browser (or mail / phone app).
Future<void> openLink(Uri uri) async {
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

// ── The sample form ──────────────────────────────────────────────────────

/// The built-in sample: every kind of field, nothing sent anywhere.
final demoSchema = BdFormSchema.parse(demoFormJson);

/// A backend for the sample form: "uploads" stay on the device and the
/// submission is printed instead of sent, so the form can be tried end to
/// end on a fresh clone.
class DemoFormsBackend implements BdFormsBackend {
  @override
  Future<BdFormSchema> schema(String form) async => demoSchema;

  @override
  Future<BdSubmitResult> submit(String form, BdSubmission submission) async {
    debugPrint('Sample submission: ${const JsonEncoder.withIndent('  ').convert(BdObj(submission.data).toPlain())}');
    return BdSubmitSuccess(status: 200, submissionId: 'demo-${DateTime.now().millisecondsSinceEpoch}', dryRun: true);
  }

  @override
  Future<BdUploadedFile> upload(String form, String fieldId, BdPickedFile file) async => BdUploadedFile(
        storageId: 'demo/${file.name}',
        url: 'https://example.com/uploads/${Uri.encodeComponent(file.name)}',
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      );

  @override
  Future<List<String>> scheduleSlots(String form, String fieldId, int fromMs, int toMs) async => const [];

  @override
  Future<BdPaymentIntent> paymentIntent(String form, String fieldId) async =>
      throw const BdFormsException('Card entry needs a live form.');

  @override
  Future<List<BdCollectionOption>> collectionOptions(String form, String fieldId) async => const [];
}
