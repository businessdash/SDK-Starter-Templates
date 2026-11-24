package app.bd.forms

import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.fail
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.builtins.ListSerializer

/**
 * Replays `quiz-parity.json`: quizzes run through the TypeScript forms-core by
 * `sdk/scripts/quiz-parity.ts`, with every screen and state TS produced. The
 * native quiz must show a taker exactly what the web quiz shows.
 *
 * Each test collects every disagreement before failing.
 */
class QuizParityTest {
    companion object {
        val fixtures: Map<String, BdJson> by lazy {
            val text = QuizParityTest::class.java.getResource("/quiz-parity.json")!!.readText()
            BdJson.from(formsJson.parseToJsonElement(text)).objectValue!!
        }

        fun cases(key: String): List<Map<String, BdJson>> =
            fixtures.getValue(key).arrayValue!!.map { it.objectValue!! }.also { require(it.isNotEmpty()) { "no $key cases" } }

        fun <T> decode(strategy: DeserializationStrategy<T>, json: BdJson): T =
            quizJson.decodeFromJsonElement(strategy, json.toJsonElement())

        fun <T> json(strategy: SerializationStrategy<T>, value: T): BdJson =
            BdJson.from(quizJson.encodeToJsonElement(strategy, value))

        private fun BdJson?.nullish() = this == null || this.isNull

        /**
         * JSON equality where a missing key equals `null` (TypeScript writes
         * `null` where Kotlin leaves a null out), with float tolerance. The
         * path of the first difference, or null.
         */
        fun diff(a: BdJson?, b: BdJson?, path: String = "$"): String? = when {
            a.nullish() && b.nullish() -> null
            a is BdJson.Num && b is BdJson.Num ->
                if (a.value == b.value || abs(a.value - b.value) <= 1e-9 * max(abs(a.value), abs(b.value))) null
                else "$path: ${a.value} ≠ ${b.value}"
            a is BdJson.Arr && b is BdJson.Arr ->
                if (a.items.size != b.items.size) "$path: ${a.items.size} items ≠ ${b.items.size}"
                else a.items.indices.firstNotNullOfOrNull { diff(a.items[it], b.items[it], "$path[$it]") }
            a is BdJson.Obj && b is BdJson.Obj ->
                (a.fields.keys + b.fields.keys).sorted().firstNotNullOfOrNull { diff(a.fields[it], b.fields[it], "$path.$it") }
            else -> if (a == b) null else "$path: ${a?.toJsonString()} ≠ ${b?.toJsonString()}"
        }

        fun obj(vararg pairs: Pair<String, BdJson>): BdJson = BdJson.Obj(linkedMapOf(*pairs))
    }

    private val misses = mutableListOf<String>()

    private fun miss(message: String) {
        misses += message
    }

    private fun report() {
        if (misses.isNotEmpty()) fail("${misses.size} disagreement(s) with TypeScript:\n" + misses.joinToString("\n"))
    }

    /** The comparison forgives only missing-vs-null, never a real difference. */
    @Test
    fun diffCatchesDifferences() {
        assertNotNull(diff(obj("a" to BdJson.Num(1.0)), obj("a" to BdJson.Num(2.0))))
        assertNotNull(diff(obj("a" to BdJson.Num(1.0)), obj()))
        assertNotNull(diff(obj("a" to BdJson.Str("x")), obj("a" to BdJson.Str("y"))))
        assertNotNull(diff(BdJson.Arr(listOf(BdJson.Num(1.0), BdJson.Num(2.0))), BdJson.Arr(listOf(BdJson.Num(1.0)))))
        assertNotNull(diff(obj("a" to obj("b" to BdJson.Bool(true))), obj("a" to obj("b" to BdJson.Bool(false)))))
        assertNull(diff(obj("a" to BdJson.Null), obj()))
    }

