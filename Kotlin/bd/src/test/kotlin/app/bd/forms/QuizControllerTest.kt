package app.bd.forms

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest

/** A clock the test moves by hand. */
private class TestClock(var ms: Double = 1_767_225_600_000.0) {
    fun now(): Double = ms
    fun advance(seconds: Double) {
        ms += seconds * 1000
    }
}

private fun field(json: String): BdFormField = BdFormField.make(BdJson.from(formsJson.parseToJsonElement(json)))

private val capital = field(
    """{"id":"q_capital","type":"radio","label":"Capital of France?","required":true,
        "options":["Paris","Lyon","Nice"],"quizOptionIds":["o_paris","o_lyon","o_nice"],
        "quizAnswerKey":{"answer":{"option_id":"o_paris"},"rationale":{"why_right":"Since 987."}}}""",
)
private val ocean = field(
    """{"id":"q_ocean","type":"text","label":"Largest ocean?",
        "quizAnswerKey":{"answer":{"text":"Pacific"},"additional_accepted_answers":[{"text":"The Pacific Ocean"}]}}""",
)
private val essay = field(
    """{"id":"q_essay","type":"textarea","label":"Explain photosynthesis.",
        "quizAnswerKey":{"answer":{"text":"Plants turn light into energy.","validate_with_ai":true}}}""",
)

private fun str(s: String) = BdJson.Str(s)

private fun result(fieldId: String, status: BdQuizQuestionStatus) = BdQuizQuestionResult(
    fieldId = fieldId, label = "Q", status = status, pointsPossible = 1.0,
    pointsEarned = if (status == BdQuizQuestionStatus.CORRECT) 1.0 else 0.0, correctAnswers = listOf("Paris"),
)

private fun completion() = BdQuizCompletion(
    status = "scored", results = emptyList(), pointsEarned = 1.0, pointsPossible = 2.0,
    scorePercent = 50.0, provisionalScorePercent = 50.0, passed = false,
)

class QuizControllerTest {
    @Test fun localImmediateRunLocksChecksAndFinishes() = runTest {
        val clock = TestClock()
        val quiz = BdQuizController(
            BdQuizOptions(listOf(capital, ocean), feedbackMode = BdQuizFeedbackMode.IMMEDIATE),
            scope = backgroundScope, clock = clock::now,
        )
        val done = mutableListOf<BdQuizCompletion>()
        quiz.onDone = { done += it }

        // Required: checking an empty answer shows the error.
        quiz.advance()
        assertEquals("Capital of France? is required.", quiz.screen.value.questions.first().error)

        quiz.choose("q_capital", "Paris")
        quiz.advance()
        assertEquals(BdQuizPhase.FEEDBACK, quiz.screen.value.phase)
        assertEquals("Correct", quiz.screen.value.feedback?.badge?.label)
        assertEquals(BdQuizChoiceState.CORRECT, quiz.screen.value.questions[0].choices?.first()?.state)
        // A locked answer can't change.
        quiz.choose("q_capital", "Lyon")
        assertEquals(str("Paris"), quiz.state.value.answers["q_capital"])

        quiz.advance()
        quiz.setAnswer("q_ocean", str("  the pacific   ocean "))
        quiz.advance()
        assertEquals("Correct", quiz.screen.value.feedback?.badge?.label)
        assertEquals(BdQuizActionId.FINISH, quiz.screen.value.actions.first().id)

        quiz.advance()
        assertEquals(BdQuizPhase.DONE, quiz.screen.value.phase)
        val r = assertIs<BdQuizDone.Results>(quiz.screen.value.done)
        assertEquals("100%", r.score)
        assertEquals("2 / 2 correct", r.tally)
        assertEquals(1, done.size)
        assertEquals(listOf(BdQuizActionId.RETAKE), quiz.screen.value.actions.map { it.id })
    }

