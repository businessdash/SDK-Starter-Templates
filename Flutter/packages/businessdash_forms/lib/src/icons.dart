import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import 'style.dart';

/// One of BD's element icons (the Lucide set), drawn natively.
///
/// BD serves each icon as a 24×24 stroked SVG made of a handful of
/// primitives; this turns it into paths once and caches them, so it draws
/// like any icon and takes [color].
class BdIcon extends StatefulWidget {
  const BdIcon(this.name, {super.key, this.size = 20, this.color, this.baseUrl});

  final String name;
  final double size;

  /// Null = the surrounding icon color.
  final Color? color;

  /// Where `/api/icons` lives. Null = the form's host.
  final String? baseUrl;

  @override
  State<BdIcon> createState() => _BdIconState();
}

class _BdIconState extends State<BdIcon> {
  BdSvgIcon? _icon;
  String? _key;

  String get _base {
    if (widget.baseUrl case final base?) return base;
    final scope = context.getInheritedWidgetOfExactType<BdFormScope>();
    return scope?.iconBaseUrl ?? bdDefaultHost;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _resolve();
  }

  @override
  void didUpdateWidget(BdIcon old) {
    super.didUpdateWidget(old);
    if (old.name != widget.name || old.baseUrl != widget.baseUrl) _resolve();
  }

  void _resolve() {
    final base = _base;
    final key = '$base|${widget.name}';
    if (key == _key) return;
    _key = key;
    _icon = BdIconStore.cached(base, widget.name);
    if (_icon != null) return;
    BdIconStore.icon(base, widget.name).then((icon) {
      if (mounted && _key == key) setState(() => _icon = icon);
    });
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? IconTheme.of(context).color ?? const Color(0xFF000000);
    return SizedBox.square(
      dimension: widget.size,
      child: _icon == null ? null : CustomPaint(painter: BdSvgPainter(_icon!, color)),
    );
  }
}

/// A built-in glyph (no network), for the renderer's own buttons.
class BdGlyph extends StatelessWidget {
  const BdGlyph(this.icon, {super.key, this.size = 24, this.color});

  final BdSvgIcon icon;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final color = this.color ?? IconTheme.of(context).color ?? const Color(0xFF000000);
    return SizedBox.square(dimension: size, child: CustomPaint(painter: BdSvgPainter(icon, color)));
  }
}

