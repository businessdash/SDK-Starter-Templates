package app.bd.signin

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.takeOrElse
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Who the person is signing in to. They see the business, never BD. */
@Immutable
public data class BdSignInBrand(
    val name: String,
    /** Shown above the title, 88dp square, clipped to a rounded square. */
    val logo: Painter? = null,
    /** A line under the sign-in title. */
    val tagline: String? = null,
    /** Buttons and links. [Color.Unspecified]: the theme's primary. */
    val tint: Color = Color.Unspecified,
)

/** Every word the screen shows. `%s` is the business's name (or the email, on the code step). */
@Immutable
public data class BdSignInStrings(
    val signInTitle: String = "Sign in to %s",
    val createTitle: String = "Create your %s account",
    val createSubtitle: String = "An account just for %s, with its own password.",
    val forgotTitle: String = "Reset your password",
    val forgotSubtitle: String = "Enter your email and we'll send you a code.",
    val codeTitle: String = "Check your email",
    val codeSubtitle: String = "We sent a 6-digit code to %s.",
    val codeResetSubtitle: String = "We sent a 6-digit code to %s. Enter it with your new password.",
    val email: String = "Email",
    val password: String = "Password",
    val newPassword: String = "New password",
    val firstName: String = "First name",
    val lastName: String = "Last name",
    val code: String = "6-digit code",
    val passwordRule: String = "At least 10 characters.",
    val show: String = "Show",
    val hide: String = "Hide",
    val signIn: String = "Sign in",
    val createAccount: String = "Create account",
    val sendCode: String = "Send code",
    val confirm: String = "Continue",
    val resendCode: String = "Send a new code",
    val codeResent: String = "A new code is on its way.",
    val forgotPassword: String = "Forgot password?",
    val noAccount: String = "New here? Create an account",
    val haveAccount: String = "Already have an account? Sign in",
    val backToSignIn: String = "Back to sign in",
    val or: String = "or",
    val continueWithGoogle: String = "Continue with Google",
    val enterEmail: String = "Enter your email.",
    val enterPassword: String = "Enter your password.",
    val enterCode: String = "Enter the 6-digit code from the email.",
    val passwordTooShort: String = "Use at least 10 characters for your password.",
)

/** Where the screen opens. */
public enum class BdSignInStart { SignIn, CreateAccount }

private enum class Purpose { SignUp, Reset }

private sealed interface Step {
    data object SignIn : Step
    data object CreateAccount : Step
    data object Forgot : Step
    data class Code(val sent: BdCodeSent, val purpose: Purpose, val email: String) : Step
}

private val StepSaver = Saver<Step, List<String>>(
    save = {
        when (it) {
            Step.SignIn -> listOf("signIn")
            Step.CreateAccount -> listOf("create")
            Step.Forgot -> listOf("forgot")
            is Step.Code -> listOf("code", it.sent.pendingId, it.sent.expiresAt, it.purpose.name, it.email)
        }
    },
    restore = {
        when (it.firstOrNull()) {
            "create" -> Step.CreateAccount
            "forgot" -> Step.Forgot
            "code" -> Step.Code(BdCodeSent(it[1], it[2]), Purpose.valueOf(it[3]), it[4])
            else -> Step.SignIn
        }
    },
)

private const val MIN_PASSWORD = 10

/**
 * Native sign-in for a business's customers: email and password, a new
 * account confirmed by an emailed code, a forgotten password reset by code,
 * and Sign in with Google where the business has set it up (pass [google],
 * which gets the ID token with Credential Manager).
 *
 * It takes the app's Material theme. Fills the space it's given and scrolls.
 *
 * ```kotlin
 * BdSignIn(
 *     brand = BdSignInBrand("Acme", logo = painterResource(R.drawable.logo)),
 *     backend = BdServerSignInBackend("https://acme.com/api/account") { json -> MySession.parse(json) },
 *     onSignedIn = { session -> store(session) },
 * )
 * ```
 */
