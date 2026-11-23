package app.bd.forms

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.test.runTest

private fun json(text: String): BdJson = BdJson.from(formsJson.parseToJsonElement(text))

/** A backend that records what it was sent and answers from a script. */
private class MockBackend(fields: String, settings: String = "{}") : BdFormsBackend {
    val schemaJson = """{"id":"form_1","slug":"contact","name":"Contact","fields":$fields,"settings":$settings,"actions":[]}"""
    var submitAnswer: Pair<Int, Map<String, BdJson>> = 201 to mapOf("submissionId" to BdJson.Str("sub_1"))
    val submissions = mutableListOf<BdSubmission>()
    val uploads = mutableListOf<String>()
    var failUploads = false

    override suspend fun schema(form: String): BdFormSchema = BdFormSchema.fromJson(schemaJson)

    override suspend fun submit(form: String, submission: BdSubmission): BdSubmitResult {
        submissions.add(submission)
        val (status, body) = submitAnswer
        if (status in 200..299) return BdSubmitSuccess(status, body["submissionId"]?.stringValue, false, body)
        return BdPackageFormsBackend.failure(status, body)
    }

    override suspend fun upload(form: String, fieldId: String, file: BdPickedFile): BdUploadedFile {
        if (failUploads) throw BdFormsException(500, "Upload failed.")
        uploads.add(file.name)
        return BdUploadedFile("s/${file.name}", "https://cdn.example.com/${file.name}", file.name, file.mimeType, file.size)
    }

    override suspend fun scheduleSlots(form: String, fieldId: String, fromMs: Long, toMs: Long): List<String> =
        listOf("2026-11-24T15:00:00Z", "2026-11-24T16:00:00Z", "2026-11-25T15:00:00Z")

    override suspend fun paymentIntent(form: String, fieldId: String): BdPaymentIntent =
        BdPaymentIntent("card_on_file", "cs", "seti_1", "pk", "acct")

    override suspend fun collectionOptions(form: String, fieldId: String): List<BdCollectionOption> = listOf(
        BdCollectionOption("r1", "Gold", match = mapOf("tier" to "premium")),
        BdCollectionOption("r2", "Basic", match = mapOf("tier" to "standard")),
    )

    val lastData: Map<String, BdJson> get() = submissions.lastOrNull()?.data ?: emptyMap()
}

private suspend fun loaded(backend: MockBackend, scope: CoroutineScope): BdFormController =
    BdFormController("contact", backend, scope = scope).also { it.load() }

private fun str(s: String) = BdJson.Str(s)

class FormControllerTest {
    @Test fun loadsAndSubmitsWithOutputKeys() = runTest {
        val b = MockBackend(
            """[{"id":"f1","type":"text","label":"Your name","required":true,"key":"full_name"},
                {"id":"f2","type":"email","label":"Email","required":true},
                {"id":"t","type":"title","label":"Hello"}]""",
        )
        val c = loaded(b, backgroundScope)
        assertEquals(BdFormState.Phase.Ready, c.phase)
        c.setValue(str("Ada"), "f1")
        c.setValue(str("ada@example.com"), "f2")
        val r = c.submit()
        assertTrue(r.isSuccess)
        assertTrue(c.isSubmitted)
        assertEquals(str("Ada"), b.lastData["full_name"])
        assertEquals(str("ada@example.com"), b.lastData["f2"])
        assertNull(b.lastData["t"])
    }

    @Test fun requiredAndFormatErrorsBlockSubmit() = runTest {
        val b = MockBackend(
            """[{"id":"name","type":"text","label":"Name","required":true},{"id":"email","type":"email","label":"Email"}]""",
        )
        val c = loaded(b, backgroundScope)
        c.setValue(str("not-an-email"), "email")
        val f = assertIs<BdSubmitFailure>(c.submit())
        assertEquals(BdSubmitFailure.Reason.ClientValidationFailed, f.reason)
        assertEquals("Name is required.", c.error("name"))
        assertEquals("Enter a valid email address.", c.error("email"))
        assertTrue(b.submissions.isEmpty())
        assertTrue(c.state.value.errorScrollToken > 0)
    }

