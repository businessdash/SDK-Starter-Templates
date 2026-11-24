package app.bd.forms

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.appendPathSegments
import io.ktor.http.content.TextContent
import io.ktor.http.isSuccess
import io.ktor.http.takeFrom
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.serialization.DeserializationStrategy

// BD's side of a quiz, an invited quiz or a practice run, for
// [BdQuizController]. [BdQuizzes] reads them from BD's Package API with the
// app's publishable key (or through the app's own server); an app can supply
// any [BdQuizBackend] instead (a test double, a quiz bundled offline).

/** What the controller asks of BD. Leave a step null where the quiz has none. */
public class BdQuizBackend(
    public val start: (suspend () -> BdQuizStartInfo)? = null,
    public val saveDraft: (suspend (answers: Map<String, BdJson>) -> Unit)? = null,
    public val lockAnswer: (suspend (fieldId: String, answer: BdJson) -> BdQuizQuestionResult)? = null,
    /** Finish. `questionFieldIds` are the questions this run asked: all, or a local run's subset. */
    public val submit: suspend (answers: Map<String, BdJson>, questionFieldIds: List<String>) -> BdQuizCompletion,
)

// ── Wire types ──────────────────────────────────────────────────────────────

/** How a quiz is taken: the builder's quiz switches (`settings.quiz`). */
public data class BdQuizTakingSettings(
    public val shuffleChoices: Boolean = false,
    public val shuffleQuestions: Boolean = false,
    public val allowDontKnow: Boolean = false,
) {
    internal companion object {
        fun from(settings: BdJson?): BdQuizTakingSettings {
            val quiz = settings?.get("quiz")
            return BdQuizTakingSettings(
                shuffleChoices = quiz?.get("shuffleChoices")?.boolValue == true,
                shuffleQuestions = quiz?.get("shuffleQuestions")?.boolValue == true,
                allowDontKnow = quiz?.get("allowDontKnow")?.boolValue == true,
            )
        }
    }
}

private fun BdJson.str(key: String): String = this[key]?.stringValue ?: ""
private fun BdJson.strOrNull(key: String): String? = this[key]?.stringValue
private fun BdJson.num(key: String): Double? = this[key]?.doubleValue
private fun BdJson.flag(key: String): Boolean = this[key]?.boolValue == true
private fun BdJson.fieldList(): List<BdFormField> = this["fields"]?.arrayValue?.map { BdFormField.make(it) } ?: emptyList()
private fun BdJson.ids(): List<String> = this["questionFieldIds"]?.arrayValue?.mapNotNull { it.stringValue } ?: emptyList()

/** An invited quiz, as its taker's page shows it. */
public class BdQuizInvitation(public val raw: BdJson) : BdQuizInvitationPageInfo {
    public val id: String = raw.str("id")
    public val quizId: String = raw.str("quizId")
    override val name: String = raw.str("name")
    override val description: String = raw.str("description")
    public val competency: String? = raw.strOrNull("competency")
    override val estimatedMinutes: Double? = raw.num("estimatedMinutes")
    public val passingScore: Double = raw.num("passingScore") ?: BdQuizScoring.DEFAULT_PASSING_GRADE
    public val feedbackMode: BdQuizFeedbackMode =
        if (raw.strOrNull("feedbackMode") == "immediate") BdQuizFeedbackMode.IMMEDIATE else BdQuizFeedbackMode.END
    public val showScore: Boolean = raw["showScore"]?.boolValue != false
    public val resultsRequireAccount: Boolean = raw.flag("resultsRequireAccount")
    public val resultsUnlocked: Boolean = raw.flag("resultsUnlocked")
    override val requireAuthentication: Boolean = raw.flag("requireAuthentication")