@Composable
public fun <S> BdSignIn(
    brand: BdSignInBrand,
    backend: BdSignInBackend<S>,
    onSignedIn: (S) -> Unit,
    modifier: Modifier = Modifier,
    start: BdSignInStart = BdSignInStart.SignIn,
    strings: BdSignInStrings = BdSignInStrings(),
    google: (suspend () -> BdIdToken)? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 24.dp, vertical = 32.dp),
) {
    var step by rememberSaveable(stateSaver = StepSaver) {
        mutableStateOf(if (start == BdSignInStart.CreateAccount) Step.CreateAccount else Step.SignIn)
    }
    var options by remember { mutableStateOf(BdSignInOptions()) }
    var firstName by rememberSaveable { mutableStateOf("") }
    var lastName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val tint = brand.tint.takeOrElse { MaterialTheme.colorScheme.primary }

    LaunchedEffect(backend) {
        runCatching { backend.options() }.onSuccess { options = it }
    }

    fun go(next: Step) {
        problem = null
        notice = null
        code = ""
        newPassword = ""
        step = next
    }

    fun attempt(work: suspend () -> Unit) {
        if (busy) return
        busy = true
        problem = null
        scope.launch {
            try {
                work()
            } catch (e: CancellationException) {
                throw e
            } catch (e: BdSignInException) {
                problem = e.message
            } catch (e: Exception) {
                problem = BdSignInException.unavailable().message
            } finally {
                busy = false
            }
        }
    }

    fun cleanName(text: String) = text.trim().ifEmpty { null }

    fun submit() {
        problem = null
        notice = null
        val cleanEmail = email.trim()
        when (val s = step) {
            Step.SignIn -> when {
                cleanEmail.isEmpty() -> problem = strings.enterEmail
                password.isEmpty() -> problem = strings.enterPassword
                else -> attempt { onSignedIn(backend.signIn(cleanEmail, password)) }
            }
            Step.CreateAccount -> when {
                cleanEmail.isEmpty() -> problem = strings.enterEmail
                password.length < MIN_PASSWORD -> problem = strings.passwordTooShort
                else -> attempt {
                    val sent = backend.startSignUp(cleanEmail, password, cleanName(firstName), cleanName(lastName))
                    go(Step.Code(sent, Purpose.SignUp, cleanEmail))
                }
            }
            Step.Forgot -> when {
                cleanEmail.isEmpty() -> problem = strings.enterEmail
                else -> attempt { go(Step.Code(backend.startReset(cleanEmail), Purpose.Reset, cleanEmail)) }
            }
            is Step.Code -> when {
                code.length != 6 -> problem = strings.enterCode
                s.purpose == Purpose.Reset && newPassword.length < MIN_PASSWORD -> problem = strings.passwordTooShort
                else -> attempt {
                    focus.clearFocus()
                    onSignedIn(backend.verify(s.sent.pendingId, code, if (s.purpose == Purpose.Reset) newPassword else null))
                }
            }
        }
    }

    fun resend() {
        val s = step as? Step.Code ?: return
        attempt {
            val sent = if (s.purpose == Purpose.SignUp) {
                backend.startSignUp(s.email, password, cleanName(firstName), cleanName(lastName))
            } else {
                backend.startReset(s.email)
            }
            step = s.copy(sent = sent)
            code = ""
            notice = strings.codeResent
        }
    }

    // Back steps back to sign-in from the steps it leads to; from where it started, the app's back.
    BackHandler(enabled = step is Step.Forgot || step is Step.Code) { go(Step.SignIn) }

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(contentPadding),
            verticalArrangement = Arrangement.spacedBy(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Header
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                brand.logo?.let {
                    Image(
                        it, contentDescription = null, contentScale = ContentScale.Crop,
                        modifier = Modifier.size(88.dp).shadow(8.dp, RoundedCornerShape(20.dp)).clip(RoundedCornerShape(20.dp)),
                    )
                }
                val (title, subtitle) = when (val s = step) {
                    Step.SignIn -> strings.signInTitle.format(brand.name) to brand.tagline
                    Step.CreateAccount -> strings.createTitle.format(brand.name) to strings.createSubtitle.format(brand.name)
                    Step.Forgot -> strings.forgotTitle to strings.forgotSubtitle
                    is Step.Code -> strings.codeTitle to
                        (if (s.purpose == Purpose.Reset) strings.codeResetSubtitle else strings.codeSubtitle).format(s.email)
                }
                Text(
                    title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurface,
                )
                subtitle?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // Fields
            AnimatedContent(targetState = step, label = "step") { shown ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when (shown) {
                        Step.SignIn -> {
                            EmailField(strings.email, email, { email = it }, ImeAction.Next) { focus.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) }
                            PasswordField(strings, strings.password, password, { password = it }) { submit() }
                        }
                        Step.CreateAccount -> {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                SignInTextField(strings.firstName, firstName, { firstName = it }, Modifier.weight(1f), KeyboardOptions(imeAction = ImeAction.Next))
                                SignInTextField(strings.lastName, lastName, { lastName = it }, Modifier.weight(1f), KeyboardOptions(imeAction = ImeAction.Next))
                            }
                            EmailField(strings.email, email, { email = it }, ImeAction.Next) { focus.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) }
                            PasswordField(strings, strings.password, password, { password = it }) { submit() }
                            Text(strings.passwordRule, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Step.Forgot -> EmailField(strings.email, email, { email = it }, ImeAction.Go) { submit() }
                        is Step.Code -> {
                            val requester = remember { FocusRequester() }
                            LaunchedEffect(Unit) { runCatching { requester.requestFocus() } }
                            SignInTextField(
                                strings.code, code,
                                { typed ->
                                    code = typed.filter(Char::isDigit).take(6)
                                    if (code.length == 6 && shown.purpose == Purpose.SignUp) submit()
                                },
                                Modifier.fillMaxWidth().focusRequester(requester),
                                KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
                                onAction = { submit() },
                                textStyle = MaterialTheme.typography.titleLarge,
                            )
                            if (shown.purpose == Purpose.Reset) {
                                PasswordField(strings, strings.newPassword, newPassword, { newPassword = it }) { submit() }
                                Text(strings.passwordRule, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                problem?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
                notice?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Button(
                    onClick = ::submit,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = tint),
                ) {
                    if (busy) {
                        CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    } else {
                        Text(
                            when (step) {
                                Step.SignIn -> strings.signIn
                                Step.CreateAccount -> strings.createAccount
                                Step.Forgot -> strings.sendCode
                                is Step.Code -> strings.confirm
                            },
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                }
            }

            // Links
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                @Composable
                fun link(text: String, action: () -> Unit) = TextButton(onClick = action, enabled = !busy) { Text(text, color = tint) }
                when (step) {
                    Step.SignIn -> if (options.password) {
                        link(strings.forgotPassword) { go(Step.Forgot) }
                        link(strings.noAccount) { go(Step.CreateAccount) }
                    }
                    Step.CreateAccount -> link(strings.haveAccount) { go(Step.SignIn) }
                    Step.Forgot -> link(strings.backToSignIn) { go(Step.SignIn) }
                    is Step.Code -> {
                        link(strings.resendCode, ::resend)
                        link(strings.backToSignIn) { go(Step.SignIn) }
                    }
                }
            }

            // Google, where the business set it up and the app can get a token.
            if ((step == Step.SignIn || step == Step.CreateAccount) && options.google && google != null) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HorizontalDivider(Modifier.weight(1f))
                        Text(strings.or, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider(Modifier.weight(1f))
                    }
                    OutlinedButton(
                        onClick = {
                            attempt {
                                val token = google()
                                onSignedIn(backend.signIn(BdSignInProvider.Google, token.idToken, token.nonce, null, null))
                            }
                        },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(12.dp),
                    ) { Text(strings.continueWithGoogle, style = MaterialTheme.typography.titleMedium) }
                }
            }
        }
    }
}

@Composable
private fun SignInTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    onAction: () -> Unit = {},
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailing: (@Composable () -> Unit)? = null,
    textStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyLarge,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = keyboardOptions,
        keyboardActions = KeyboardActions(onAny = { onAction() }),
        visualTransformation = visualTransformation,
        trailingIcon = trailing,
        textStyle = textStyle,
    )
}

@Composable
private fun EmailField(label: String, value: String, onValueChange: (String) -> Unit, ime: ImeAction, onAction: () -> Unit) {
    SignInTextField(
        label, value, onValueChange,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ime, autoCorrectEnabled = false),
        onAction = onAction,
    )
}

@Composable
private fun PasswordField(strings: BdSignInStrings, label: String, value: String, onValueChange: (String) -> Unit, onDone: () -> Unit) {
    var shown by remember { mutableStateOf(false) }
    SignInTextField(
        label, value, onValueChange,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go, autoCorrectEnabled = false),
        onAction = onDone,
        visualTransformation = if (shown) VisualTransformation.None else PasswordVisualTransformation(),
        trailing = { TextButton(onClick = { shown = !shown }) { Text(if (shown) strings.hide else strings.show) } },
    )
}
