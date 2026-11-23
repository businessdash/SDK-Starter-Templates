package app.bd.forms.ui

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.text.format.Formatter
import android.webkit.MimeTypeMap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalIconToggleButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.bd.forms.BdFormRules
import app.bd.forms.BdJS
import app.bd.forms.BdJson
import app.bd.forms.BdPickedFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal object BdFileTypes {
    /** The author's allowed types as MIME types for the document picker. */
    fun mimeTypes(allowed: List<String>?): Array<String> {
        if (allowed.isNullOrEmpty()) return arrayOf("*/*")
        val out = LinkedHashSet<String>()
        for (raw in BdFormRules.expandAllowedTypes(allowed)) {
            val a = raw.trim().lowercase()
            val mime = if (a.startsWith(".")) MimeTypeMap.getSingleton().getMimeTypeFromExtension(a.drop(1)) else a
            if (!mime.isNullOrEmpty()) out += mime
        }
        return if (out.isEmpty()) arrayOf("*/*") else out.toTypedArray()
    }

    fun acceptsImages(allowed: List<String>?): Boolean =
        allowed.isNullOrEmpty() || mimeTypes(allowed).any { it == "*/*" || it.startsWith("image/") }

    /** Reads a picked document or photo. Off the main thread. */
    suspend fun read(context: Context, uri: Uri, fallbackName: String): BdPickedFile? = withContext(Dispatchers.IO) {
        runCatching {
            val resolver = context.contentResolver
            val name = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            } ?: fallbackName
            val mime = resolver.getType(uri)
                ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase())
                ?: "application/octet-stream"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@runCatching null
            BdPickedFile(bytes, name, mime)
        }.getOrNull()
    }
}

// Files

@Composable
internal fun BdFileControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val cfg = ctx.field.fileConfig
    val files = ctx.value?.arrayValue.orEmpty()
    val maxFiles = maxOf(cfg?.maxFiles ?: 1, 1)
    val remaining = maxOf(maxFiles - files.size, 0)

    fun adopt(uris: List<Uri>) {
        if (uris.isEmpty()) return
        scope.launch {
            val picked = uris.take(remaining).mapIndexedNotNull { i, uri -> BdFileTypes.read(context, uri, "File ${files.size + i + 1}") }
            if (picked.isNotEmpty()) ctx.controller.addFiles(picked, ctx.path)
        }
    }

    val documents = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { adopt(it) }
    val document = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> adopt(listOfNotNull(uri)) }
    // The multi-photo picker needs a limit of at least two.
    val photos = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(maxOf(remaining, 2))) { adopt(it) }
    val photo = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> adopt(listOfNotNull(uri)) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        files.forEachIndexed { index, file -> BdFileRow(ctx, file, index) }
        if (remaining > 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = {
                    val types = BdFileTypes.mimeTypes(cfg?.allowedTypes)
                    if (remaining > 1) documents.launch(types) else document.launch(types)
                }) {
                    BdGlyphIcon(BdGlyphs.file, size = 18.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(strings.chooseFiles)
                }
                if (BdFileTypes.acceptsImages(cfg?.allowedTypes)) {
                    OutlinedButton(onClick = {
                        val request = PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        if (remaining > 1) photos.launch(request) else photo.launch(request)
                    }) {
                        BdGlyphIcon(BdGlyphs.image, size = 18.dp)
                        Spacer(Modifier.width(8.dp))
                        Text(strings.choosePhotos)
                    }
                }
            }
        }
    }
}