    /** `required`/`mismatch`: show the sign-in prompt instead of the quiz. */
    override val authenticationStatus: String = raw.strOrNull("authenticationStatus") ?: "not_required"
    override val recipientEmailHint: String = raw.str("recipientEmailHint")
    public val showTimer: Boolean = raw.flag("showTimer")
    override val timeLimitMinutes: Double? = raw.num("timeLimitMinutes")
    public val startedAt: String? = raw.strOrNull("startedAt")
    public val deadlineAt: String? = raw.strOrNull("deadlineAt")
    public val serverNow: Double = raw.num("serverNow") ?: System.currentTimeMillis().toDouble()
    public val timedOut: Boolean = raw.flag("timedOut")
    public val questionFieldIds: List<String> = raw.ids()
    public val fields: List<BdFormField> = raw.fieldList()
    public val settings: BdQuizTakingSettings = BdQuizTakingSettings.from(raw["settings"])
    override val recipientName: String? = raw.strOrNull("recipientName")
    public val recipientEmail: String? = raw.strOrNull("recipientEmail")
    override val status: String = raw.strOrNull("status") ?: "pending"
    override val expired: Boolean = raw.flag("expired")
    override val active: Boolean = raw["active"]?.boolValue != false
    public val lockedAnswers: Map<String, BdJson> = raw["lockedAnswers"]?.objectValue ?: emptyMap()
    public val lockedResults: List<BdQuizQuestionResult> = raw["lockedResults"]?.arrayValue
        ?.map { quizJson.decodeFromJsonElement(BdQuizQuestionResult.serializer(), it.toJsonElement()) } ?: emptyList()
    public val attempt: BdQuizCompletion? = raw["attempt"]?.takeIf { !it.isNull }
        ?.let { quizJson.decodeFromJsonElement(BdQuizCompletion.serializer(), it.toJsonElement()) }

    /** Engine options for this invitation. The seed is the invitation, so a reload never reorders. */
    public fun options(signInHref: String? = null, words: BdQuizWords = BdQuizWords()): BdQuizOptions = BdQuizOptions(
        fields = fields,
        questionFieldIds = questionFieldIds,
        feedbackMode = feedbackMode,
        passingScore = passingScore,
        showTimer = showTimer,
        timeLimitMinutes = timeLimitMinutes,
        showScore = showScore,
        resultsLocked = resultsRequireAccount && !resultsUnlocked,
        signInHref = signInHref,
        shuffleChoices = settings.shuffleChoices,
        shuffleQuestions = settings.shuffleQuestions,
        seed = id,
        allowDontKnow = settings.allowDontKnow,
        local = false,
        canRestart = false,
        words = words,
    )

    /** Where it was left: locked answers, the clock, a finished attempt. */
    public fun initial(): BdQuizInitial = BdQuizInitial(
        answers = lockedAnswers,
        results = lockedResults,
        completion = attempt,
        startedAt = startedAt?.let { BdJson.Str(it) },
        deadlineAt = deadlineAt?.let { BdJson.Str(it) },
        serverNow = serverNow,
    )
}

/** A quiz the org lets its apps and sites run as practice. */
public class BdPracticeQuiz(public val raw: BdJson) : BdQuizPageInfo {
    public val quizId: String = raw.str("quizId")
    public val slug: String = raw.str("slug")
    override val name: String = raw.str("name")
    override val description: String = raw.str("description")
    public val competency: String? = raw.strOrNull("competency")
    override val estimatedMinutes: Double? = raw.num("estimatedMinutes")
    public val passingScore: Double = raw.num("passingScore") ?: BdQuizScoring.DEFAULT_PASSING_GRADE
    public val feedbackMode: BdQuizFeedbackMode =
        if (raw.strOrNull("feedbackMode") == "immediate") BdQuizFeedbackMode.IMMEDIATE else BdQuizFeedbackMode.END
    public val showTimer: Boolean = raw.flag("showTimer")
    override val timeLimitMinutes: Double? = raw.num("timeLimitMinutes")
    public val questionFieldIds: List<String> = raw.ids()
    public val fields: List<BdFormField> = raw.fieldList()
    public val settings: BdQuizTakingSettings = BdQuizTakingSettings.from(raw["settings"])

