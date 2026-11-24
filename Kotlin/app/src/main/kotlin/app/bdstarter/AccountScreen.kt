package app.bdstarter

import android.annotation.SuppressLint
import android.app.Application
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import app.bd.BdException
import app.bd.signin.BdSignIn
import app.bd.signin.BdSignInBrand
import app.bd.signin.BdSignInSession
import app.bd.tenantSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AccountState {
    data object Checking : AccountState
    data object SignedOut : AccountState
    data class SignedIn(val name: String) : AccountState
}

/**
 * Who's signed in. The token is checked with BD on launch: one BD no longer
 * takes is dropped, and one that can't be checked (offline) is kept.
 */
class AccountViewModel(app: Application) : AndroidViewModel(app) {
    private val store = SessionStore(app)
    private val _state = MutableStateFlow<AccountState>(AccountState.Checking)
    val state: StateFlow<AccountState> = _state.asStateFlow()

    init {
        viewModelScope.launch { restore() }
    }

    private suspend fun restore() {
        val token = store.token
        val client = BdApp.client()
        if (token == null || client == null) {
            _state.value = AccountState.SignedOut
            return
        }
        _state.value = try {
            val session = client.tenantSession(token)
            if (session == null) {
                store.clear()
                AccountState.SignedOut
            } else {
                store.saveName(session.user.displayName)
                AccountState.SignedIn(session.user.displayName)
            }
        } catch (_: BdException) {
            AccountState.SignedIn(store.name)
        }
    }

    fun adopt(session: BdSignInSession) {
        store.save(session.sessionToken, session.displayName)
        _state.value = AccountState.SignedIn(session.displayName)
    }

    /** BD's session tokens are signed, not stored: signing out is forgetting it. */
    fun signOut() {
        store.clear()
        _state.value = AccountState.SignedOut
    }
}

/**
 * Signed out, the SDK's native sign-in (`BdSignIn`): the business's name from
 * BD and the app's `brand_logo` drawable, never BD's. What a customer sees here
 * is this business's alone; the login (WorkOS) is one per email.
 */
@Composable
fun AccountScreen(modifier: Modifier = Modifier) {
    val model: AccountViewModel = viewModel()
    val state by model.state.collectAsState()
    val backend = remember { BdApp.signInBackend() }

    when {
        backend == null -> Text(
            text = "Not connected to BD — set bd.siteId and bd.publishableKey in local.properties to turn on sign-in.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = modifier.padding(24.dp),
        )

        state is AccountState.Checking -> CircularProgressIndicator(modifier.padding(24.dp))

        state is AccountState.SignedIn -> Column(
            modifier = modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Signed in as ${(state as AccountState.SignedIn).name}", style = MaterialTheme.typography.titleMedium)
            OutlinedButton(onClick = model::signOut) { Text("Sign out") }
        }

        else -> BdSignIn(
            brand = BdSignInBrand(logo = brandLogo(), tagline = "Sign in to see your orders and bookings."),
            backend = backend,
            onSignedIn = model::adopt,
            modifier = modifier,
        )
    }
}

/** The app's `brand_logo` drawable, if it has one. Add yours to res/drawable. */
@SuppressLint("DiscouragedApi")
@Composable
private fun brandLogo(): Painter? {
    val context = LocalContext.current
    val id = remember { context.resources.getIdentifier("brand_logo", "drawable", context.packageName) }
    return if (id != 0) painterResource(id) else null
}
