package app.bdstarter

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import app.bd.cart

/**
 * The tabs, and the screens opened over them (a product, a post, the
 * reviews…). A covered screen stays composed, so going back finds it as it
 * was — scrolled where it was, with what it loaded — but it is hidden from
 * touch, drawing and TalkBack.
 */
@Composable
fun StarterApp(app: AppState, accountScreen: @Composable (Modifier) -> Unit) {
    CompositionLocalProvider(LocalApp provides app) {
        BackHandler(enabled = app.stack.isNotEmpty()) { app.back() }
        // The badge counts what's already in the cart.
        LaunchedEffect(app.client) {
            val client = app.client ?: return@LaunchedEffect
            bdCall { client.cart(app.visitorToken) }.onSuccess(app::noteCart)
        }
        val tabs = rememberSaveableStateHolder()
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().covered(app.stack.isNotEmpty())) {
                Scaffold(bottomBar = { TabBar(app) }) { padding ->
                    val inner = Modifier.padding(padding).consumeWindowInsets(padding)
                    tabs.SaveableStateProvider(app.tab.name) {
                        when (app.tab) {
                            Tab.Shop -> StoreScreen(inner)
                            Tab.Cart -> CartScreen(inner)
                            Tab.Blog -> BlogScreen(inner)
                            Tab.Form -> FormScreen(inner)
                            Tab.Quiz -> QuizScreen(inner)
                            Tab.Account -> accountScreen(inner)
                        }
                    }
                }
            }
            app.stack.forEachIndexed { index, entry ->
                key(entry.id) {
                    Box(Modifier.fillMaxSize().covered(index < app.stack.lastIndex)) {
                        when (val route = entry.route) {
                            is Route.Product -> ProductScreen(route.id)
                            Route.Wishlist -> WishlistScreen()
                            Route.Compare -> CompareScreen()
                            Route.Reviews -> ReviewsScreen()
                            is Route.Post -> PostScreen(route.slug)
                            is Route.Order -> OrderScreen(route.sessionId)
                        }
                    }
                }
            }
        }
    }
}

/** Under another screen: not drawn, and out of the accessibility tree. Its Scaffold already takes no touches through the one above. */
private fun Modifier.covered(covered: Boolean): Modifier =
    if (covered) graphicsLayer { alpha = 0f }.clearAndSetSemantics { } else this

@Composable
private fun TabBar(app: AppState) {
    NavigationBar {
        for (tab in Tab.entries) {
            NavigationBarItem(
                selected = app.tab == tab,
                onClick = { app.showTab(tab) },
                alwaysShowLabel = false,
                label = { Text(tab.label) },
                icon = {
                    if (tab == Tab.Cart && app.cartCount > 0) {
                        BadgedBox(badge = { Badge { Text("${app.cartCount}") } }) { Icon(tab.icon, contentDescription = null) }
                    } else {
                        Icon(tab.icon, contentDescription = null)
                    }
                },
            )
        }
    }
}

private val Tab.icon: ImageVector
    get() = when (this) {
        Tab.Shop -> Icons.Filled.Home
        Tab.Cart -> Icons.Filled.ShoppingCart
        Tab.Blog -> Icons.AutoMirrored.Filled.List
        Tab.Form -> Icons.Filled.Edit
        Tab.Quiz -> Icons.Filled.CheckCircle
        Tab.Account -> Icons.Filled.AccountCircle
    }