    @Test
    fun wordsMatch() {
        val expected = fixtures.getValue("words").objectValue!!.mapValues { it.value.stringValue }
        assertEquals(expected, BdQuizWords().toMap())
    }

    @Test
    fun seedHash() {
        for (c in cases("seedHash")) {
            val text = c.getValue("text").stringValue!!
            val want = c.getValue("hash").doubleValue!!.toLong()
            val got = BdQuizArrange.seedHash(text)
            if (got != want) miss("hash(\"$text\"): $got ≠ $want")
        }
        report()
    }

    @Test
    fun seededOrder() {
        for (c in cases("seededOrder")) {
            val count = c.getValue("count").doubleValue!!.toInt()
            val seed = c.getValue("seed").stringValue!!
            val want = c.getValue("order").arrayValue!!.map { it.doubleValue!!.toInt() }
            val got = BdQuizArrange.seededOrder(count, seed)
            if (got != want) miss("order($count, \"$seed\"): $got ≠ $want")
        }
        report()
    }

    @Test
    fun durations() {
        for (c in cases("durations")) {
            val seconds = c.getValue("seconds").doubleValue!!
            val want = c.getValue("label").stringValue!!
            val got = BdQuizEngine.durationLabel(seconds)
            if (got != want) miss("duration($seconds): $got ≠ $want")
        }
        report()
    }

    @Test
    fun answerText() {
        for (c in cases("answerText")) {
            val value = c["value"]
            val want = c.getValue("text").stringValue!!
            val got = BdQuizEngine.answerText(value)
            if (got != want) miss("answerText(${value?.toJsonString()}): \"$got\" ≠ \"$want\"")
        }
        report()
    }

    @Test
    fun scoring() {
        for (c in cases("scoring")) {
            val fields = c.getValue("fields").arrayValue!!.map { BdFormField.make(it) }
            val answers = c["answers"]?.objectValue ?: emptyMap()
            val score = BdQuizScoring.score(fields, answers, c.getValue("passingScore").doubleValue!!)
            diff(json(BdQuizScore.serializer(), score), c["score"])?.let { miss("scoring “${c["name"]?.stringValue}”: $it") }
        }
        report()
    }

    private class PageInvitation(j: BdJson) : BdQuizInvitationPageInfo {
        override val name = j["name"]?.stringValue ?: ""
        override val description = j["description"]?.stringValue ?: ""
        override val estimatedMinutes = j["estimatedMinutes"]?.doubleValue
        override val timeLimitMinutes = j["timeLimitMinutes"]?.doubleValue
        override val recipientName = j["recipientName"]?.stringValue
        override val requireAuthentication = j["requireAuthentication"]?.boolValue == true
        override val authenticationStatus = j["authenticationStatus"]?.stringValue ?: "not_required"
        override val recipientEmailHint = j["recipientEmailHint"]?.stringValue ?: ""
        override val status = j["status"]?.stringValue ?: "pending"
        override val expired = j["expired"]?.boolValue == true
        override val active = j["active"]?.boolValue != false
    }

    private class PagePractice(j: BdJson) : BdQuizPageInfo {
        override val name = j["name"]?.stringValue ?: ""
        override val description = j["description"]?.stringValue ?: ""
        override val estimatedMinutes = j["estimatedMinutes"]?.doubleValue
        override val timeLimitMinutes = j["timeLimitMinutes"]?.doubleValue
    }

    @Test
    fun pages() {
        for (c in cases("pages")) {
            val practice = c["practice"]
            val page = if (practice != null) {
                BdQuizPage.practice(PagePractice(practice))
            } else {
                val links = c["links"]
                BdQuizPage.invitation(
                    c["invitation"]?.takeIf { !it.isNull }?.let(::PageInvitation),
                    signInHref = links?.get("signInHref")?.stringValue,
                    switchAccountHref = links?.get("switchAccountHref")?.stringValue,
                )
            }
            diff(json(BdQuizPage.serializer(), page), c["page"])?.let { miss("page “${c["name"]?.stringValue}”: $it") }
        }
        report()
    }