    @Test fun countdownSubmitsOnItsOwnAndKeepsAnswers() = runTest {
        val clock = TestClock()
        val quiz = BdQuizController(
            BdQuizOptions(listOf(capital, ocean), timeLimitMinutes = 1.0),
            scope = backgroundScope, clock = clock::now,
        )
        assertEquals(BdQuizPhase.READY, quiz.screen.value.phase)
        assertTrue(quiz.screen.value.ready!!.body.startsWith("You have 1 minute."))
        quiz.start()
        assertEquals("1:00", quiz.screen.value.timer?.value)

        quiz.choose("q_capital", "Paris")
        clock.advance(30.0)
        quiz.tick()
        assertEquals("0:30", quiz.screen.value.timer?.value)
        assertEquals(true, quiz.screen.value.timer?.warning)

        // The quiz's own clock notices the deadline: no tick() from the test.
        clock.advance(31.0)
        advanceTimeBy(600)
        runCurrent()
        assertTrue(quiz.state.value.timeUp)
        val r = assertIs<BdQuizDone.Results>(quiz.screen.value.done)
        assertEquals("Time limit reached in 1:01", r.timing)
        assertEquals(BdQuizQuestionStatus.CORRECT, quiz.state.value.completion?.results?.first()?.status)
        assertEquals(BdQuizQuestionStatus.INCORRECT, quiz.state.value.completion?.results?.last()?.status)
    }

    @Test fun openAnswersMatchAlternativesOrWaitForAI() {
        val score = BdQuizScoring.score(
            listOf(ocean, essay),
            mapOf("q_ocean" to str("<b>Pacific</b>"), "q_essay" to str("Light makes sugar.")),
            80.0,
        )
        assertEquals(BdQuizQuestionStatus.CORRECT, score.results[0].status)
        assertEquals(BdQuizQuestionStatus.PENDING_AI, score.results[1].status)
        assertEquals("pending_ai_review", score.status)
        assertNull(score.scorePercent)
        assertEquals(50.0, score.provisionalScorePercent)
    }

    @Test fun invitedQuizUsesBDForEveryStep() = runTest {
        val log = mutableListOf<String>()
        var lastAnswers: Map<String, BdJson>? = null
        var lastIds: List<String>? = null
        val backend = BdQuizBackend(
            start = {
                log += "start"
                BdQuizStartInfo(str("2026-01-01T00:00:00.000Z"), null, 1_767_225_600_000.0)
            },
            saveDraft = { log += "draft" },
            lockAnswer = { id, _ -> log += "lock $id"; result(id, BdQuizQuestionStatus.CORRECT) },
            submit = { answers, ids ->
                log += "submit"
                lastAnswers = answers
                lastIds = ids
                completion()
            },
        )
        val quiz = BdQuizController(
            BdQuizOptions(listOf(capital, ocean), feedbackMode = BdQuizFeedbackMode.END, showTimer = true, local = false),
            scope = backgroundScope, backend = backend, draftDelayMs = 5,
        )
        quiz.start()
        quiz.choose("q_capital", "Lyon")
        advanceTimeBy(60)
        quiz.advance()
        quiz.setAnswer("q_ocean", str("Atlantic"))
        quiz.advance()

        assertEquals("start", log.first())
        assertTrue("draft" in log)
        assertEquals("submit", log.last())
        assertEquals(mapOf("q_capital" to str("Lyon"), "q_ocean" to str("Atlantic")), lastAnswers)
        assertEquals(listOf("q_capital", "q_ocean"), lastIds)
        // Not a local run: no retake.
        assertTrue(quiz.screen.value.actions.isEmpty())
    }

    @Test fun bdErrorsShowBDsWordsAndOthersTheQuizs() = runTest {
        val quiz = BdQuizController(
            BdQuizOptions(listOf(capital), feedbackMode = BdQuizFeedbackMode.IMMEDIATE, local = false),
            scope = backgroundScope,
            backend = BdQuizBackend(
                lockAnswer = { _, _ -> throw BdFormsException(409, "That answer is already locked.") },
                submit = { _, _ -> completion() },
            ),
        )
        quiz.choose("q_capital", "Paris")
        quiz.advance()
        assertEquals("That answer is already locked.", quiz.screen.value.error)
        assertNull(quiz.state.value.pending)

        val offline = BdQuizController(
            BdQuizOptions(listOf(capital), feedbackMode = BdQuizFeedbackMode.IMMEDIATE, local = false),
            scope = backgroundScope,
            backend = BdQuizBackend(
                lockAnswer = { _, _ -> throw IOException("offline") },
                submit = { _, _ -> completion() },
            ),
        )
        offline.choose("q_capital", "Paris")
        offline.advance()
        assertEquals("Couldn't lock answer.", offline.screen.value.error)
    }