    @Test fun blurShowsFormatButNotRequiredUntilAttempted() = runTest {
        val c = loaded(MockBackend("""[{"id":"email","type":"email","label":"Email","required":true}]"""), backgroundScope)
        c.validate(BdFieldPath("email"))
        assertNull(c.error("email"), "an untouched required field stays quiet on blur")
        c.setValue(str("bad"), "email")
        c.validate(BdFieldPath("email"))
        assertEquals("Enter a valid email address.", c.error("email"))
        c.setValue(str("good@example.com"), "email")
        assertNull(c.error("email"), "fixing the value clears the error as they type")
    }

    @Test fun businessEmailRule() = runTest {
        val c = loaded(
            MockBackend("""[{"id":"email","type":"email","label":"Work email","emailConfig":{"businessOnly":true}}]"""),
            backgroundScope,
        )
        c.setValue(str("someone@gmail.com"), "email")
        c.validate(BdFieldPath("email"))
        assertEquals("Please use your work email address.", c.error("email"))
    }

    @Test fun steppedFormValidatesEachStepAndFollowsConditions() = runTest {
        val b = MockBackend(
            """[{"id":"kind","type":"radio","label":"Kind","required":true,"options":["Home","Business"]},
                {"id":"biz","type":"condition_block","label":"",
                 "conditionRule":{"fieldId":"kind","operator":"eq","value":"Business"},
                 "children":[{"id":"company","type":"text","label":"Company","required":true}]},
                {"id":"notes","type":"textarea","label":"Notes"}]""",
            """{"isConsecutive":true}""",
        )
        val c = loaded(b, backgroundScope)
        assertEquals(2, c.stepCount, "the business page is hidden until chosen")
        assertFalse(c.next())
        assertEquals("Kind is required.", c.error("kind"))
        c.setValue(str("Business"), "kind")
        assertEquals(3, c.stepCount)
        assertTrue(c.next())
        assertEquals(1, c.currentStep)
        assertFalse(c.next())
        assertEquals("Company is required.", c.error("company"))
        c.back()
        assertTrue(c.errors.isEmpty())
        c.setValue(str("Home"), "kind")
        assertEquals(2, c.stepCount)
        assertTrue(c.submit().isSuccess, "a hidden required field doesn't block")
    }

    @Test fun repeaterErrorsLandOnTheEntryField() = runTest {
        val b = MockBackend(
            """[{"id":"kids","type":"multi_populator","label":"Children","populatorConfig":{"maxInstances":3},
                 "children":[{"id":"kname","type":"text","label":"Name","required":true},
                             {"id":"kage","type":"number","label":"Age","validation":{"min":0,"max":17}}]}]""",
        )
        val c = loaded(b, backgroundScope)
        val kids = BdFieldPath("kids")
        c.setValue(str("Sam"), BdFieldPath("kname", kids.entry(0)))
        c.addEntry(kids)
        c.setValue(BdJson.of(30), BdFieldPath("kage", kids.entry(1)))
        c.submit()
        assertEquals("Name is required.", c.error(BdFieldPath("kname", kids.entry(1))))
        assertEquals("Enter 17 or less.", c.error(BdFieldPath("kage", kids.entry(1))))
        assertNotNull(c.errors["kids[1].kage"])
        c.removeEntry(1, kids)
        assertEquals(1, c.entries(kids).size)
        assertTrue(c.submit().isSuccess)
        assertEquals(json("""[{"kname":"Sam"}]"""), b.lastData["kids"])
    }