/// The few icons the renderer draws itself, from Lucide (ISC license).
abstract final class BdGlyphs {
  static final file = BdSvg.parse(
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  );
  static final image = BdSvg.parse(
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>'
    '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  );
  static final card = BdSvg.parse('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>');
  static final tag = BdSvg.parse(
    '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704'
    'a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  );
}

/// An icon's shapes in a 24×24 box: stroked unless the SVG fills them.
class BdSvgIcon {
  const BdSvgIcon(this.parts);

  final List<({Path path, bool filled})> parts;

  bool get isEmpty => parts.isEmpty;
}

class BdSvgPainter extends CustomPainter {
  BdSvgPainter(this.icon, this.color);

  final BdSvgIcon icon;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;
    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;
    for (final part in icon.parts) {
      canvas.drawPath(part.path, part.filled ? fill : stroke);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(BdSvgPainter old) => old.icon != icon || old.color != color;
}

/// Just enough SVG for Lucide: circle, ellipse, line, path, polygon,
/// polyline and rect, in a 24×24 box.
abstract final class BdSvg {
  static final _element = RegExp(r'<(circle|ellipse|line|path|polygon|polyline|rect)\b([^>]*?)/?>');
  static final _attribute = RegExp(r'([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"');
  static final _number = RegExp(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?');

  static BdSvgIcon parse(String svg) {
    final parts = <({Path path, bool filled})>[];
    for (final m in _element.allMatches(svg)) {
      final a = {for (final at in _attribute.allMatches(m[2]!)) at[1]!: at[2]!};
      double n(String k) => double.tryParse(a[k] ?? '') ?? 0;
      Path? path;
      switch (m[1]) {
        case 'path':
          try {
            path = parsePath(a['d'] ?? '');
          } on FormatException {
            path = null;
          }
        case 'circle':
          path = Path()..addOval(Rect.fromCircle(center: Offset(n('cx'), n('cy')), radius: n('r')));
        case 'ellipse':
          path = Path()
            ..addOval(Rect.fromCenter(center: Offset(n('cx'), n('cy')), width: 2 * n('rx'), height: 2 * n('ry')));
        case 'line':
          path = Path()
            ..moveTo(n('x1'), n('y1'))
            ..lineTo(n('x2'), n('y2'));
        case 'rect':
          final rx = a['rx'] != null ? n('rx') : n('ry');
          final ry = a['ry'] != null ? n('ry') : rx;
          final w = n('width'), h = n('height');
          path = Path()
            ..addRRect(
              RRect.fromRectXY(
                Rect.fromLTWH(n('x'), n('y'), w, h),
                rx.clamp(0, w / 2).toDouble(),
                ry.clamp(0, h / 2).toDouble(),
              ),
            );
        case 'polygon' || 'polyline':
          final nums = [for (final x in _number.allMatches(a['points'] ?? '')) double.parse(x[0]!)];
          final p = Path();
          for (var i = 0; i + 1 < nums.length; i += 2) {
            if (i == 0) {
              p.moveTo(nums[i], nums[i + 1]);
            } else {
              p.lineTo(nums[i], nums[i + 1]);
            }
          }
          if (m[1] == 'polygon') p.close();
          path = p;
      }
      if (path == null) continue;
      parts.add((path: path, filled: a['fill'] == 'currentColor'));
    }
    return BdSvgIcon(parts);
  }

  /// An SVG path's `d`: every command, absolute and relative.
  static Path parsePath(String d) {
    final p = Path();
    final s = _PathScanner(d);
    var cmd = '';
    var x = 0.0, y = 0.0, startX = 0.0, startY = 0.0;
    // The last control point, for S and T reflections.
    double? cx, cy;
    var last = '';
    while (true) {
      final c = s.command();
      if (c != null) {
        cmd = c;
      } else if (cmd.isEmpty || cmd.toUpperCase() == 'Z' || !s.atNumber) {
        break;
      }
      final rel = cmd != cmd.toUpperCase();
      final ox = rel ? x : 0.0, oy = rel ? y : 0.0;
      switch (cmd.toUpperCase()) {
        case 'M':
          x = ox + s.number();
          y = oy + s.number();
          p.moveTo(x, y);
          startX = x;
          startY = y;
          // More pairs after a move are lines.
          cmd = rel ? 'l' : 'L';
        case 'L':
          x = ox + s.number();
          y = oy + s.number();
          p.lineTo(x, y);
        case 'H':
          x = ox + s.number();
          p.lineTo(x, y);
        case 'V':
          y = oy + s.number();
          p.lineTo(x, y);
        case 'C':
          final x1 = ox + s.number(), y1 = oy + s.number();
          final x2 = ox + s.number(), y2 = oy + s.number();
          x = ox + s.number();
          y = oy + s.number();
          p.cubicTo(x1, y1, x2, y2, x, y);
          cx = x2;
          cy = y2;
        case 'S':
          final x1 = (last == 'C' || last == 'S') && cx != null ? 2 * x - cx : x;
          final y1 = (last == 'C' || last == 'S') && cy != null ? 2 * y - cy : y;
          final x2 = ox + s.number(), y2 = oy + s.number();
          x = ox + s.number();
          y = oy + s.number();
          p.cubicTo(x1, y1, x2, y2, x, y);
          cx = x2;
          cy = y2;
        case 'Q':
          final x1 = ox + s.number(), y1 = oy + s.number();
          x = ox + s.number();
          y = oy + s.number();
          p.quadraticBezierTo(x1, y1, x, y);
          cx = x1;
          cy = y1;
        case 'T':
          final x1 = (last == 'Q' || last == 'T') && cx != null ? 2 * x - cx : x;
          final y1 = (last == 'Q' || last == 'T') && cy != null ? 2 * y - cy : y;
          x = ox + s.number();
          y = oy + s.number();
          p.quadraticBezierTo(x1, y1, x, y);
          cx = x1;
          cy = y1;
        case 'A':
          final rx = s.number(), ry = s.number(), rotation = s.number();
          final large = s.flag(), sweep = s.flag();
          x = ox + s.number();
          y = oy + s.number();
          p.arcToPoint(
            Offset(x, y),
            radius: Radius.elliptical(rx.abs(), ry.abs()),
            rotation: rotation,
            largeArc: large,
            clockwise: sweep,
          );
        case 'Z':
          p.close();
          x = startX;
          y = startY;
        default:
          throw FormatException('Unknown path command $cmd');
      }
      last = cmd.toUpperCase();
    }
    return p;
  }
}

class _PathScanner {
  _PathScanner(this.s);

  final String s;
  var i = 0;

  void _skip() {
    while (i < s.length) {
      final c = s.codeUnitAt(i);
      if (c == 0x20 || c == 0x2C || c == 0x0A || c == 0x0D || c == 0x09) {
        i++;
      } else {
        break;
      }
    }
  }

  bool get atNumber {
    _skip();
    if (i >= s.length) return false;
    final c = s.codeUnitAt(i);
    return (c >= 0x30 && c <= 0x39) || c == 0x2D || c == 0x2B || c == 0x2E;
  }

  String? command() {
    _skip();
    if (i >= s.length) return null;
    final c = s.codeUnitAt(i);
    if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) {
      i++;
      return String.fromCharCode(c);
    }
    return null;
  }

  double number() {
    _skip();
    final m = BdSvg._number.matchAsPrefix(s, i);
    if (m == null) throw const FormatException('Expected a number');
    i = m.end;
    return double.parse(m[0]!);
  }

  /// An arc flag: one digit, which may run straight into the next number.
  bool flag() {
    _skip();
    if (i >= s.length) throw const FormatException('Expected a flag');
    final c = s[i++];
    if (c != '0' && c != '1') throw const FormatException('Bad arc flag');
    return c == '1';
  }
}

/// Icons by name, fetched once per host and kept for the process.
abstract final class BdIconStore {
  static final _icons = <String, BdSvgIcon>{};
  static final _inFlight = <String, Future<BdSvgIcon?>>{};
  static final _names = <String, List<String>>{};
  static final _validName = RegExp(r'^[a-z0-9-]+$');

  /// The client icons are fetched with. Replace in tests.
  static http.Client client = http.Client();

  static BdSvgIcon? cached(String base, String name) => _icons['$base|$name'];

  static Future<BdSvgIcon?> icon(String base, String name) {
    if (!_validName.hasMatch(name)) return Future.value();
    final key = '$base|$name';
    if (_icons[key] case final icon?) return Future.value(icon);
    return _inFlight.putIfAbsent(key, () async {
      try {
        final res = await client.get(Uri.parse('$base/api/icons/$name.svg')).timeout(const Duration(seconds: 15));
        if (res.statusCode != 200 || res.bodyBytes.length > 256 * 1024) return null;
        final icon = BdSvg.parse(utf8.decode(res.bodyBytes, allowMalformed: true));
        if (icon.isEmpty) return null;
        _icons[key] = icon;
        return icon;
      } catch (_) {
        return null;
      } finally {
        _inFlight.remove(key);
      }
    });
  }

  /// Every icon name BD offers (for an unrestricted icon picker).
  static Future<List<String>> allNames(String base) async {
    if (_names[base] case final names?) return names;
    try {
      final res = await client.get(Uri.parse('$base/api/icons')).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return const [];
      final body = jsonDecode(utf8.decode(res.bodyBytes));
      final icons = body is Map ? body['icons'] : null;
      final list = icons is List ? [for (final n in icons) if (n is String) n] : <String>[];
      if (list.isNotEmpty) _names[base] = list;
      return list;
    } catch (_) {
      return const [];
    }
  }
}
