package app.bdstarter

import android.annotation.SuppressLint
import android.app.Application
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import app.bd.BdException
import app.bd.BdHttpException
import app.bd.signin.BdSignIn
import app.bd.signin.BdSignInBrand
import app.bd.signin.BdSignInSession
import app.bd.deleteAccount
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

    private val _deleting = MutableStateFlow(false)
    val deleting: StateFlow<Boolean> = _deleting.asStateFlow()
    private val _deleteError = MutableStateFlow<String?>(null)
    val deleteError: StateFlow<String?> = _deleteError.asStateFlow()

    /** Deletes the customer's account with this business, then forgets the token. */
    fun deleteAccount() {
        val token = store.token ?: return signOut()
        val client = BdApp.client() ?: return
        _deleting.value = true
        viewModelScope.launch {
            try {
                client.deleteAccount(token)
                signOut()
            } catch (error: BdHttpException) {
                if (error.status == 401) {
                    signOut()
                    _deleteError.value = "Your sign-in has expired. Sign in again, then delete your account."
                } else {
                    _deleteError.value = DELETE_FAILED
                }
            } catch (_: BdException) {
                _deleteError.value = DELETE_FAILED
            } finally {
                _deleting.value = false
            }
        }
    }

    fun dismissDeleteError() {
        _deleteError.value = null
    }

    private companion object {
        const val DELETE_FAILED = "Your account couldn't be deleted just now. Please try again in a minute."
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
    val deleting by model.deleting.collectAsState()
    val deleteError by model.deleteError.collectAsState()
    var confirmingDelete by rememberSaveable { mutableStateOf(false) }
    val backend = remember { BdApp.signInBackend() }

    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("Delete your account?") },
            text = { Text("Your profile, saved settings and cart are deleted and you're signed out. This can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmingDelete = false
                    model.deleteAccount()
                }) { Text("Delete account", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("Cancel") } },
        )
    }
    deleteError?.let { message ->
        AlertDialog(
            onDismissRequest = model::dismissDeleteError,
            title = { Text("Account not deleted") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = model::dismissDeleteError) { Text("OK") } },
        )
    }

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
            // Google Play and the App Store require it in the app, not on a website.
            TextButton(onClick = { confirmingDelete = true }, enabled = !deleting) {
                Text("Delete account", color = MaterialTheme.colorScheme.error)
            }
            Text(
                "Deletes your account with us. Records of past orders and invoices stay with us, as the law asks.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
