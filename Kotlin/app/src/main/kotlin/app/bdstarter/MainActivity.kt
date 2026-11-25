package app.bdstarter

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {
    private val starter: StarterViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // Draw behind the system bars with icons that contrast the theme;
        // Scaffold pads the content clear of them.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // Opened by Stripe's return link (the app wasn't running).
        if (savedInstanceState == null) starter.state.checkoutReturned(intent?.dataString)
        setContent {
            StarterTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    // The Account tab owns sign-in; the blog and reviews read its token.
                    val account: AccountViewModel = viewModel()
                    val token by account.token.collectAsState()
                    LaunchedEffect(token) { starter.state.sessionToken = token }
                    StarterApp(starter.state) { modifier -> AccountScreen(modifier, account) }
                }
            }
        }
    }

    /** Stripe sending the customer back to `{applicationId}://checkout/…` (launchMode singleTask). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        starter.state.checkoutReturned(intent.dataString)
    }
}

/** The system's light or dark scheme, from the wallpaper on Android 12+. */
@Composable
fun StarterTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> darkColorScheme()
        else -> lightColorScheme()
    }
    MaterialTheme(colorScheme = colors, content = content)
}