@Composable
private fun BdFileRow(ctx: BdFieldContext, file: BdJson, index: Int) {
    val strings = LocalBdFormStrings.current
    val context = LocalContext.current
    val pending = BdFormRules.isPendingUpload(file)
    val name = file["name"]?.stringValue ?: "File"
    val size = file["size"]?.doubleValue?.let { Formatter.formatShortFileSize(context, it.toLong()) }
    val local = ctx.controller.pendingFile(file)
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(LocalBdFormStyle.current.cornerRadius)).background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (local != null && local.mimeType.startsWith("image/")) {
            BdLocalImage(local, Modifier.size(40.dp).clip(RoundedCornerShape(6.dp)))
        } else {
            Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                BdGlyphIcon(BdGlyphs.file, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 24.dp)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(name, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val detail = listOfNotNull(size, if (pending) strings.uploadsOnSubmit else null).joinToString(" · ")
            if (detail.isNotEmpty()) {
                Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        IconButton(onClick = { ctx.controller.removeFile(index, ctx.path) }) {
            Icon(Icons.Filled.Close, contentDescription = "${strings.removeFile} $name")
        }
    }
}

// Image

@Composable
internal fun BdImageInputControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val style = LocalBdFormStyle.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val cfg = ctx.field.imageInputConfig
    val sources = cfg?.sources ?: "both"
    var chosen by remember { mutableStateOf("upload") }
    val mode = when (sources) {
        "url" -> "url"
        "upload" -> "upload"
        else -> chosen
    }
    val value = ctx.value
    val pending = if (BdFormRules.isPendingUpload(value)) ctx.controller.pendingFile(value) else null
    val url = value?.stringValue?.let { BdFormRules.safeHttpUrl(it) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                BdFileTypes.read(context, uri, "Photo.jpg")?.let { ctx.controller.setImage(it, ctx.path) }
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (sources == "both") {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                SegmentedButton(selected = mode == "upload", onClick = { chosen = "upload" }, shape = SegmentedButtonDefaults.itemShape(0, 2)) {
                    Text(strings.upload)
                }
                SegmentedButton(selected = mode == "url", onClick = { chosen = "url" }, shape = SegmentedButtonDefaults.itemShape(1, 2)) {
                    Text(strings.pasteURL)
                }
            }
        }
        if (mode == "upload") {
            OutlinedButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                BdGlyphIcon(BdGlyphs.image, size = 18.dp)
                Spacer(Modifier.width(8.dp))
                Text(strings.choosePhotos)
            }
        } else {
            BdTextInput(
                value = if (pending == null) value?.stringValue ?: "" else "",
                onValueChange = ctx::setText,
                placeholder = ctx.field.placeholder.nonEmpty() ?: "https://example.com/image.png",
                keyboard = BdKeyboard.Url,
                isError = ctx.error != null,
                onCommit = ctx::commit,
            )
        }
        if (cfg?.showPreview != false && (pending != null || url != null)) {
            Box(Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(style.cornerRadius))) {
                if (pending != null) {
                    BdLocalImage(pending, Modifier.fillMaxWidth().height(180.dp))
                } else if (url != null) {
                    BdRemoteImage(url, contentDescription = null, modifier = Modifier.fillMaxWidth().height(180.dp))
                }
                IconButton(
                    onClick = { ctx.setText("") },
                    modifier = Modifier.align(Alignment.TopEnd).padding(4.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.5f)),
                ) {
                    Icon(Icons.Filled.Close, contentDescription = strings.clear, tint = Color.White)
                }
            }
        }
        if (pending != null) {
            Text(
                "${pending.name} — ${strings.uploadsOnSubmit.lowercase()}.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// Card

@Composable
internal fun BdCardControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    val pc = ctx.field.paymentConfig
    val deposit = pc?.mode == "deposit"
    val amount = if (deposit) pc?.amountCents?.let { BdJS.toFixed(it / 100.0, 2) + " " + (pc?.currency ?: "usd").uppercase() } else null
    val saved = !ctx.value?.stringValue.isNullOrEmpty()

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BdGlyphIcon(BdGlyphs.card, tint = MaterialTheme.colorScheme.primary, size = 22.dp)
            Text(
                if (deposit) strings.deposit + (amount?.let { " · $it" } ?: "") else strings.cardOnFile,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                modifier = Modifier.weight(1f),
            )
            if (saved) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(18.dp))
                Text(strings.cardSaved, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF2E7D32))
            }
        }
        if (!pc?.description.isNullOrEmpty()) {
            Text(pc?.description.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        OutlinedButton(enabled = !busy, onClick = {
            busy = true
            scope.launch {
                try {
                    ctx.controller.collectPayment(ctx.path)
                } finally {
                    busy = false
                }
            }
        }) {
            if (busy) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
                Spacer(Modifier.width(8.dp))
            }
            Text(pc?.buttonLabel.nonEmpty() ?: strings.addCard)
        }
    }
}

