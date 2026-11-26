import 'forms_data.generated.dart' as data;
import 'json.dart';

/// One unit of a measurement category, e.g. `ft` in length.
///
/// [factor] converts to the category's base unit (`value * factor`). For
/// affine categories (temperature) the factor is unused and conversion is by
/// formula.
class BdUnit {
  const BdUnit({required this.symbol, required this.factor});

  final String symbol;
  final double factor;
}

/// A measurement category (length, mass, temperature, …) and its units.
class BdUnitCategory {
  const BdUnitCategory({
    required this.key,
    required this.label,
    required this.baseUnit,
    required this.isAffine,
    required this.units,
  });

  final String key;
  final String label;
  final String baseUnit;
  final bool isAffine;
  final List<BdUnit> units;

  /// Does this category offer [unit]?
  bool contains(String unit) => units.any((u) => u.symbol == unit);

  BdUnit? unit(String symbol) {
    for (final u in units) {
      if (u.symbol == symbol) return u;
    }
    return null;
  }
}

/// Measurement conversion: the same table and arithmetic as forms-core's
/// `units.ts` (the table itself is generated from it).
abstract final class BdUnits {
  static List<BdUnitCategory> get categories => data.unitCategories;

  static BdUnitCategory? category(String? key) {
    if (key == null) return null;
    for (final c in data.unitCategories) {
      if (c.key == key) return c;
    }
    return null;
  }

  static double? convertToBase(double value, String unit, BdUnitCategory cat) {
    final u = cat.unit(unit);
    if (u == null) return null;
    if (cat.isAffine) {
      return switch (unit) {
        '°C' => value,
        '°F' => (value - 32) * (5.0 / 9.0),
        'K' => value - 273.15,
        _ => null,
      };
    }
    return value * u.factor;
  }

  static double? convertFromBase(double base, String unit, BdUnitCategory cat) {
    final u = cat.unit(unit);
    if (u == null) return null;
    if (cat.isAffine) {
      return switch (unit) {
        '°C' => base,
        '°F' => base * (9.0 / 5.0) + 32,
        'K' => base + 273.15,
        _ => null,
      };
    }
    return base / u.factor;
  }

  /// A friendly restatement: 1500 m → "1.5 km". Picks the largest unit the
  /// value reaches, rounded to 4 places.
  static String format(double? value, String unit, BdUnitCategory cat) {
    if (value == null || value.isNaN) return '';
    String tidy(double n) =>
        BdJS.formatNumber(BdJS.parseNumber(BdJS.toFixed(n, 4)));
    final base = !cat.isAffine && cat.contains(unit)
        ? convertToBase(value, unit, cat)
        : null;
    if (base == null) return '${tidy(value)} $unit';
    final indexed = [
      for (var i = 0; i < cat.units.length; i++) (i, cat.units[i])
    ];
    indexed.sort((a, b) {
      final byFactor = b.$2.factor.compareTo(a.$2.factor);
      return byFactor != 0 ? byFactor : a.$1.compareTo(b.$1);
    });
    final ordered = [for (final (_, u) in indexed) u];
    final magnitude = base.abs();
    for (final u in ordered) {
      if (magnitude >= u.factor || u.symbol == ordered.last.symbol) {
        return '${tidy(base / u.factor)} ${u.symbol}';
      }
    }
    return '${tidy(value)} $unit';
  }
}
