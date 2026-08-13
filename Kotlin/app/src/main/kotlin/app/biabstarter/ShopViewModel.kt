package app.biabstarter

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.biab.BiabException
import app.biab.CartSnapshot
import app.biab.Product
import app.biab.cart
import app.biab.cartAdd
import app.biab.productGrid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * The three states every remote screen has, so each composable doesn't
 * reinvent them — and so "temporarily unavailable" (lapsed plan, suspended
 * site) reads differently from a network blip, a distinction `BiabException`
 * already draws and a customer reads very differently.
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Loaded<T>(val value: T) : UiState<T>
    data class Failed(val message: String, val isUnavailable: Boolean) : UiState<Nothing>
}

class ShopViewModel(private val visitorToken: String) : ViewModel() {

    private val _products = MutableStateFlow<UiState<List<Product>>>(UiState.Loading)
    val products: StateFlow<UiState<List<Product>>> = _products.asStateFlow()

    private val _cart = MutableStateFlow<UiState<CartSnapshot>>(UiState.Loading)
    val cart: StateFlow<UiState<CartSnapshot>> = _cart.asStateFlow()

    fun loadProducts(search: String? = null) {
        val client = BiabApp.client() ?: run {
            _products.value = UiState.Loaded(emptyList())
            return
        }

        viewModelScope.launch {
            _products.value = UiState.Loading
            _products.value = runCatchingBiab { client.productGrid(search = search) }
        }
    }

    fun loadCart() {
        val client = BiabApp.client() ?: run {
            _cart.value = UiState.Loaded(CartSnapshot.EMPTY)
            return
        }

        viewModelScope.launch {
            _cart.value = runCatchingBiab { client.cart(visitorToken) }
        }
    }

    fun addToCart(productId: String) {
        val client = BiabApp.client() ?: return

        viewModelScope.launch {
            _cart.value = runCatchingBiab { client.cartAdd(visitorToken, productId) }
        }
    }

    private suspend fun <T> runCatchingBiab(block: suspend () -> T): UiState<T> =
        try {
            UiState.Loaded(block())
        } catch (error: BiabException) {
            UiState.Failed(error.message ?: "Something went wrong.", error.isUnavailable)
        }
}
