package app.bdstarter

import android.content.Context
import android.util.Log
import app.bd.forms.BdCollectionOption
import app.bd.forms.BdFormSchema
import app.bd.forms.BdFormsBackend
import app.bd.forms.BdFormsException
import app.bd.forms.BdPaymentIntent
import app.bd.forms.BdPickedFile
import app.bd.forms.BdSubmission
import app.bd.forms.BdSubmitResult
import app.bd.forms.BdSubmitSuccess
import app.bd.forms.BdUploadedFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * The Form tab's offline stand-in for BD: the sample form in
 * `assets/bd-demo-form.json`, and submissions that succeed without being sent.
 *
 * The real thing is one line, `BdForm(form = "slug", publishableKey = pk)`,
 * which the Form tab uses as soon as `bd.form` is set in local.properties.
 */
class DemoFormsBackend(context: Context) : BdFormsBackend {
    private val assets = context.applicationContext.assets

    override suspend fun schema(form: String): BdFormSchema = withContext(Dispatchers.IO) {
        BdFormSchema.fromJson(assets.open("bd-demo-form.json").bufferedReader().use { it.readText() })
    }

    override suspend fun submit(form: String, submission: BdSubmission): BdSubmitResult {
        // What a live form would send: `adb logcat -s BdStarter`.
        Log.i("BdStarter", "Sample submission: " + submission.toJson().toJsonString(sortKeys = true))
        delay(600)
        return BdSubmitSuccess(submissionId = "demo-" + UUID.randomUUID().toString().take(8), dryRun = true)
    }

    override suspend fun upload(form: String, fieldId: String, file: BdPickedFile): BdUploadedFile {
        delay(300)
        return BdUploadedFile(UUID.randomUUID().toString(), "", file.name, file.mimeType, file.size)
    }

    override suspend fun scheduleSlots(form: String, fieldId: String, fromMs: Long, toMs: Long): List<String> = emptyList()

    override suspend fun paymentIntent(form: String, fieldId: String): BdPaymentIntent =
        throw BdFormsException(message = "The sample form doesn't take cards.")

    override suspend fun collectionOptions(form: String, fieldId: String): List<BdCollectionOption> = emptyList()
}