    @Test
    fun runs() {
        for (run in cases("runs")) {
            val name = run.getValue("name").stringValue!!
            val config = BdQuizConfig(BdQuizOptions.fromJson(run.getValue("options")), run.getValue("seed").stringValue!!)
            val initial = run["initial"]?.let { decode(BdQuizInitial.serializer(), it) } ?: BdQuizInitial()
            val start = run.getValue("start").doubleValue!!
            var state = BdQuizEngine.initialState(config, initial, start)
            val views = run.getValue("views").arrayValue!!
            val states = run.getValue("states").arrayValue!!

            fun check(i: Int, at: Double): Boolean {
                diff(json(BdQuizScreen.serializer(), BdQuizEngine.screen(config, state, at)), views[i])?.let {
                    miss("run “$name”, view $i: $it")
                    return false
                }
                diff(json(BdQuizState.serializer(), state), states[i])?.let {
                    miss("run “$name”, state $i: $it")
                    return false
                }
                return true
            }
            if (!check(0, start)) continue

            for ((i, e) in run.getValue("events").arrayValue!!.withIndex()) {
                val at = e["at"]!!.doubleValue!!
                fun completion(answers: Map<String, BdJson>): BdQuizCompletion =
                    e["completion"]?.let { decode(BdQuizCompletion.serializer(), it) }
                        ?: BdQuizEngine.localCompletion(config, state, answers, at)
                when (val kind = e["do"]!!.stringValue!!) {
                    "answer" -> state = BdQuizEngine.setAnswer(config, state, e["fieldId"]!!.stringValue!!, e["value"] ?: BdJson.Null)
                    "dontKnow" -> state = BdQuizEngine.chooseDontKnow(config, state, e["fieldId"]!!.stringValue!!)
                    "back" -> state = BdQuizEngine.back(config, state)
                    "start" -> {
                        val info = e["info"]?.let { decode(BdQuizStartInfo.serializer(), it) } ?: BdQuizEngine.localStart(config, at)
                        state = BdQuizEngine.started(state, info, at)
                    }
                    "fail" -> state = BdQuizEngine.failed(state, e["message"]!!.stringValue!!)
                    "view" -> Unit
                    "advance" -> {
                        val step = BdQuizEngine.advance(config, state, at)
                        state = step.state
                        when (step) {
                            is BdQuizStep.Lock -> {
                                val result = e["result"]?.let { decode(BdQuizQuestionResult.serializer(), it) }
                                    ?: BdQuizEngine.localResult(config, step.fieldId, step.answer)
                                state = if (result != null) BdQuizEngine.locked(config, state, step.fieldId, step.answer, result, at)
                                else BdQuizEngine.failed(state, config.words.unscorable)
                            }
                            is BdQuizStep.Submit -> state = BdQuizEngine.completed(state, completion(step.answers))
                            is BdQuizStep.None -> Unit
                        }
                    }
                    "tick" -> if (BdQuizEngine.deadlinePassed(config, state, at)) {
                        val answers = state.answers
                        state = BdQuizEngine.timeUp(state)
                        state = BdQuizEngine.completed(state, completion(answers))
                    }
                    else -> miss("run “$name”: unknown event $kind")
                }
                if (!check(i + 1, at)) break
            }
        }
        report()
    }

    /** Results round-trip through the wire types unchanged (a resumed quiz reads them back). */
    @Test
    fun resultsRoundTrip() {
        for (c in cases("scoring")) {
            val results = c.getValue("score")["results"] ?: continue
            val decoded = decode(ListSerializer(BdQuizQuestionResult.serializer()), results)
            diff(json(ListSerializer(BdQuizQuestionResult.serializer()), decoded), results)
                ?.let { miss("round trip “${c["name"]?.stringValue}”: $it") }
        }
        report()
    }
}
