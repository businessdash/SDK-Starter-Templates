/// BusinessDash forms, natively: the schema, the rules engine and a headless
/// controller.
///
/// BD's form rules (conditions, required fields, validation, formulas,
/// calculations, units, the submission payload) ported from the TypeScript
/// forms-core and checked against it case by case, so a Dart app tells a
/// visitor exactly what the web form and the server would.
///
/// For widgets, use `package:businessdash_forms`, which renders a
/// [BdFormController] with Material and Cupertino controls. To build your own
/// UI, drive a [BdFormController] directly.
library;

export 'src/forms/backend.dart';
export 'src/forms/calculation.dart';
export 'src/forms/controller.dart';
export 'src/forms/dates.dart';
export 'src/forms/formula.dart';
export 'src/forms/json.dart';
export 'src/forms/rules.dart';
export 'src/forms/schema.dart';
export 'src/forms/units.dart';