    /**
     * Engine options: graded by BD (the app never sees answer keys) but run
     * like a local quiz: the clock pauses on a verdict, it can be retaken, and
     * a limit asks a subset. A new order each run unless `seed` pins one.
     */
    public fun options(seed: String? = null, questionLimit: Int? = null, words: BdQuizWords = BdQuizWords()): BdQuizOptions =
        BdQuizOptions(
            fields = fields,
            questionFieldIds = questionFieldIds,
            feedbackMode = feedbackMode,
            passingScore = passingScore,
            showTimer = showTimer,
            timeLimitMinutes = timeLimitMinutes,
            shuffleChoices = settings.shuffleChoices,
            shuffleQuestions = settings.shuffleQuestions,
            seed = seed,
            questionLimit = questionLimit,
            allowDontKnow = settings.allowDontKnow,
            local = true,
            canRestart = true,
            words = words,
        )
}

// ── Client ──────────────────────────────────────────────────────────────────

/**
 * BD's quiz routes, with the app's publishable key and, for invitations that
 * need the invited account, the signed-in customer's session (from
 * `bd-sign-in`):
 *
 * ```kotlin
 * val quizzes = BdQuizzes.packageApi("pk_live_…", sessionToken = session?.sessionToken)
 * ```
 *
 * Or [BdQuizzes.endpoint] for the app's own server running the JS SDK's
 * `createQuizHandler`, which serves the same routes.
 */
