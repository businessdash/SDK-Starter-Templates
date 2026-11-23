package app.bdstarter

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import app.bd.forms.BdSubmitOptions
import app.bd.forms.ui.BdForm

/**
 * A BusinessDash form drawn with native Material 3 controls: no web view.
 *
 * With `bd.form` and `bd.publishableKey` in local.properties this is the live
 * form; otherwise it's the bundled sample, so the tab works before setup.
 */
@Composable
fun FormScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val onSubmitted: (app.bd.forms.BdSubmitSuccess) -> Unit = { result ->
        Toast.makeText(context, "Submitted ${result.submissionId.orEmpty()}", Toast.LENGTH_SHORT).show()
    }

    if (BuildConfig.BD_FORM.isNotEmpty() && BuildConfig.BD_PK.isNotEmpty()) {
        BdForm(
            form = BuildConfig.BD_FORM,
            publishableKey = BuildConfig.BD_PK,
            host = BuildConfig.BD_HOST,
            submitOptions = BdSubmitOptions(source = "android-starter"),
            modifier = modifier,
            onSubmitted = onSubmitted,
        )
    } else {
        val backend = remember { DemoFormsBackend(context) }
        BdForm(form = "demo", backend = backend, modifier = modifier, onSubmitted = onSubmitted)
    }
}