    @Test fun practiceRunIsTimedHereAndCanBeRetaken() = runTest {
        val clock = TestClock()
        val quiz = BdQuizController(
            BdQuizOptions(
                listOf(capital, ocean), feedbackMode = BdQuizFeedbackMode.END, showTimer = true,
                shuffleQuestions = true, local = true, canRestart = true,
            ),
            scope = backgroundScope,
            backend = BdQuizBackend(submit = { _, ids ->
                assertEquals(setOf("q_capital", "q_ocean"), ids.toSet())
                completion()
            }),
            clock = clock::now,
        )
        quiz.start()
        for (question in quiz.config.questions) {
            if (question.id == "q_capital") quiz.choose(question.id, "Paris") else quiz.setAnswer(question.id, str("Pacific"))
            clock.advance(40.0)
            quiz.advance()
        }
        assertEquals(80.0, quiz.state.value.completion?.durationSeconds)
        assertEquals(false, quiz.state.value.completion?.timedOut)

        quiz.restart()
        assertNull(quiz.state.value.completion)
        assertTrue(quiz.state.value.answers.isEmpty())
        assertEquals(BdQuizPhase.READY, quiz.screen.value.phase)
    }

    @Test fun dontKnowOnlyOnOptionalMultipleChoice() = runTest {
        val optional = field(
            """{"id":"q_primes","type":"checkbox","label":"Primes?","options":["4","7"],
                "quizOptionIds":["o4","o7"],"quizAnswerKey":{"answer":{"option_id":"o7"}}}""",
        )
        val quiz = BdQuizController(
            BdQuizOptions(listOf(capital, optional), feedbackMode = BdQuizFeedbackMode.IMMEDIATE, allowDontKnow = true),
            scope = backgroundScope,
        )
        assertNull(quiz.screen.value.questions[0].dontKnow) // required
        quiz.choose("q_capital", "Nice")
        quiz.advance()
        quiz.advance()
        assertEquals("I don't know", quiz.screen.value.questions[0].dontKnow?.label)
        quiz.chooseDontKnow("q_primes")
        assertEquals(BdJson.Arr(emptyList()), quiz.state.value.answers["q_primes"])
        quiz.advance()
        assertEquals(BdQuizTone.UNSURE, quiz.screen.value.feedback?.badge?.tone)
        assertEquals("I don't know", quiz.screen.value.feedback?.answer)
    }

    @Test fun choicesKeepTheirOrderUnlessAsked() {
        val plain = BdQuizConfig(BdQuizOptions(listOf(capital)), seed = "s")
        assertEquals(listOf("Paris", "Lyon", "Nice"), plain.questions[0].options)
        val kept = field(
            """{"id":"q_kept","type":"radio","label":"Kept","options":["A","B","C","D","E"],"quizKeepChoiceOrder":true,
                "quizOptionIds":["a","b","c","d","e"],"quizAnswerKey":{"answer":{"option_id":"a"}}}""",
        )
        val shuffled = BdQuizConfig(BdQuizOptions(listOf(kept), shuffleChoices = true), seed = "s")
        assertEquals(listOf("A", "B", "C", "D", "E"), shuffled.questions[0].options)
    }
}

/** The wire shape of [BdQuizzes], against a scripted Ktor engine. */
class QuizClientTest {
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")
    private val seen = mutableListOf<HttpRequestData>()

    private fun bodyText(req: HttpRequestData): String = when (val b = req.body) {
        is TextContent -> b.text
        is OutgoingContent.ByteArrayContent -> b.bytes().decodeToString()
        else -> ""
    }

