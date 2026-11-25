package app.bdstarter

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.bd.Review
import app.bd.ReviewSummary
import app.bd.Reviews
import app.bd.portal
import kotlinx.coroutines.launch

// The business reviews' parts. ReviewsScreen lays them out; each takes
// plain values, so you can move, restyle, drop or replace any of them. The
// rating strip that opens the reviews from the store is ReviewStrip
// (ShopParts.kt).

/** The average, the count and a bar per star, with a way to write a review. */
@Composable
fun ReviewSummaryCard(summary: ReviewSummary, modifier: Modifier = Modifier) {
    OutlinedCard(modifier.fillMaxWidth().padding(top = 8.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            summary.average?.let { average ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(oneDecimal(average), style = MaterialTheme.typography.displaySmall)
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        StarRating(average, size = 18.sp)
                        Text("${summary.total} ${if (summary.total == 1) "review" else "reviews"}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (summary.histogram.any { it.count > 0 }) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (bar in summary.histogram) {
                        Row(
                            Modifier.clearAndSetSemantics {
                                contentDescription = "${bar.stars} ${if (bar.stars == 1) "star" else "stars"}: ${bar.count}"
                            },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text("${bar.stars} ★", style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(32.dp))
                            LinearProgressIndicator(
                                progress = { bar.share.toFloat() },
                                modifier = Modifier.weight(1f).height(8.dp).clip(RoundedCornerShape(4.dp)),
                                drawStopIndicator = {},
                                gapSize = 0.dp,
                            )
                            Text(
                                "${bar.count}",
                                style = MaterialTheme.typography.bodySmall,
                                textAlign = TextAlign.End,
                                modifier = Modifier.width(28.dp),
                            )
                        }
                    }
                }
            }
            ReviewWriter()
        }
    }
}

/**
 * One review: who, when and where from, Verified, the stars, what they
 * said, their photos, and "Read on Google" when it came from there.
 */
@Composable
fun ReviewCard(review: Review, modifier: Modifier = Modifier) {
    val uri = LocalUriHandler.current
    val platform = Reviews.platformName(review.source)
    val link = Reviews.link(review)
    val avatar = Reviews.safeWebUrl(review.reviewerImageUrl)
    val photos = review.photos.mapNotNull { Reviews.safeWebUrl(it) }
    Column(modifier.padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // A photo that won't load leaves the initial showing.
            Box(
                Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(Reviews.reviewerInitial(review), color = MaterialTheme.colorScheme.onSecondaryContainer)
                if (avatar != null) Photo(avatar, Modifier.size(36.dp).background(Color.Transparent))
            }
            Column(Modifier.weight(1f)) {
                Text(Reviews.reviewerName(review), style = MaterialTheme.typography.titleSmall)
                Text(
                    listOfNotNull(Reviews.date(review.timeCreated), platform).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (review.verified == true) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Icon(Icons.Filled.CheckCircle, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                    Text("Verified", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        StarRating(review.rating)
        review.text?.trim()?.takeIf { it.isNotEmpty() }?.let { Text(it) }
        if (photos.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(photos) { Photo(it, Modifier.size(84.dp).clip(RoundedCornerShape(8.dp)), label = "Photo from the reviewer") }
            }
        }
        if (link != null && platform != null) {
            TextButton(onClick = { runCatching { uri.openUri(link) } }, contentPadding = PaddingValues(0.dp)) { Text("Read on $platform") }
        }
    }
}

/**
 * Write a review: signed out, Sign in to write a review; signed in, the
 * stars, a title and the review, sent to BD as the signed-in customer.
 */
@Composable
fun ReviewWriter() {
    val app = LocalApp.current
    val client = app.client
    val token = app.sessionToken
    val scope = rememberCoroutineScope()
    var open by rememberSaveable { mutableStateOf(false) }
    var rating by rememberSaveable { mutableIntStateOf(0) }
    var title by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var sent by rememberSaveable { mutableStateOf(false) }

    fun send(signedIn: String) {
        client ?: return
        val check = Reviews.check(rating, title, body)
        val review = check.review ?: run {
            problem = check.error
            return
        }
        sending = true
        problem = null
        scope.launch {
            bdCall { client.portal(signedIn).submitReview(review) }
                .onSuccess {
                    sent = true
                    open = false
                }
                .onFailure { problem = bdProblem(it, "Couldn't send your review. Try again.") }
            sending = false
        }
    }

    when {
        sent -> Text(Reviews.SENT, color = Color(0xFF2E7D32))
        token == null || client == null -> OutlinedButton(onClick = { app.showTab(Tab.Account) }) { Text("Sign in to write a review") }
        !open -> Button(onClick = { open = true }) { Text("Write a review") }
        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Your rating", style = MaterialTheme.typography.labelLarge)
            Row {
                for (stars in 1..5) {
                    IconButton(
                        onClick = { rating = stars },
                        // Read as "4 stars, selected"; the glyphs themselves stay silent.
                        modifier = Modifier.semantics {
                            contentDescription = "$stars ${if (stars == 1) "star" else "stars"}"
                            selected = rating == stars
                        },
                    ) {
                        Text(
                            if (stars <= rating) "★" else "☆",
                            fontSize = 26.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clearAndSetSemantics { },
                        )
                    }
                }
            }
            OutlinedTextField(
                value = title,
                onValueChange = { if (it.length <= Reviews.MAX_TITLE_LENGTH) title = it },
                label = { Text("Title (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = body,
                onValueChange = { if (it.length <= Reviews.MAX_LENGTH) body = it },
                label = { Text("Your review") },
                placeholder = { Text("What was it like?") },
                minLines = 3,
                maxLines = 8,
                supportingText = { Text("${body.length} / ${Reviews.MAX_LENGTH}") },
                modifier = Modifier.fillMaxWidth(),
            )
            problem?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { send(token) }, enabled = !sending) { Text(if (sending) "Sending…" else "Send review") }
                TextButton(onClick = { open = false }, enabled = !sending) { Text("Cancel") }
            }
        }
    }
}


/** All, then a chip per platform the reviews came from (Google, Yelp…). */
@Composable
fun ReviewSourceFilter(sources: List<String>, selected: String?, modifier: Modifier = Modifier, onSelect: (String?) -> Unit) {
    Row(
        modifier.horizontalScroll(rememberScrollState()).padding(top = 16.dp, bottom = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text("All") })
        for (name in sources) {
            FilterChip(selected = selected == name, onClick = { onSelect(name) }, label = { Text(Reviews.sourceLabel(name)) })
        }
    }
}
