package app.biabstarter

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import app.biab.Money
import app.biab.Product

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val visitorToken = BiabApp.visitorToken(this)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ShopScreen(visitorToken)
                }
            }
        }
    }
}

@Composable
private fun ShopScreen(visitorToken: String) {
    val viewModel: ShopViewModel = viewModel(
        factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                ShopViewModel(visitorToken) as T
        },
    )

    LaunchedEffect(Unit) { viewModel.loadProducts() }

    val state by viewModel.products.collectAsState()

    Scaffold { padding ->
        Column(modifier = Modifier.padding(padding)) {
            if (!BiabApp.isConfigured) {
                Text(
                    text = "Not connected to BIAB — set biab.siteId and " +
                        "biab.publishableKey in local.properties.",
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
