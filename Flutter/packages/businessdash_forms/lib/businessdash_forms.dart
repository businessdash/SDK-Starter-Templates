/// Native BusinessDash forms for Flutter.
///
/// ```dart
/// import 'package:businessdash_forms/businessdash_forms.dart';
///
/// BdForm(form: 'contact', publishableKey: 'pk_live_…')
/// ```
///
/// [BdForm] draws Material controls on Android and Cupertino ones on iOS,
/// and runs every rule through the engine in `businessdash_sdk`
/// (re-exported here): validation, conditions, steps, calculations,
/// uploads and submission behave exactly as they do on the web.
///
/// [BdSignIn] is the business's own sign-in screen, drawn the same way:
/// password, emailed codes and "Continue with Google / Apple / GitHub /
/// Discord", through BD's `auth/customer/*` routes (WorkOS underneath).
///
/// [BdQuiz] takes a BD quiz, invited or practice, the same way: lettered
/// choices, typed answers, a countdown, each answer's verdict and the results.
library;

export 'package:businessdash_sdk/forms.dart';

export 'src/form.dart' show BdForm, BdFormControllerListenable;
export 'src/icons.dart' show BdIcon, BdIconStore;
export 'src/quiz.dart'
    show BdQuiz, BdQuizInvitationSource, BdQuizPracticeSource, BdQuizSource;
export 'src/primitives.dart'
    show BdOption, BdOptionPicker, BdTextInput, BdKeyboard;
export 'src/style.dart'
    show
        BdButtonProminence,
        BdControlStyle,
        BdFieldContext,
        BdFieldRenderer,
        BdFieldRenderers,
        BdFilePicker,
        BdFileRequest,
        BdFormLayout,
        BdFormScope,
        BdFormStrings,
        BdFormStyle,
        BdLinkOpener,
        bdDefaultHost;
export 'src/tree.dart' show BdFieldControl;

// The business's own sign-in screen, and the logic behind it.
export 'src/sign_in.dart' show BdSignIn;
export 'src/sign_in_core.dart';
