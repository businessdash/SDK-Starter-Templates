package app.bd

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

// The product page's rules: which photos show for a style, the option groups
// (Size…) that apply to it, what "from $40" means, and what goes on the cart
// line. The web starters' `src/shop/shop.ts`, the Swift kit's `Shop.swift`,
// the Flutter kit's `shop.dart` and this file answer the same way.
//
// Money: product cards carry integer CENTS (`cheapestPriceCents`); variants,
// options and cart lines carry DOLLARS. Each value says which.

/** A style of a product (a colour, a model). */
public data class ProductVariant(
    val id: String,
    val name: String,
    /** **Dollars.** */
    val price: Double?,
    /** Null: not tracked. */
    val stock: Int?,
    val available: Boolean,
)

/** One choice in an option group: "M" in Size. */
public data class OptionValue(
    val id: String,
    val titleId: String,
    val value: String,
    /** **Dollars**, added to the option total. */
    val price: Double,
    val stock: Int?,
    val available: Boolean,
)

public data class OptionGroup(
    val id: String,
    val title: String,
    val values: List<OptionValue>,
)

public data class SpecRow(val label: String, val value: String)

public data class SpecGroup(val name: String, val rows: List<SpecRow>)

/** The price shown for a style and the options chosen so far. */
public data class ProductPrice(
    /** **Dollars**; null when there is nothing to buy. */
    val amount: Double?,
    /** True while options are still being chosen: the lowest it can be. */
    val from: Boolean,
    val stock: Int? = null,
    /** Every option group has a choice and the choice can be bought. */
    val ready: Boolean,
)

private data class OptionTitle(val id: String, val title: String, val variantId: String?)

private data class VariantImage(val variantId: String, val url: String, val order: Double)