    @Test fun calculationsRecomputeOnEdit() = runTest {
        val b = MockBackend(
            """[{"id":"qty","type":"number","label":"Qty"},{"id":"price","type":"currency","label":"Price"},
                {"id":"total","type":"calculation","label":"Total",
                 "calculationConfig":{"formula":"q * p","inputMap":[{"variable":"q","fieldId":"qty"},{"variable":"p","fieldId":"price"}]}}]""",
        )
        val c = loaded(b, backgroundScope)
        c.setValue(BdJson.of(3), "qty")
        c.setValue(BdJson.of(2.5), "price")
        assertEquals(BdJson.of(7.5), c.value("total"))
        c.setValue(null, "qty")
        assertEquals(BdJson.Null, c.value("total"), "a missing input leaves the result empty")
    }

    @Test fun filesUploadOnSubmitAndSwapPlaceholders() = runTest {
        val b = MockBackend(
            """[{"id":"docs","type":"file_upload","label":"Docs","fileConfig":{"maxFiles":2,"allowedTypes":["application/pdf"]}},
                {"id":"pic","type":"image_input","label":"Photo"}]""",
        )
        val c = loaded(b, backgroundScope)
        val pdf = BdPickedFile(ByteArray(10) { 1 }, "a.pdf", "application/pdf")
        val png = BdPickedFile(ByteArray(10) { 2 }, "b.png", "image/png")
        c.addFiles(listOf(pdf, png), BdFieldPath("docs"))
        assertEquals(1, c.value("docs")?.arrayValue?.size, "the png isn't an allowed type")
        assertEquals("File type not allowed: image/png", c.error("docs"))
        c.setImage(BdPickedFile(byteArrayOf(-1), "me.heic", "image/heic"), BdFieldPath("pic"))
        assertTrue(BdFormRules.isPendingUpload(c.value("pic")))
        assertTrue(c.submit().isSuccess)
        assertEquals(listOf("a.pdf", "me.heic"), b.uploads.sorted())
        assertEquals(str("https://cdn.example.com/a.pdf"), b.lastData["docs"]?.arrayValue?.first()?.get("url"))
        assertEquals(str("https://cdn.example.com/me.heic"), b.lastData["pic"])
    }

    @Test fun failedUploadKeepsTheFormOpen() = runTest {
        val b = MockBackend("""[{"id":"docs","type":"file_upload","label":"Docs"}]""")
        b.failUploads = true
        val c = loaded(b, backgroundScope)
        c.addFiles(listOf(BdPickedFile(byteArrayOf(1), "x.txt", "text/plain")), BdFieldPath("docs"))
        val f = assertIs<BdSubmitFailure>(c.submit())
        assertEquals(BdSubmitFailure.Reason.NetworkError, f.reason)
        assertEquals("Upload failed.", c.error("docs"))
        assertTrue(b.submissions.isEmpty())
        assertTrue(BdFormRules.isPendingUpload(c.value("docs")?.arrayValue?.firstOrNull()), "the file is still there to retry")
        assertFalse(c.state.value.isSubmitting)
        assertEquals(0, c.state.value.uploadingCount)
    }

    @Test fun serverIssuesMapBackToFields() = runTest {
        val b = MockBackend("""[{"id":"f1","type":"text","label":"Code","key":"promo"}]""")
        b.submitAnswer = 422 to json("""{"error":"validation_failed","message":"Bad","issues":[{"id":"promo","label":"Code","reason":"regex"}]}""").objectValue!!
        val c = loaded(b, backgroundScope)
        c.setValue(str("x"), "f1")
        val f = assertIs<BdSubmitFailure>(c.submit())
        assertEquals(BdSubmitFailure.Reason.ValidationFailed, f.reason)
        assertEquals("Code isn't in the expected format.", c.error("f1"))
    }

