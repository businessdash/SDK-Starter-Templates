package app.bdstarter

import android.content.Context
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import app.bd.forms.BdFormField
import app.bd.forms.BdFormSchema
import app.bd.forms.BdQuizCompletion
import app.bd.forms.BdQuizController
import app.bd.forms.BdQuizEngine
import app.bd.forms.BdQuizFeedbackMode
import app.bd.forms.BdQuizOptions
import app.bd.forms.BdQuizPage
import app.bd.forms.BdQuizPageInfo
import app.bd.forms.BdQuizzes
import app.bd.forms.ui.BdQuiz
import app.bd.forms.ui.BdQuizSource

/**
 * A BusinessDash quiz drawn with native Material 3 controls: no web view.
 *
 * With `bd.quiz` (a practice quiz's slug) and `bd.publishableKey` in
 * local.properties this is that quiz, graded by BD. Otherwise it's a bundled
 * sample graded on the device, so the tab works before setup: a 5-minute
 * countdown, verdicts as you go, multiple choice, a typed answer and an open
 * one.
 *
 * An invited quiz is the same call with `BdQuizSource.Invitation(token)`, and
 * the signed-in customer's session on [BdQuizzes] when the invitation needs
 * their account.
 */
@Composable
fun QuizScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val onDone: (BdQuizCompletion) -> Unit = { completion ->
        val score = completion.scorePercent ?: completion.provisionalScorePercent
        val text = score?.let { "Scored ${BdQuizEngine.percent(it)}%" } ?: "Quiz submitted"
        Toast.makeText(context, text, Toast.LENGTH_SHORT).show()
    }

    if (BuildConfig.BD_QUIZ.isNotEmpty() && BuildConfig.BD_PK.isNotEmpty()) {
        val quizzes = remember { BdQuizzes.packageApi(BuildConfig.BD_PK, BuildConfig.BD_HOST) }
        BdQuiz(BdQuizSource.Practice(BuildConfig.BD_QUIZ), quizzes, modifier, onDone = onDone)
    } else {
        val scope = rememberCoroutineScope()
        val quiz = remember {
            BdQuizController(
                BdQuizOptions(
                    fields = sampleQuestions(context),
                    feedbackMode = BdQuizFeedbackMode.IMMEDIATE,
                    timeLimitMinutes = 5.0,
                    allowDontKnow = true,
                ),
                scope,
            )
        }
        BdQuiz(quiz, modifier, page = BdQuizPage.practice(SampleQuiz), onDone = onDone)
    }
}

private object SampleQuiz : BdQuizPageInfo {
    override val name = "Sample quiz"
    override val description = "Bundled with the starter and graded on this device. Set bd.quiz to run one of your practice quizzes."
    override val estimatedMinutes = 2.0
    override val timeLimitMinutes = 5.0
}

private fun sampleQuestions(context: Context): List<BdFormField> {
    val text = context.assets.open("bd-demo-quiz.json").bufferedReader().use { it.readText() }
    return BdFormSchema.fromJson(text).fields
}
