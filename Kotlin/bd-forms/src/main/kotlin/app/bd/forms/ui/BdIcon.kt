package app.bd.forms.ui

import android.graphics.BitmapFactory
import android.util.Log
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.PathNode
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext

/**
 * One of BD's element icons (the Lucide set), drawn natively.
 *
 * BD serves each icon as a 24×24 stroked SVG made of a handful of
 * primitives; this turns it into an [ImageVector] once and caches it, so it
 * draws like any Material icon and takes [tint].
 */
@Composable
public fun BdIcon(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = 20.dp,
    tint: Color = LocalContentColor.current,
    baseUrl: String = LocalBdIconBaseUrl.current,
) {
    val vector by produceState(BdIconStore.cached(baseUrl, name), name, baseUrl) {
        if (value == null) value = BdIconStore.glyph(baseUrl, name)
    }
    Box(modifier.size(size)) {
        vector?.let { Icon(it, contentDescription = null, tint = tint, modifier = Modifier.size(size)) }
    }
}

/** A built-in glyph (no network), for the renderer's own buttons. */
@Composable
internal fun BdGlyphIcon(vector: ImageVector, tint: Color = LocalContentColor.current, size: Dp = 24.dp) {
    Icon(vector, contentDescription = null, tint = tint, modifier = Modifier.size(size))
}

/** The few icons the renderer draws itself, from Lucide (ISC license). */
internal object BdGlyphs {
    val file: ImageVector by lazy {
        BdSvg.vector("file", """<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>""")
    }
    val image: ImageVector by lazy {
        BdSvg.vector(
            "image",
            """<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>""",
        )
    }
    val card: ImageVector by lazy {
        BdSvg.vector("credit-card", """<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>""")
    }
    val tag: ImageVector by lazy {
        BdSvg.vector(
            "tag",
            """<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>""",
        )
    }
}

