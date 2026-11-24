package app.bd.signin

import android.graphics.BitmapFactory
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/** Who the person is signing in to. They see the business, never BD. */
@Immutable
public data class BdSignInBrand(
    /** Empty: the business's name as BD knows it. */
    val name: String = "",
    /** Shown above the title, 88dp square, clipped to a rounded square. */
    val logo: Painter? = null,
    /** A line under the sign-in title. */
    val tagline: String? = null,
    /**
     * The main button and the focused field: everything the theme's primary
     * would colour. [Color.Unspecified]: the business's primary colour from
     * BD (Settings → Branding), else the theme's primary.
     */
    val tint: Color = Color.Unspecified,
    /** Links. [Color.Unspecified]: the business's secondary from BD, else [tint]. */
    val secondaryTint: Color = Color.Unspecified,
)

/** Every word the screen shows. `%s` is the business's name (or the email, on the code step). */
@Immutable
public data class BdSignInStrings(
    val signInTitle: String = "Sign in to %s",
    val createTitle: String = "Create your %s account",
    val createSubtitle: String = "Your account with %s. We'll email you a code to confirm it.",
    /** The titles while there's no name to show (none given, and BD's not loaded yet). */
    val signInTitleNoName: String = "Sign in",
    val createTitleNoName: String = "Create your account",
    val createSubtitleNoName: String = "We'll email you a code to confirm it.",
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
    val continueWithApple: String = "Continue with Apple",
    val continueWithGoogle: String = "Continue with Google",
    val continueWithGitHub: String = "Continue with GitHub",
    val continueWithDiscord: String = "Continue with Discord",
    val enterEmail: String = "Enter your email.",
    val invalidEmail: String = "Enter a full email address, like name@example.com.",
    val enterPassword: String = "Enter your password.",
    val enterCode: String = "Enter the 6-digit code from the email.",
    val passwordTooShort: String = "Use at least 10 characters for your password.",
    val passwordTooLong: String = "Use 256 characters or fewer for your password.",
    val nameTooLong: String = "Use 100 characters or fewer.",
    val oauthFailed: String = "Sign-in didn't finish. Try again.",
    val oauthLost: String = "That sign-in started somewhere else. Try again.",
)

/** Where the screen opens. */
public enum class BdSignInStart { SignIn, CreateAccount }

/** `Verify`: WorkOS wants the email confirmed before a password sign-in. */
private enum class Purpose { SignUp, Reset, Verify }

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


/**
 * Native sign-in for a business's customers: email and password, a new
 * account confirmed by an emailed code, a forgotten password reset by code,
 * and "Continue with Google / Apple / GitHub / Discord" — WorkOS underneath
 * all of it, through BD, the same accounts as BD's hosted sign-in.
 *
 * Google uses the app's own Credential Manager sheet when [google] is given
 * and the business listed the app; every other provider (and Google without
 * it) opens in a Custom Tab and comes back through [BdSignInRedirectActivity].
 *
 * The business's colours and logo come from BD unless [brand] sets them; it
 * otherwise takes the app's Material theme. Each box is checked when the
 * person leaves it and all of them on submit. Fills the space it's given and
 * scrolls.
 *
 * ```kotlin
 * BdSignIn(
 *     brand = BdSignInBrand(logo = painterResource(R.drawable.logo)),   // the name comes from BD
 *     backend = BdServerSignInBackend.businessDash(publishableKey = "pk_…"),
 *     onSignedIn = { session -> store(session.sessionToken) },
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
    var options by remember { mutableStateOf(BdSignInOptions()) }
    LaunchedEffect(backend) {
        runCatching { backend.options() }.onSuccess { options = it }
    }
    // The brand's colour (the app's, else the business's from BD) stands in
    // for the theme's primary across the screen, with text that reads on it.
    val base = MaterialTheme.colorScheme
    val dark = base.surface.luminance() < 0.5f
    val palette = remember(options.primaryColor, options.secondaryColor) {
        BdSignInPalette.from(options.primaryColor, options.secondaryColor)
    }
    val primary = when {
        brand.tint.isSpecified -> brand.tint
        palette != null -> Color(palette.accent)
        else -> base.primary
    }
    val onPrimary = when {
        brand.tint.isSpecified -> Color(BdSignInPalette.foreground(brand.tint.toArgb()))
        palette != null -> Color(palette.onAccent)
        else -> base.onPrimary
    }
    val link = when {
        brand.secondaryTint.isSpecified -> brand.secondaryTint
        brand.tint.isSpecified -> brand.tint
        palette != null -> Color(palette.link(dark))
        else -> base.primary
    }
    val scheme = base.copy(primary = primary, onPrimary = onPrimary)
    MaterialTheme(colorScheme = scheme, typography = MaterialTheme.typography, shapes = MaterialTheme.shapes) {
        SignInScreen(brand, backend, options, link, onSignedIn, modifier, start, strings, google, contentPadding)
    }
}

/** The business's logo from BD (https only), when the app gives none. */
@Composable
private fun rememberRemoteLogo(url: String?): ImageBitmap? {
    var image by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(url) {
        if (url == null || !url.startsWith("https://")) return@LaunchedEffect
        image = withContext(Dispatchers.IO) {
            runCatching {
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 15_000
                }
                try {
                    connection.inputStream.use { BitmapFactory.decodeStream(it) }?.asImageBitmap()
                } finally {
                    connection.disconnect()
                }
            }.getOrNull()
        }
    }
    return image
}