public class BdQuizzes private constructor(
    public val baseUrl: String,
    private val headers: Map<String, String>,
    private val http: HttpClient,
) {

    public companion object {
        internal const val SESSION_HEADER: String = "X-BD-Session-Token"

        /** BD directly. `host` is e.g. `https://businessdash.us`. */
        public fun packageApi(
            publishableKey: String,
            host: String = "https://businessdash.us",
            sessionToken: String? = null,
            engine: HttpClientEngine? = null,
        ): BdQuizzes {
            // Allow, don't deny: secret keys start with bd_, so only "is it a
            // pk_ token" catches every one. Empty means the app has no key yet.
            val key = publishableKey.trim()
            require(key.isEmpty() || key.startsWith("pk_")) { "BdForms: an app takes a publishable pk_ key only, never a secret key." }
            val headers = buildMap {
                put("Authorization", "Bearer $publishableKey")
                sessionToken?.takeIf { it.isNotEmpty() }?.let { put(SESSION_HEADER, it) }
            }
            return BdQuizzes(host.trimEnd('/') + "/api/package/v1/quizzes", headers, client(engine))
        }

        /** The app's own quiz routes, e.g. `https://example.com/api/bd-auth/quizzes`. */
        public fun endpoint(url: String, headers: Map<String, String> = emptyMap(), engine: HttpClientEngine? = null): BdQuizzes =
            BdQuizzes(url.trimEnd('/'), headers, client(engine))

        private fun client(engine: HttpClientEngine?) = HttpClient(engine ?: OkHttp.create()) { expectSuccess = false }
    }

    /** The signed-in customer's session, if one was given. */
    public val sessionToken: String? get() = headers[SESSION_HEADER]

    /** The same client for another signed-in customer (or none). */
    public fun withSession(token: String?): BdQuizzes {
        val next = headers - SESSION_HEADER
        return BdQuizzes(baseUrl, if (token.isNullOrEmpty()) next else next + (SESSION_HEADER to token), http)
    }

    override fun equals(other: Any?): Boolean = other is BdQuizzes && other.baseUrl == baseUrl && other.headers == headers
    override fun hashCode(): Int = baseUrl.hashCode() * 31 + headers.hashCode()

    private suspend fun call(method: HttpMethod, path: List<String>, body: BdJson? = null): BdJson = try {
        val response = http.request {
            this.method = method
            url {
                takeFrom(baseUrl)
                appendPathSegments(path, encodeSlash = true)
            }
            header("Accept", "application/json")
            header("X-BD-Client", "kotlin-quiz/1")
            this@BdQuizzes.headers.forEach { (name, value) -> header(name, value) }
            if (body != null) setBody(TextContent(body.toJsonString(), ContentType.Application.Json))
        }
        val text = response.bodyAsText()
        val json = runCatching { BdJson.from(formsJson.parseToJsonElement(text)) }.getOrNull()
        if (!response.status.isSuccess()) {
            val status = response.status.value
            throw BdFormsException(status, json?.get("message")?.stringValue ?: "BD returned $status.")
        }
        json ?: throw BdFormsException(response.status.value, "BD sent an answer this app can't read.")
    } catch (e: CancellationException) {
        throw e
    } catch (e: BdFormsException) {
        throw e
    } catch (e: Exception) {
        throw BdFormsException(0, "Could not reach BD: ${e.message ?: e::class.simpleName}")
    }

    private fun <T> read(json: BdJson, strategy: DeserializationStrategy<T>): T =
        quizJson.decodeFromJsonElement(strategy, json.toJsonElement())

    public suspend fun invitation(token: String): BdQuizInvitation =
        BdQuizInvitation(call(HttpMethod.Get, listOf("invitations", token)))

    public suspend fun startInvitation(token: String): BdQuizStartInfo =
        read(call(HttpMethod.Post, listOf("invitations", token, "start")), BdQuizStartInfo.serializer())

    public suspend fun saveInvitationDraft(token: String, answers: Map<String, BdJson>) {
        call(HttpMethod.Post, listOf("invitations", token, "draft"), BdJson.Obj(mapOf("answers" to BdJson.Obj(answers))))
    }

    /** Lock one answer for good and get its verdict (immediate feedback). */
    public suspend fun lockInvitationAnswer(token: String, fieldId: String, answer: BdJson): BdQuizQuestionResult {
        val body = BdJson.Obj(linkedMapOf("fieldId" to BdJson.Str(fieldId), "answer" to answer))
        val response = call(HttpMethod.Post, listOf("invitations", token, "lock"), body)
        return read(response["result"] ?: BdJson.Null, BdQuizQuestionResult.serializer())
    }

    /** Immediate-feedback quizzes submit what was locked: pass null. */
    public suspend fun submitInvitation(token: String, answers: Map<String, BdJson>?): BdQuizCompletion {
        val body = BdJson.Obj(if (answers == null) emptyMap() else mapOf("answers" to BdJson.Obj(answers)))
        return read(call(HttpMethod.Post, listOf("invitations", token, "submit"), body), BdQuizCompletion.serializer())
    }

    public suspend fun practice(slug: String): BdPracticeQuiz = BdPracticeQuiz(call(HttpMethod.Get, listOf(slug)))

    public suspend fun checkPracticeAnswer(slug: String, fieldId: String, answer: BdJson): BdQuizQuestionResult {
        val body = BdJson.Obj(linkedMapOf("fieldId" to BdJson.Str(fieldId), "answer" to answer))
        return read(call(HttpMethod.Post, listOf(slug, "check"), body), BdQuizQuestionResult.serializer())
    }

    public suspend fun scorePractice(slug: String, answers: Map<String, BdJson>, questionFieldIds: List<String>? = null): BdQuizCompletion {
        val body = linkedMapOf<String, BdJson>("answers" to BdJson.Obj(answers))
        if (questionFieldIds != null) body["questionFieldIds"] = BdJson.Arr(questionFieldIds.map { BdJson.Str(it) })
        return read(call(HttpMethod.Post, listOf(slug, "score"), BdJson.Obj(body)), BdQuizCompletion.serializer())
    }

    /** BD's side of an invited quiz. */
    public fun invitationBackend(token: String): BdQuizBackend = BdQuizBackend(
        start = { startInvitation(token) },
        saveDraft = { saveInvitationDraft(token, it) },
        lockAnswer = { fieldId, answer -> lockInvitationAnswer(token, fieldId, answer) },
        submit = { answers, _ -> submitInvitation(token, answers) },
    )

    /** BD's side of a practice run: graded there, never recorded. */
    public fun practiceBackend(slug: String): BdQuizBackend = BdQuizBackend(
        lockAnswer = { fieldId, answer -> checkPracticeAnswer(slug, fieldId, answer) },
        submit = { answers, ids -> scorePractice(slug, answers, ids) },
    )
}
