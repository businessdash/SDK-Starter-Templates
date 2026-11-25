package app.bdstarter

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.bd.BdClient
import app.bd.CartSnapshot
import app.bd.CheckoutStatus
import app.bd.cart
import app.bd.cartApplyCoupon
import app.bd.cartClear
import app.bd.cartRemove
import app.bd.cartRemoveCoupon
import app.bd.cartSetQuantity
import app.bd.checkoutStatus
import app.bd.startCheckout
import kotlinx.coroutines.launch

/**
 * The cart: lines with − / + and Remove, a coupon, the subtotal, and Checkout,
 * which opens Stripe in the browser. Stripe sends the customer back to
 * `{applicationId}://checkout/…`, which MainActivity hands to
 * [AppState.checkoutReturned].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val client = app.client
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var cart by remember { mutableStateOf<CartSnapshot?>(null) }
    var failure by remember { mutableStateOf<Throwable?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }
    var code by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(client, attempt) {
        client ?: return@LaunchedEffect
        failure = null
        bdCall { client.cart(app.visitorToken) }
            .onSuccess {
                cart = it
                app.noteCart(it)
            }
            .onFailure { failure = it }
    }

    /** One change at a time; the cart BD answers with replaces the one shown. */
    fun change(failed: String = "Couldn't update your cart. Try again.", call: suspend BdClient.(String) -> CartSnapshot) {
        client ?: return
        busy = true
        note = null
        scope.launch {
            bdCall { client.call(app.visitorToken) }
                .onSuccess {
                    cart = it
                    app.noteCart(it)
                }
                .onFailure { note = bdProblem(it, failed) }
            busy = false
        }
    }

    fun checkout() {
        client ?: return
        busy = true
        note = null
        scope.launch {
            bdCall { client.startCheckout(app.visitorToken, app.checkoutSuccessUrl, app.checkoutCancelUrl) }
                .onSuccess { session ->
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(session.stripeUrl)))
                    } catch (_: ActivityNotFoundException) {
                        note = "Couldn't open checkout. Try again."
                    }
                }
                .onFailure { note = bdProblem(it, "Couldn't start checkout. Try again.") }
            busy = false
        }
    }

    Scaffold(modifier = modifier, topBar = { TopAppBar(title = { Text("Cart") }) }) { padding ->
        val shown = cart
        val problem = failure
        when {
            client == null -> Notice("Not connected to BD.", Modifier.padding(padding))
            shown == null && problem != null -> Notice(loadProblem(problem, "cart"), Modifier.padding(padding)) {
                TextButton(onClick = { attempt++ }) { Text("Try again") }
            }
            shown == null -> Loading(Modifier.padding(padding))
            shown.isEmpty -> Notice("Your cart is empty", Modifier.padding(padding)) {
                TextButton(onClick = { app.showTab(Tab.Shop) }) { Text("Browse the store →") }
            }
            else -> Column(Modifier.padding(padding).fillMaxSize()) {
                val currency = shown.currency ?: "USD"
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(vertical = 8.dp)) {
                    items(shown.items, key = { it.id }) { item ->
                        CartLine(
                            item,
                            currency,
                            enabled = !busy,
                            onQuantity = { quantity ->
                                change { if (quantity < 1) cartRemove(it, item.id) else cartSetQuantity(it, item.id, quantity) }
                            },
                            onRemove = { change { cartRemove(it, item.id) } },
                        )
                        HorizontalDivider()
                    }
                    item(key = "coupon") {
                        CouponField(
                            coupon = shown.couponCode,
                            code = code,
                            onCodeChange = { code = it },
                            enabled = !busy,
                            onApply = {
                                val typed = code.trim()
                                if (typed.isNotEmpty()) {
                                    change("That code didn't work.") { visitor -> cartApplyCoupon(visitor, typed).also { code = "" } }
                                }
                            },
                            onRemove = { change { cartRemoveCoupon(it) } },
                        )
                    }
                }
                CartSummaryBar(
                    subtotal = shown.subtotal,
                    currency = currency,
                    note = note,
                    enabled = !busy,
                    onClear = { change { cartClear(it) } },
                    onCheckout = ::checkout,
                )
            }
        }
    }
}

/** Back from Stripe: whether the order is paid, then back to the store. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderScreen(sessionId: String) {
    val app = LocalApp.current
    val client = app.client
    var status by remember { mutableStateOf<CheckoutStatus?>(null) }
    var done by remember { mutableStateOf(false) }
    LaunchedEffect(client, sessionId) {
        client ?: return@LaunchedEffect
        status = bdCall { client.checkoutStatus(sessionId) }.getOrNull()
        done = true
        // A paid cart is emptied by BD: the badge follows.
        bdCall { client.cart(app.visitorToken) }.onSuccess(app::noteCart)
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Order") }, navigationIcon = { BackButton() }) }) { padding ->
        if (!done && client != null) {
            Loading(Modifier.padding(padding))
        } else {
            val paid = status?.isPaid == true
            val email = status?.customerEmail
            Column(
                Modifier.padding(padding).fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(if (paid) "Thank you for your order" else "Your order", style = MaterialTheme.typography.headlineSmall)
                Text(
                    when {
                        paid && !email.isNullOrEmpty() -> "Your payment went through. A receipt is on its way to $email."
                        paid -> "Your payment went through."
                        else -> "We're confirming your payment. You'll get an email when it's done."
                    },
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Button(onClick = { app.showTab(Tab.Shop) }) { Text("Continue shopping") }
            }
        }
    }
}