// Rich text

/**
 * Rich text, stored as the HTML BD keeps (`p strong em s ul ol li`).
 *
 * Compose has no rich text editor yet, so formatting is light markup the
 * toolbar writes and the field draws: `**bold**`, `*italic*`, `~~struck~~`,
 * and `• ` / `1. ` lines for lists.
 */
@Composable
internal fun BdRichTextControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val html = ctx.value?.stringValue ?: ""
    var field by remember { mutableStateOf(TextFieldValue(BdRichText.markup(html))) }
    val emitted = remember { arrayOf(html) }
    val wasFocused = remember { booleanArrayOf(false) }
    val markerColor = MaterialTheme.colorScheme.outline
    val highlighter = remember(markerColor) { BdMarkupHighlighter(markerColor) }
    val minHeight = (ctx.field.richTextConfig?.minHeight ?: 140.0).dp

    // Same frame as the composition: see BdTextInput.
    SideEffect {
        if (html != emitted[0]) {
            emitted[0] = html
            val text = BdRichText.markup(html)
            field = TextFieldValue(text, TextRange(text.length))
        }
    }

    fun update(next: TextFieldValue) {
        field = next
        val out = BdRichText.html(next.text)
        if (out != emitted[0]) {
            emitted[0] = out
            ctx.setText(out)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            BdFormatButton("B", strings.bold, FontWeight.Bold) { update(BdRichText.wrap(field, "**")) }
            BdFormatButton("I", strings.italic, italic = true) { update(BdRichText.wrap(field, "*")) }
            BdFormatButton("S", strings.strikethrough, strike = true) { update(BdRichText.wrap(field, "~~")) }
            VerticalDivider(Modifier.height(24.dp).padding(horizontal = 4.dp))
            BdFormatButton("•", strings.bulletList) { update(BdRichText.toggleList(field, ordered = false)) }
            BdFormatButton("1.", strings.numberedList) { update(BdRichText.toggleList(field, ordered = true)) }
        }
        OutlinedTextField(
            value = field,
            onValueChange = { update(it) },
            visualTransformation = highlighter,
            isError = ctx.error != null,
            keyboardActions = KeyboardActions.Default,
            modifier = Modifier.fillMaxWidth().heightIn(min = minHeight).onFocusChanged { s ->
                if (wasFocused[0] && !s.isFocused) ctx.commit()
                wasFocused[0] = s.isFocused
            },
        )
    }
}

@Composable
private fun BdFormatButton(
    label: String,
    description: String,
    weight: FontWeight? = null,
    italic: Boolean = false,
    strike: Boolean = false,
    onClick: () -> Unit,
) {
    FilledTonalIconToggleButton(
        checked = false,
        onCheckedChange = { onClick() },
        modifier = Modifier.size(40.dp).semantics { contentDescription = description },
    ) {
        Text(
            label,
            fontWeight = weight,
            fontStyle = if (italic) androidx.compose.ui.text.font.FontStyle.Italic else null,
            textDecoration = if (strike) androidx.compose.ui.text.style.TextDecoration.LineThrough else null,
        )
    }
}

/** Decodes a picked image off the main thread into a thumbnail. */
@Composable
internal fun BdLocalImage(file: BdPickedFile, modifier: Modifier = Modifier) {
    val bitmap by androidx.compose.runtime.produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, file) {
        value = withContext(Dispatchers.Default) { BdImageLoader.decode(file.data, 600) }
    }
    Box(modifier.background(MaterialTheme.colorScheme.surfaceVariant)) {
        bitmap?.let {
            androidx.compose.foundation.Image(it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
        }
    }
}
