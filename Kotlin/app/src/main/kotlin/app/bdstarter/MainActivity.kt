package app.bdstarter

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import app.bd.Money
import app.bd.Product

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Draw behind the system bars with icons that contrast the theme;
        // Scaffold pads the content clear of them.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val visitorToken = BdApp.visitorToken(this)

        setContent {
            StarterTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    StarterTabs(visitorToken)
                }
            }
        }
    }
}

/** The system's light or dark scheme, from the wallpaper on Android 12+. */
@Composable
private fun StarterTheme(content: @Composable () -> Unit) {
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

@Composable
private fun StarterTabs(visitorToken: String) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Filled.ShoppingCart, contentDescription = null) },
                    label = { Text("Shop") },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Filled.Edit, contentDescription = null) },
                    label = { Text("Form") },
                )
            }
        },
    ) { padding ->
        val inner = Modifier.padding(padding).consumeWindowInsets(padding)
        when (tab) {
            0 -> ShopScreen(visitorToken, inner)
            else -> FormScreen(inner)
        }
    }
}

@Composable
private fun ShopScreen(visitorToken: String, modifier: Modifier = Modifier) {
    val viewModel: ShopViewModel = viewModel(
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                ShopViewModel(visitorToken) as T
        },
    )

    LaunchedEffect(Unit) { viewModel.loadProducts() }

    val state by viewModel.products.collectAsState()

    Column(modifier = modifier) {
        if (!BdApp.isConfigured) {
            Text(
                text = "Not connected to BD — set bd.siteId and " +
                    "bd.publishableKey in local.properties.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(12.dp),
            )
        }

        when (val current = state) {
            is UiState.Loading -> CircularProgressIndicator(Modifier.padding(24.dp))

            is UiState.Failed -> Text(
                text = if (current.isUnavailable) {
                    "Temporarily unavailable.\n${current.message}"
                } else {
                    "Couldn't load.\n${current.message}"
                },
                modifier = Modifier.padding(24.dp),
            )

            is UiState.Loaded -> LazyColumn {
                items(current.value) { product ->
                    ProductRow(product) { viewModel.addToCart(product.id) }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(product: Product, onAdd: () -> Unit) {
    ListItem(
        headlineContent = { Text(product.name) },
        supportingContent = { Text(product.description.orEmpty()) },
        trailingContent = {
            Column {
                // Integer cents — see Money.
                // A card carries no currency — the cart does.
                Text(Money.cents(product.cheapestPriceCents))
                Button(onClick = onAdd) { Text("Add") }
            }
        },
    )
}