    @Test fun statusCodesMapLikeTheJsSdk() {
        fun reason(status: Int, body: String = "{}") = BdPackageFormsBackend.failure(status, json(body).objectValue!!).reason
        assertEquals(BdSubmitFailure.Reason.Unauthorized, reason(401))
        assertEquals(BdSubmitFailure.Reason.Forbidden, reason(403))
        assertEquals(BdSubmitFailure.Reason.PlanRequired, reason(402))
        assertEquals(BdSubmitFailure.Reason.PaymentRequired, reason(402, """{"reason":"payment_required"}"""))
        assertEquals(BdSubmitFailure.Reason.ServiceSuspended, reason(402, """{"reason":"service_suspended"}"""))
        assertEquals(BdSubmitFailure.Reason.RateLimited, reason(429))
        assertEquals(BdSubmitFailure.Reason.NotFound, reason(404))
        assertEquals(BdSubmitFailure.Reason.InvalidRequest, reason(400))
        assertEquals(BdSubmitFailure.Reason.ValidationFailed, reason(400, """{"error":"validation_failed"}"""))
        assertEquals(BdSubmitFailure.Reason.ServerError, reason(500))
    }

    @Test fun collectionMatchConditions() = runTest {
        val b = MockBackend(
            """[{"id":"plan","type":"collection_select","label":"Plan"},
                {"id":"vip","type":"condition_block","label":"",
                 "conditionRule":{"fieldId":"plan","operator":"eq","value":"premium","matchField":"tier"},
                 "children":[{"id":"concierge","type":"text","label":"Concierge","required":true}]}]""",
        )
        val c = loaded(b, backgroundScope)
        c.loadCollectionOptions("plan")
        c.setValue(str("r2"), "plan")
        assertFalse(c.isVisible(c.field("vip")!!))
        c.setValue(str("r1"), "plan")
        assertTrue(c.isVisible(c.field("vip")!!))
        assertFalse(c.submit().isSuccess)
        assertNotNull(c.error("concierge"))
    }

    @Test fun paymentHandlerStoresTheIntent() = runTest {
        val c = loaded(MockBackend("""[{"id":"card","type":"credit_card","label":"Card","required":true}]"""), backgroundScope)
        c.collectPayment(BdFieldPath("card"))
        assertEquals("Card entry isn't set up in this app.", c.error("card"))
        c.paymentHandler = { intent, _ -> intent.intentId }
        c.collectPayment(BdFieldPath("card"))
        assertEquals(str("seti_1"), c.value("card"))
        assertNull(c.error("card"))
    }

    @Test fun dateRangeOrder() = runTest {
        val c = loaded(MockBackend("""[{"id":"trip","type":"date_range","label":"Trip"}]"""), backgroundScope)
        c.setValue(json("""{"start":"2026-12-10","end":"2026-12-01"}"""), "trip")
        c.validate(BdFieldPath("trip"))
        assertEquals("The end must come after the start.", c.error("trip"))
    }

    @Test fun customMessages() = runTest {
        val c = loaded(MockBackend("""[{"id":"n","type":"text","label":"Nom","required":true}]"""), backgroundScope)
        c.messages = { reason, label, _ -> if (reason == "required") "$label est obligatoire." else reason }
        c.submit()
        assertEquals("Nom est obligatoire.", c.error("n"))
    }

    @Test fun resetRestoresSeedAndDirtyTracks() = runTest {
        val c = loaded(MockBackend("""[{"id":"n","type":"text","label":"N","defaultValue":"hi"}]"""), backgroundScope)
        assertFalse(c.isDirty)
        c.setValue(str("changed"), "n")
        assertTrue(c.isDirty)
        c.reset()
        assertEquals(str("hi"), c.value("n"))
        assertFalse(c.isDirty)
    }

    @Test fun scheduleSlotsLoad() = runTest {
        val c = loaded(MockBackend("""[{"id":"when","type":"schedule","label":"When","scheduleConfig":{"mode":"auto"}}]"""), backgroundScope)
        c.loadScheduleSlots("when")
        assertEquals(3, c.state.value.scheduleSlots["when"]?.valueOrNull?.size)
    }

    @Test fun loadFailureIsAPhaseNotAThrow() = runTest {
        val failing = object : BdFormsBackend by MockBackend("[]") {
            override suspend fun schema(form: String): BdFormSchema = throw BdFormsException(404, "Form not found.")
        }
        val c = BdFormController("missing", failing, scope = backgroundScope)
        c.load()
        assertEquals(BdFormState.Phase.Failed("Form not found."), c.phase)
    }
}