/** Just enough SVG for Lucide: circle, ellipse, line, path, polygon, polyline and rect, in a 24×24 box. */
internal object BdSvg {
    private val element = Regex("""<(circle|ellipse|line|path|polygon|polyline|rect)\b([^>]*?)/?>""")
    private val attribute = Regex("""([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"""")
    private val number = Regex("""[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?""")

    fun vector(name: String, svg: String): ImageVector {
        val builder = ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        for (m in element.findAll(svg)) {
            val a = attribute.findAll(m.groupValues[2]).associate { it.groupValues[1] to it.groupValues[2] }
            fun n(k: String): Float = a[k]?.toFloatOrNull() ?: 0f
            val nodes: List<PathNode> = when (m.groupValues[1]) {
                "path" -> runCatching { addPathNodes(a["d"]) }.getOrDefault(emptyList())
                "circle" -> ellipse(n("cx"), n("cy"), n("r"), n("r"))
                "ellipse" -> ellipse(n("cx"), n("cy"), n("rx"), n("ry"))
                "line" -> PathBuilder().moveTo(n("x1"), n("y1")).lineTo(n("x2"), n("y2")).nodes
                "rect" -> {
                    val rx = if (a["rx"] != null) n("rx") else n("ry")
                    val ry = if (a["ry"] != null) n("ry") else rx
                    rect(n("x"), n("y"), n("width"), n("height"), rx, ry)
                }
                "polygon", "polyline" -> {
                    val nums = number.findAll(a["points"].orEmpty()).mapNotNull { it.value.toFloatOrNull() }.toList()
                    val p = PathBuilder()
                    var i = 0
                    while (i + 1 < nums.size) {
                        if (i == 0) p.moveTo(nums[i], nums[i + 1]) else p.lineTo(nums[i], nums[i + 1])
                        i += 2
                    }
                    if (m.groupValues[1] == "polygon") p.close()
                    p.nodes
                }
                else -> emptyList()
            }
            if (nodes.isEmpty()) continue
            val filled = a["fill"] == "currentColor"
            builder.addPath(
                pathData = nodes,
                fill = if (filled) SolidColor(Color.Black) else null,
                stroke = if (filled) null else SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
        return builder.build()
    }

    private fun ellipse(cx: Float, cy: Float, rx: Float, ry: Float): List<PathNode> =
        PathBuilder()
            .moveTo(cx - rx, cy)
            .arcToRelative(rx, ry, 0f, isMoreThanHalf = true, isPositiveArc = false, dx1 = 2 * rx, dy1 = 0f)
            .arcToRelative(rx, ry, 0f, isMoreThanHalf = true, isPositiveArc = false, dx1 = -2 * rx, dy1 = 0f)
            .close()
            .nodes

    private fun rect(x: Float, y: Float, w: Float, h: Float, rxIn: Float, ryIn: Float): List<PathNode> {
        val rx = rxIn.coerceIn(0f, w / 2)
        val ry = ryIn.coerceIn(0f, h / 2)
        val p = PathBuilder()
        if (rx <= 0f || ry <= 0f) return p.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).close().nodes
        return p.moveTo(x + rx, y)
            .lineTo(x + w - rx, y)
            .arcTo(rx, ry, 0f, isMoreThanHalf = false, isPositiveArc = true, x1 = x + w, y1 = y + ry)
            .lineTo(x + w, y + h - ry)
            .arcTo(rx, ry, 0f, isMoreThanHalf = false, isPositiveArc = true, x1 = x + w - rx, y1 = y + h)
            .lineTo(x + rx, y + h)
            .arcTo(rx, ry, 0f, isMoreThanHalf = false, isPositiveArc = true, x1 = x, y1 = y + h - ry)
            .lineTo(x, y + ry)
            .arcTo(rx, ry, 0f, isMoreThanHalf = false, isPositiveArc = true, x1 = x + rx, y1 = y)
            .close()
            .nodes
    }
}

/** Icons by name, fetched once per host and kept for the process. */
internal object BdIconStore {
    private val glyphs = ConcurrentHashMap<String, ImageVector>()
    private val inFlight = ConcurrentHashMap<String, Deferred<ImageVector?>>()
    private val names = ConcurrentHashMap<String, List<String>>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val validName = Regex("^[a-z0-9-]+$")

    fun cached(base: String, name: String): ImageVector? = glyphs["$base|$name"]

    suspend fun glyph(base: String, name: String): ImageVector? {
        if (!validName.matches(name)) return null
        val key = "$base|$name"
        glyphs[key]?.let { return it }
        val job = inFlight.getOrPut(key) {
            scope.async { BdNet.get("$base/api/icons/$name.svg", 256 * 1024)?.decodeToString()?.let { BdSvg.vector(name, it) } }
        }
        val g = job.await()
        inFlight.remove(key, job)
        if (g != null) glyphs[key] = g
        return g
    }

    /** Every icon name BD offers (for an unrestricted icon picker). */
    suspend fun allNames(base: String): List<String> {
        names[base]?.let { return it }
        val list = withContext(Dispatchers.IO) {
            runCatching {
                val body = BdNet.get("$base/api/icons", 2 * 1024 * 1024)?.decodeToString() ?: return@runCatching emptyList()
                val icons = org.json.JSONObject(body).getJSONArray("icons")
                List(icons.length()) { icons.getString(it) }
            }.getOrDefault(emptyList())
        }
        if (list.isNotEmpty()) names[base] = list
        return list
    }
}

internal object BdNet {
    /** A GET of a public resource, or null. Blocking: call on IO. */
    fun get(url: String, maxBytes: Int): ByteArray? = runCatching {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10_000
        c.readTimeout = 15_000
        try {
            if (c.responseCode != 200) {
                Log.w(TAG, "GET $url: HTTP ${c.responseCode}")
                return@runCatching null
            }
            c.inputStream.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buf = ByteArray(16 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    out.write(buf, 0, n)
                    if (out.size() > maxBytes) {
                        Log.w(TAG, "GET $url: larger than $maxBytes bytes")
                        return@runCatching null
                    }
                }
                out.toByteArray()
            }
        } finally {
            c.disconnect()
        }
    }.onFailure { Log.w(TAG, "GET $url failed", it) }.getOrNull()

    private const val TAG = "BdForms"
}

/** Remote images (option pictures, image elements), decoded small and cached. */
internal object BdImageLoader {
    private val cache = object : LruCache<String, ImageBitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 4
    }

    fun cached(url: String): ImageBitmap? = cache.get(url)

    suspend fun load(url: String, maxDim: Int = 1200): ImageBitmap? {
        cache.get(url)?.let { return it }
        val bytes = withContext(Dispatchers.IO) { BdNet.get(url, 15 * 1024 * 1024) } ?: return null
        val bitmap = withContext(Dispatchers.Default) { decode(bytes, maxDim) } ?: return null
        cache.put(url, bitmap)
        return bitmap
    }

    fun decode(bytes: ByteArray, maxDim: Int): ImageBitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxDim) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)?.asImageBitmap()
    }
}

@Composable
internal fun BdRemoteImage(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholderHeight: Dp? = null,
) {
    val bitmap by produceState(BdImageLoader.cached(url), url) {
        if (value == null) value = BdImageLoader.load(url)
    }
    val b = bitmap
    if (b != null) {
        Image(b, contentDescription = contentDescription, modifier = modifier, contentScale = contentScale)
    } else {
        Box(modifier.then(placeholderHeight?.let { Modifier.height(it) } ?: Modifier).background(MaterialTheme.colorScheme.surfaceVariant))
    }
}