    private fun quizzes() = BdQuizzes.packageApi(
        "pk_test",
        host = "https://bd.test/",
        sessionToken = "sess_1",
        engine = MockEngine { req ->
            seen += req
            when (req.url.toString()) {
                "https://bd.test/api/package/v1/quizzes/invitations/tok%2F1/lock" -> respond(
                    """{"result":{"fieldId":"q","label":"Q","status":"correct","pointsPossible":1,"pointsEarned":1}}""",
                    headers = jsonHeaders,
                )
                "https://bd.test/api/package/v1/quizzes/capitals/score" -> respond(
                    """{"status":"scored","results":[],"pointsEarned":0,"pointsPossible":0,"scorePercent":0,"provisionalScorePercent":0,"passed":false}""",
                    headers = jsonHeaders,
                )
                else -> respond("""{"error":"not_found","message":"This quiz invitation isn't valid."}""", HttpStatusCode.NotFound, jsonHeaders)
            }
        },
    )

    @Test fun refusesASecretKey() {
        assertFailsWith<IllegalArgumentException> { BdQuizzes.packageApi("bd_3ZxQf9") }
        assertFailsWith<IllegalArgumentException> { BdQuizzes.packageApi("sk_live_oops") }
    }

    @Test fun sendsTheKeyTheSessionAndThePackageApiPaths() = runTest {
        val quizzes = quizzes()
        // A token is one path segment, slashes and all (encodeURIComponent).
        val locked = quizzes.lockInvitationAnswer("tok/1", "q", str("Paris"))
        assertEquals(BdQuizQuestionStatus.CORRECT, locked.status)

        val req = seen.first()
        assertEquals(HttpMethod.Post, req.method)
        assertEquals("Bearer pk_test", req.headers[HttpHeaders.Authorization])
        assertEquals("sess_1", req.headers["X-BD-Session-Token"])
        assertEquals("""{"fieldId":"q","answer":"Paris"}""", bodyText(req))

        quizzes.scorePractice("capitals", mapOf("q" to str("x")), listOf("q"))
        assertEquals("""{"answers":{"q":"x"},"questionFieldIds":["q"]}""", bodyText(seen[1]))

        val e = assertFailsWith<BdFormsException> { quizzes.invitation("missing") }
        assertEquals(404, e.status)
        assertEquals("This quiz invitation isn't valid.", e.message)

        // Signed out: no session header.
        runCatching { quizzes.withSession(null).invitation("x") }
        assertNull(seen.last().headers["X-BD-Session-Token"])
    }

    @Test fun readsAnInvitationIntoQuizOptions() = runTest {
        val quizzes = BdQuizzes.packageApi(
            "pk_test",
            host = "https://bd.test",
            engine = MockEngine {
                respond(
                    """{"id":"inv_1","quizId":"qz","name":"Capitals","description":"","passingScore":70,
                        "feedbackMode":"immediate","showScore":true,"resultsRequireAccount":true,"resultsUnlocked":false,
                        "requireAuthentication":false,"authenticationStatus":"not_required","recipientEmailHint":"",
                        "showTimer":false,"timeLimitMinutes":5,"startedAt":null,"deadlineAt":null,"serverNow":1767225600000,
                        "timedOut":false,"questionFieldIds":["q_capital"],"status":"opened","expired":false,"active":true,
                        "settings":{"quiz":{"shuffleChoices":true,"allowDontKnow":true}},
                        "fields":[{"id":"q_capital","type":"radio","label":"Capital?","options":["Paris","Lyon"]}],
                        "lockedAnswers":{"q_capital":"Paris"},
                        "lockedResults":[{"fieldId":"q_capital","label":"Capital?","status":"correct","pointsPossible":1,"pointsEarned":1}],
                        "attempt":null}""",
                    headers = jsonHeaders,
                )
            },
        )
        val invitation = quizzes.invitation("tok")
        val options = invitation.options()
        assertEquals("inv_1", options.seed)
        assertEquals(BdQuizFeedbackMode.IMMEDIATE, options.feedbackMode)
        assertTrue(options.resultsLocked)
        assertTrue(options.shuffleChoices)
        assertEquals(false, options.shuffleQuestions)
        assertEquals(5.0, options.timeLimitMinutes)
        val initial = invitation.initial()
        assertEquals(str("Paris"), initial.answers?.get("q_capital"))
        assertEquals(BdQuizQuestionStatus.CORRECT, initial.results?.single()?.status)
        assertNull(initial.completion)
        assertNull(BdQuizPage.invitation(invitation).gate)
    }
}
