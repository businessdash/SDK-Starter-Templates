package app.bdstarter

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import app.bd.BlogPost
import app.bd.CartItem
import app.bd.ProductCategory
import app.bd.ProductPrice
import app.bd.ProductView
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A product page of an app's own, laid out from the public parts in its
 * own order: no photos, the button right under the name. The rules (the
 * price for a style and size, what's sold out) stay ProductView's.
 */
@Composable
private fun MyProductPage(view: ProductView, onAdd: (variantId: String, options: Map<String, String>?, quantity: Int) -> Unit) {
    var variantId by remember { mutableStateOf(view.defaultVariant?.id) }
    var chosen by remember { mutableStateOf(mapOf<String, String>()) }
    var quantity by remember { mutableIntStateOf(1) }
    val style = variantId
    val groups = style?.let { view.optionGroups(it) }.orEmpty()
    val price = style?.let { view.price(it, chosen) } ?: ProductPrice(amount = null, from = false, ready = false)
    Column {
        ProductTitle(view.categoryName, view.name)
        AddToCartButton(price, adding = false, hasOptions = groups.isNotEmpty(), enabled = style != null) {
            if (style != null) onAdd(style, view.chosenOptions(style, chosen), quantity)
        }
        ProductPriceText(price)
        StockNote(price.stock)
        VariantPicker(view.variants, style) {
            variantId = it
            chosen = emptyMap()
            quantity = 1
        }
        for (group in groups) {
            OptionPicker(group, chosen[group.id]) { chosen = chosen + (group.id to it) }
        }
        QuantityStepper(quantity, price.stock?.coerceIn(1, 99) ?: 99) { quantity = it }
    }
}

/** The parts on their own, laid out the way an app of its own might. A tall screen keeps every part on it to tap. */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h2000dp")
class PartsTest {
    @get:Rule val compose = createComposeRule()

    private val product = ProductView.from(
        Json.parseToJsonElement(
            """
            {"id":"p9","name":"Trail Shell","category":{"name":"Jackets"},
             "variants":[{"id":"v1","name":"Onyx","price":120,"stock":0},{"id":"v2","name":"Storm","price":120}],
             "crossVariantTitles":[{"id":"t1","title":"Size","variantId":null}],
             "crossVariants":[{"id":"l","crossVariantTitleId":"t1","value":"L","price":135},
                              {"id":"s","crossVariantTitleId":"t1","value":"S","price":130,"stock":3}]}
            """,
        ).jsonObject,
    )

    @Test
    fun `a product page of your own - style, size, quantity and add to cart`() {
        var added: Triple<String, Map<String, String>?, Int>? = null
        compose.setContent { MaterialTheme { MyProductPage(product) { style, options, quantity -> added = Triple(style, options, quantity) } } }

        // It opens on the style that can be bought; the sold-out one can't be chosen.
        compose.onNodeWithText("Style: Storm").assertExists()
        compose.onNodeWithContentDescription("Onyx, sold out").assertIsNotEnabled()
        compose.onNodeWithText("From \$130.00").assertExists()
        compose.onNodeWithText("Choose options").assertIsNotEnabled()

        compose.onNodeWithText("L").performClick()
        compose.onNodeWithText("\$135.00").assertExists()
        compose.onNodeWithText("Size: L").assertExists()

        compose.onNodeWithText("S").performClick()
        compose.onNodeWithText("\$130.00").assertExists()
        compose.onNodeWithText("Only 3 left").assertExists()

        // Three left: the stepper stops at three.
        compose.onNodeWithContentDescription("One more").performClick()
        compose.onNodeWithContentDescription("One more").performClick()
        compose.onNodeWithContentDescription("Quantity 3").assertExists()
        compose.onNodeWithContentDescription("One more").assertIsNotEnabled()

        compose.onNodeWithText("Add to cart").assertIsEnabled().performClick()
        assertEquals(Triple("v2", mapOf("Size" to "S"), 3), added)
    }

    @Test
    fun `the store, cart and blog parts take plain values and say what was chosen`() {
        val picked = mutableListOf<String?>()
        val quantities = mutableListOf<Int>()
        val opened = mutableListOf<String>()
        var draft by mutableStateOf("")
        var posted = false
        val post = BlogPost(id = "b1", ctaLabel = "Book a fitting", ctaHref = "https://shop.example/fit", tags = listOf("gear", "fit"))
        compose.setContent {
            MaterialTheme {
                Column {
                    CategoryChips(
                        listOf(ProductCategory("c1", "Shoes"), ProductCategory("c2", "Socks")),
                        counts = mapOf("c1" to 2, "c2" to 1),
                        selected = "c2",
                    ) { picked += it }
                    StoreResultsBar(count = 1, loading = false, failed = false, filterCount = 2, sort = "rating-desc") {}
                    CartLine(CartItem("line1", quantity = 1, productName = "Wool Socks", unitPrice = 18.0), "USD", onQuantity = { quantities += it }) {}
                    PostCta(post) { opened += it }
                    PostCta(post.copy(ctaLabel = "Run this", ctaHref = "javascript:alert(1)")) { opened += it }
                    PostTags(post.tags)
                    LikeButton(signedIn = false, liked = false, count = 3, onToggle = {}, onSignIn = {})
                    CommentForm(count = 0, signedIn = true, draft = draft, onDraftChange = { draft = it }, onPost = { posted = true }, onSignIn = {})
                }
            }
        }

        compose.onNodeWithText("Shoes 2").performClick()
        compose.onNodeWithText("Socks 1").performClick()
        assertEquals(listOf("c1", null), picked)
        compose.onNodeWithText("1 product").assertExists()
        compose.onNodeWithText("Filters (2) · Top rated").assertExists()

        // At one, − takes the line out.
        compose.onNodeWithContentDescription("Remove").performClick()
        assertEquals(listOf(0), quantities)

        // Only a web or mail link shows.
        compose.onNodeWithText("Book a fitting").performClick()
        assertEquals(listOf("https://shop.example/fit"), opened)
        assertTrue(compose.onAllNodesWithText("Run this").fetchSemanticsNodes().isEmpty())
        compose.onNodeWithText("#gear  #fit").assertExists()

        compose.onNodeWithText("Sign in to like").assertExists()
        compose.onNodeWithText("3 likes").assertExists()
        compose.onNodeWithText("Post comment").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Add a comment").performTextInput("Size up.")
        compose.onNodeWithText("Post comment").assertIsEnabled().performClick()
        assertTrue(posted)
        assertEquals("Size up.", draft)
    }
}