private val SIZE_ORDER = listOf("XXS", "2XS", "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "XXL", "3XL", "4XL")
private val SIZE_TITLE = Regex("^sizes?$", RegexOption.IGNORE_CASE)

/** A `storefront/products/{id}` response, shaped for the product page. */
public class ProductView private constructor(
    public val id: String,
    public val name: String,
    public val description: String,
    public val categoryId: String?,
    public val categoryName: String?,
    /** The product's own photos, in order. */
    public val images: List<String>,
    public val variants: List<ProductVariant>,
    private val variantImages: List<VariantImage>,
    private val optionTitles: List<OptionTitle>,
    public val optionValues: List<OptionValue>,
    public val features: List<String>,
    public val specs: List<SpecGroup>,
) {
    /** The style a page opens on: the first one that can be bought. */
    public val defaultVariant: ProductVariant?
        get() = variants.firstOrNull { it.available } ?: variants.firstOrNull()

    /** The photos for a style: its own when it has any, else the product's. */
    public fun gallery(variantId: String): List<String> {
        // sortedBy is stable: photos with the same order keep theirs.
        val own = variantImages.filter { it.variantId == variantId }.sortedBy { it.order }
        return if (own.isNotEmpty()) own.map { it.url } else images
    }

    /** The option groups (Size, Colour…) that apply to a style. Sizes go smallest first. */
    public fun optionGroups(variantId: String): List<OptionGroup> = optionTitles
        .filter { it.variantId == null || it.variantId == variantId }
        .map { title ->
            var values = optionValues.filter { it.titleId == title.id }
            if (SIZE_TITLE.containsMatchIn(title.title)) {
                // Sizes it doesn't know keep their order, after the ones it does.
                values = values.sortedBy { value ->
                    SIZE_ORDER.indexOf(value.value.uppercase()).let { if (it == -1) SIZE_ORDER.size else it }
                }
            }
            OptionGroup(title.id, title.title, values)
        }
        .filter { it.values.isNotEmpty() }

    /**
     * The price for a style and the options chosen so far ([chosen] maps an
     * option group's id to an option value's id).
     */
    public fun price(variantId: String, chosen: Map<String, String>): ProductPrice {
        val variant = variants.lastOrNull { it.id == variantId }
        if (variant == null || !variant.available) return ProductPrice(amount = null, from = false, stock = 0, ready = false)
        val groups = optionGroups(variantId)
        if (groups.isEmpty()) return ProductPrice(variant.price, from = false, stock = variant.stock, ready = true)
        val picks = groups.map { group -> group.values.firstOrNull { it.id == chosen[group.id] } }
        if (picks.any { it == null }) {
            val lowest = groups.sumOf { group -> group.values.filter { it.available }.minOfOrNull { it.price } ?: 0.0 }
            return ProductPrice(lowest, from = true, ready = false)
        }
        val chosenValues = picks.filterNotNull()
        if (chosenValues.any { !it.available }) return ProductPrice(amount = null, from = false, stock = 0, ready = false)
        return ProductPrice(
            amount = chosenValues.sumOf { it.price },
            from = false,
            stock = chosenValues.mapNotNull { it.stock }.minOrNull(),
            ready = true,
        )
    }

    /** The chosen options as the cart line's `options` (`{"Size": "M"}`), or null when none apply. */
    public fun chosenOptions(variantId: String, chosen: Map<String, String>): Map<String, String>? {
        val out = linkedMapOf<String, String>()
        for (group in optionGroups(variantId)) {
            group.values.firstOrNull { it.id == chosen[group.id] }?.let { out[group.title] = it.value }
        }
        return out.ifEmpty { null }
    }

    public companion object {
        /** Read a product response. Missing or odd fields read as empty, never as an error. */
        public fun from(json: JsonObject): ProductView {
            val specs = json["specifications"] as? JsonObject
            val productImages = records(json["productImages"])
                .map { text(it["url"]) to (number(it["order"]) ?: 0.0) }
                .filter { it.first.isNotEmpty() }
                .sortedBy { it.second }
                .map { it.first }
            val images = (json["images"] as? JsonArray)?.map { text(it) }?.filter { it.isNotEmpty() }.orEmpty()
            return ProductView(
                id = text(json["id"]),
                name = text(json["name"]).ifEmpty { "Untitled" },
                description = text(json["description"]),
                categoryId = text(json["categoryId"]).ifEmpty { null },
                categoryName = text((json["category"] as? JsonObject)?.get("name")).ifEmpty { null },
                images = images.ifEmpty { productImages },
                variants = records(json["variants"]).map { variant ->
                    val stock = number(variant["stock"])?.toInt()
                    ProductVariant(
                        id = text(variant["id"]),
                        name = text(variant["name"]).ifEmpty { "Default" },
                        price = number(variant["price"]),
                        stock = stock,
                        available = flag(variant["isLive"]) != false && stock != 0,
                    )
                },
                variantImages = records(json["variantImages"])
                    .map { VariantImage(text(it["variantId"]), text(it["url"]), number(it["order"]) ?: 0.0) }
                    .filter { it.url.isNotEmpty() },
                optionTitles = records(json["crossVariantTitles"]).map {
                    OptionTitle(text(it["id"]), text(it["title"]), text(it["variantId"]).ifEmpty { null })
                },
                optionValues = records(json["crossVariants"]).map { option ->
                    val stock = number(option["stock"])?.toInt()
                    OptionValue(
                        id = text(option["id"]),
                        titleId = text(option["crossVariantTitleId"]),
                        value = text(option["value"]),
                        price = number(option["price"]) ?: 0.0,
                        stock = stock,
                        available = flag(option["isLive"]) != false && stock != 0,
                    )
                },
                features = (specs?.get("features") as? JsonArray)?.map { text(it) }?.filter { it.isNotEmpty() }.orEmpty(),
                specs = records(specs?.get("groups"))
                    .map { group ->
                        SpecGroup(
                            name = text(group["name"]),
                            rows = records(group["rows"])
                                .map { SpecRow(text(it["label"]), text(it["value"])) }
                                .filter { it.label.isNotEmpty() && it.value.isNotEmpty() },
                        )
                    }
                    .filter { it.name.isNotEmpty() && it.rows.isNotEmpty() },
            )
        }
    }
}

private fun text(value: JsonElement?): String =
    (value as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim().orEmpty()

private fun number(value: JsonElement?): Double? =
    (value as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() }

private fun flag(value: JsonElement?): Boolean? =
    (value as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull

private fun records(value: JsonElement?): List<JsonObject> =
    (value as? JsonArray)?.filterIsInstance<JsonObject>().orEmpty()