@Composable
private fun <S> SignInScreen(
    brand: BdSignInBrand,
    backend: BdSignInBackend<S>,
    options: BdSignInOptions,
    linkColor: Color,
    onSignedIn: (S) -> Unit,
    modifier: Modifier,
    start: BdSignInStart,
    strings: BdSignInStrings,
    google: (suspend () -> BdIdToken)?,
    contentPadding: PaddingValues,
) {
    var step by rememberSaveable(stateSaver = StepSaver) {
        mutableStateOf(if (start == BdSignInStart.CreateAccount) Step.CreateAccount else Step.SignIn)
    }
    var firstName by rememberSaveable { mutableStateOf("") }
    var lastName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var newPassword by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    // Each box's message, and the boxes typed in since the step opened (a box
    // is checked when the person leaves it only once they've typed in it).
    var errors by remember { mutableStateOf<Map<BdSignInBox, String>>(emptyMap()) }
    var edited by remember { mutableStateOf<Set<BdSignInBox>>(emptySet()) }
    // A provider sign-in's PKCE verifier, kept across the trip to the browser.
    var oauthVerifier by rememberSaveable { mutableStateOf<String?>(null) }
    val requesters = remember { BdSignInBox.entries.associateWith { FocusRequester() } }
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val context = LocalContext.current
    val tint = MaterialTheme.colorScheme.primary

    fun shown(): List<BdSignInBox> = when (val s = step) {
        Step.SignIn -> listOf(BdSignInBox.Email, BdSignInBox.Password)
        Step.CreateAccount -> listOf(BdSignInBox.FirstName, BdSignInBox.LastName, BdSignInBox.Email, BdSignInBox.Password)
        Step.Forgot -> listOf(BdSignInBox.Email)
        is Step.Code -> if (s.purpose == Purpose.Reset) listOf(BdSignInBox.Code, BdSignInBox.NewPassword) else listOf(BdSignInBox.Code)
    }

    fun value(box: BdSignInBox): String = when (box) {
        BdSignInBox.FirstName -> firstName
        BdSignInBox.LastName -> lastName
        BdSignInBox.Email -> email
        BdSignInBox.Password -> password
        BdSignInBox.Code -> code
        BdSignInBox.NewPassword -> newPassword
    }

    fun check(box: BdSignInBox): String? =
        BdSignInChecks.problem(box, value(box), newPassword = step == Step.CreateAccount, strings = strings)

    fun setError(box: BdSignInBox, message: String?) {
        errors = if (message == null) errors - box else errors + (box to message)
    }

    /** The person left [box]: check it, if they typed in it. */
    fun leave(box: BdSignInBox) {
        if (box in edited && box in shown()) setError(box, check(box))
    }

    /** A box changed: mark it typed in, and re-check one already showing a message. */
    fun typed(box: BdSignInBox) {
        edited = edited + box
        if (box in errors) setError(box, check(box))
    }

    /** Every box this step shows; the first wrong one takes focus. */
    fun checkAll(): Boolean {
        val found = shown().mapNotNull { box -> check(box)?.let { box to it } }.toMap()
        errors = found
        val first = shown().firstOrNull { it in found } ?: return true
        runCatching { requesters.getValue(first).requestFocus() }
        return false
    }

    fun go(next: Step) {
        problem = null
        notice = null
        errors = emptyMap()
        edited = emptySet()
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
                // BD's answer about one box shows under it.
                val box = BdSignInChecks.boxFor(e.code, shown())
                if (box != null) setError(box, e.message) else problem = e.message
            } catch (e: Exception) {
                problem = BdSignInException.unavailable().message
            } finally {
                busy = false
            }
        }
    }

    fun cleanName(text: String) = text.trim().ifEmpty { null }

    fun submit() {
        if (busy) return
        problem = null
        notice = null
        if (!checkAll()) return
        val cleanEmail = email.trim()
        when (val s = step) {
            Step.SignIn -> attempt {
                when (val answer = backend.signIn(cleanEmail, password)) {
                    is BdPasswordSignIn.SignedIn -> onSignedIn(answer.session)
                    // WorkOS wants the email confirmed; it has sent a code.
                    is BdPasswordSignIn.ConfirmEmail -> go(Step.Code(answer.sent, Purpose.Verify, cleanEmail))
                }
            }
            Step.CreateAccount -> attempt {
                val sent = backend.startSignUp(cleanEmail, password, cleanName(firstName), cleanName(lastName))
                go(Step.Code(sent, Purpose.SignUp, cleanEmail))
            }
            Step.Forgot -> attempt { go(Step.Code(backend.startReset(cleanEmail), Purpose.Reset, cleanEmail)) }
            is Step.Code -> attempt {
                focus.clearFocus()
                onSignedIn(backend.verify(s.sent.pendingId, code, if (s.purpose == Purpose.Reset) newPassword else null))
            }
        }
    }

    fun resend() {
        val s = step as? Step.Code ?: return
        attempt {
            val sent = when (s.purpose) {
                Purpose.SignUp -> backend.startSignUp(s.email, password, cleanName(firstName), cleanName(lastName))
                Purpose.Reset -> backend.startReset(s.email)
                Purpose.Verify -> when (val answer = backend.signIn(s.email, password)) {
                    is BdPasswordSignIn.SignedIn -> {
                        onSignedIn(answer.session)
                        return@attempt
                    }
                    is BdPasswordSignIn.ConfirmEmail -> answer.sent
                }
            }
            step = s.copy(sent = sent)
            code = ""
            errors = errors - BdSignInBox.Code
            notice = strings.codeResent
        }
    }

    /** "Continue with …" in a Custom Tab, back through [BdSignInRedirectActivity]. */
    fun continueWith(provider: BdOAuthProvider) {
        problem = null
        attempt {
            val (verifier, challenge) = BdSignInOAuth.newPkcePair()
            oauthVerifier = verifier
            val url = backend.startOAuth(provider, BdSignInOAuth.redirectUri(context), challenge)
            BdSignInOAuth.open(context, url)
        }
    }

    // A provider sign-in coming back: redeem its code with the verifier.
    LaunchedEffect(backend) {
        BdSignInOAuth.returns.collect { uri ->
            if (uri == null || uri.host != BdSignInOAuth.HOST) return@collect
            BdSignInOAuth.consume(uri)
            val handOff = uri.getQueryParameter("bd_oauth_code")
            val failed = uri.getQueryParameter("bd_oauth_error")
            val verifier = oauthVerifier
            oauthVerifier = null
            when {
                handOff != null && verifier != null -> attempt { onSignedIn(backend.finishOAuth(handOff, verifier)) }
                handOff != null -> problem = strings.oauthLost
                failed != null && failed != "cancelled" ->
                    problem = uri.getQueryParameter("bd_oauth_message") ?: strings.oauthFailed
            }
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
                val remoteLogo = rememberRemoteLogo(if (brand.logo == null) options.logoUrl else null)
                (brand.logo ?: remoteLogo?.let { BitmapPainter(it) })?.let {
                    Image(
                        it, contentDescription = null, contentScale = ContentScale.Crop,
                        modifier = Modifier.size(88.dp).shadow(8.dp, RoundedCornerShape(20.dp)).clip(RoundedCornerShape(20.dp)),
                    )
                }
                // The brand's name, or BD's for the business when the brand leaves it empty.
                val name = brand.name.trim().ifEmpty { options.name?.trim().orEmpty() }.ifEmpty { null }
                val (title, subtitle) = when (val s = step) {
                    Step.SignIn -> (name?.let { strings.signInTitle.format(it) } ?: strings.signInTitleNoName) to brand.tagline
                    Step.CreateAccount ->
                        (name?.let { strings.createTitle.format(it) } ?: strings.createTitleNoName) to
                            (name?.let { strings.createSubtitle.format(it) } ?: strings.createSubtitleNoName)
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
                    // One box: its value, its message under it, checked when left.
                    @Composable
                    fun box(
                        box: BdSignInBox,
                        label: String,
                        value: String,
                        set: (String) -> Unit,
                        modifier: Modifier = Modifier.fillMaxWidth(),
                        keyboardOptions: KeyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                        onAction: () -> Unit = { focus.moveFocus(FocusDirection.Down) },
                        secret: Boolean = false,
                        hint: String? = null,
                        textStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyLarge,
                    ) {
                        val field: @Composable (VisualTransformation, (@Composable () -> Unit)?) -> Unit = { transform, trailing ->
                            SignInTextField(
                                label, value,
                                { set(it); typed(box) },
                                modifier.focusRequester(requesters.getValue(box)),
                                keyboardOptions,
                                onAction = onAction,
                                visualTransformation = transform,
                                trailing = trailing,
                                textStyle = textStyle,
                                error = errors[box],
                                hint = hint,
                                onLeave = { leave(box) },
                            )
                        }
                        if (secret) {
                            var visible by remember { mutableStateOf(false) }
                            field(if (visible) VisualTransformation.None else PasswordVisualTransformation()) {
                                TextButton(onClick = { visible = !visible }) { Text(if (visible) strings.hide else strings.show) }
                            }
                        } else {
                            field(VisualTransformation.None, null)
                        }
                    }
                    val emailKeys = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next, autoCorrectEnabled = false)
                    val passwordKeys = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go, autoCorrectEnabled = false)
                    when (shown) {
                        Step.SignIn -> {
                            box(BdSignInBox.Email, strings.email, email, { email = it }, keyboardOptions = emailKeys)
                            box(BdSignInBox.Password, strings.password, password, { password = it }, keyboardOptions = passwordKeys, onAction = ::submit, secret = true)
                        }
                        Step.CreateAccount -> {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                box(BdSignInBox.FirstName, strings.firstName, firstName, { firstName = it }, Modifier.weight(1f))
                                box(BdSignInBox.LastName, strings.lastName, lastName, { lastName = it }, Modifier.weight(1f))
                            }
                            box(BdSignInBox.Email, strings.email, email, { email = it }, keyboardOptions = emailKeys)
                            box(
                                BdSignInBox.Password, strings.password, password, { password = it },
                                keyboardOptions = passwordKeys, onAction = ::submit, secret = true, hint = strings.passwordRule,
                            )
                        }
                        Step.Forgot -> box(
                            BdSignInBox.Email, strings.email, email, { email = it },
                            keyboardOptions = emailKeys.copy(imeAction = ImeAction.Go), onAction = ::submit,
                        )
                        is Step.Code -> {
                            LaunchedEffect(Unit) { runCatching { requesters.getValue(BdSignInBox.Code).requestFocus() } }
                            box(
                                BdSignInBox.Code, strings.code, code,
                                { typed ->
                                    code = typed.filter(Char::isDigit).take(6)
                                    if (code.length == 6 && shown.purpose != Purpose.Reset) submit()
                                },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
                                onAction = ::submit,
                                textStyle = MaterialTheme.typography.titleLarge,
                            )
                            if (shown.purpose == Purpose.Reset) {
                                box(
                                    BdSignInBox.NewPassword, strings.newPassword, newPassword, { newPassword = it },
                                    keyboardOptions = passwordKeys, onAction = ::submit, secret = true, hint = strings.passwordRule,
                                )
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
                    colors = ButtonDefaults.buttonColors(containerColor = tint, contentColor = MaterialTheme.colorScheme.onPrimary),
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
                fun link(text: String, action: () -> Unit) = TextButton(onClick = action, enabled = !busy) { Text(text, color = linkColor) }
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

            // Apple, Google, GitHub, Discord: Google from the app's own sheet
            // where it can be, the rest (and Google without it) as links.
            val providers = BdOAuthProvider.entries.filter { provider ->
                (provider == BdOAuthProvider.Google && options.google && google != null) || provider in options.oauth
            }
            if ((step == Step.SignIn || step == Step.CreateAccount) && providers.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HorizontalDivider(Modifier.weight(1f))
                        Text(strings.or, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider(Modifier.weight(1f))
                    }
                    for (provider in providers) {
                        OutlinedButton(
                            onClick = {
                                if (provider == BdOAuthProvider.Google && options.google && google != null) {
                                    attempt {
                                        val token = google()
                                        onSignedIn(backend.signIn(BdSignInProvider.Google, token.idToken, token.nonce, null, null))
                                    }
                                } else {
                                    continueWith(provider)
                                }
                            },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text(
                                when (provider) {
                                    BdOAuthProvider.Apple -> strings.continueWithApple
                                    BdOAuthProvider.Google -> strings.continueWithGoogle
                                    BdOAuthProvider.GitHub -> strings.continueWithGitHub
                                    BdOAuthProvider.Discord -> strings.continueWithDiscord
                                },
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
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
    /** What's wrong, shown under the box (and read out with it). */
    error: String? = null,
    /** A rule shown under the box while there's nothing wrong. */
    hint: String? = null,
    /** The box lost focus. */
    onLeave: () -> Unit = {},
) {
    var focused by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.onFocusChanged { state ->
            if (focused && !state.isFocused) onLeave()
            focused = state.isFocused
        },
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        keyboardOptions = keyboardOptions,
        keyboardActions = KeyboardActions(onAny = { onAction() }),
        visualTransformation = visualTransformation,
        trailingIcon = trailing,
        textStyle = textStyle,
        isError = error != null,
        supportingText = (error ?: hint)?.let { text -> { Text(text) } },
    )
}
