package app.bd.forms

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.util.Locale
import kotlin.math.abs

/**
 * Date parsing with the server's rules (`toUtcLegacyDate`): a bare
 * `YYYY-MM-DD` is midnight UTC, an ISO instant with an offset is that instant,
 * anything else falls back to the looser `Date.parse` shapes.
 *
 * Times are epoch milliseconds, the unit JS `Date` arithmetic works in, so a
 * formula's `DAYS(a, b)` divides the same numbers the server does.
 */
public object BdDates {
    public data class Parts(val year: Int, val month: Int, val day: Int)

    /** A form value as a time: a number is epoch ms, anything else is parsed as text. */
    public fun parse(value: BdJson): Long? = when (value) {
        // `new Date(n)`: TimeClip truncates and refuses past ±8.64e15.
        is BdJson.Num -> if (value.value.isFinite() && abs(value.value) <= 8.64e15) value.value.toLong() else null
        else -> parseInstant(BdJS.string(value))
    }

    private val ymdRe = Regex("(\\d{4})-(\\d{2})-(\\d{2})")
    private val instantRe = Regex(
        "(\\d{4})-(\\d{2})-(\\d{2})[Tt ](\\d{2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,9}))?)?([Zz]|[+-]\\d{2}:?\\d{2})",
    )
    private val localRe = Regex("(\\d{4})-(\\d{2})-(\\d{2})[Tt](\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?")
    private val ymRe = Regex("(\\d{4})-(\\d{2})")
    private val yRe = Regex("(\\d{4})")

    private val fallbackFormats: List<DateTimeFormatter> = listOf("MMMM d, uuuu", "MMM d, uuuu", "uuuu/M/d", "M/d/uuuu")
        .map { DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern(it).toFormatter(Locale.US) }

    public fun parseInstant(raw: String): Long? {
        val s = BdJS.trim(raw)
        ymdRe.matchEntire(s)?.let { m ->
            val (y, mo, d) = m.destructured
            return utcMillis(y.toInt(), mo.toInt(), d.toInt())
        }
        // ISO 8601 with an explicit offset or Z (Temporal.Instant.from).
        instantRe.matchEntire(s)?.let { m ->
            val g = m.groupValues
            val nanos = g[7].takeIf { it.isNotEmpty() }?.padEnd(9, '0')?.toLong() ?: 0L
            val local = lenientDateTime(g[1].toInt(), g[2].toInt(), g[3].toInt(), g[4].toInt(), g[5].toInt(), g[6].toIntOrNull() ?: 0, nanos)
            val zone = g[8]
            val offsetSeconds = if (zone == "Z" || zone == "z") {
                0
            } else {
                val sign = if (zone.startsWith("-")) -1 else 1
                val digits = zone.drop(1).filter { it.isDigit() }
                sign * (digits.take(2).toInt() * 3600 + digits.takeLast(2).toInt() * 60)
            }
            val utc = local.toInstant(ZoneOffset.UTC)
            return utc.minusSeconds(offsetSeconds.toLong()).toEpochMilli()
        }
        // Date.parse fallbacks: a date-time without offset is LOCAL time.
        localRe.matchEntire(s)?.let { m ->
            val g = m.groupValues
            val nanos = g[7].takeIf { it.isNotEmpty() }?.padEnd(3, '0')?.toLong()?.times(1_000_000) ?: 0L
            val local = lenientDateTime(g[1].toInt(), g[2].toInt(), g[3].toInt(), g[4].toInt(), g[5].toInt(), g[6].toIntOrNull() ?: 0, nanos)
            return local.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }
        ymRe.matchEntire(s)?.let { m -> return utcMillis(m.groupValues[1].toInt(), m.groupValues[2].toInt(), 1) }
        yRe.matchEntire(s)?.let { m -> return utcMillis(m.groupValues[1].toInt(), 1, 1) }
        for (f in fallbackFormats) {
            val date = runCatching { LocalDate.parse(s, f) }.getOrNull() ?: continue
            return date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }
        return runCatching { Instant.from(DateTimeFormatter.RFC_1123_DATE_TIME.parse(s)).toEpochMilli() }.getOrNull()
    }

    /** Out-of-range parts roll over (month 13 is next January), as `Date.UTC` does. */
    private fun lenientDate(year: Int, month: Int, day: Int): LocalDate =
        LocalDate.of(year, 1, 1).plusMonths(month - 1L).plusDays(day - 1L)

    private fun lenientDateTime(y: Int, mo: Int, d: Int, h: Int, mi: Int, s: Int, nanos: Long): LocalDateTime =
        lenientDate(y, mo, d).atStartOfDay().plusHours(h.toLong()).plusMinutes(mi.toLong()).plusSeconds(s.toLong()).plusNanos(nanos)

    /** `Date.UTC(year, month - 1, day)`. */
    public fun utcMillis(year: Int, month: Int, day: Int): Long =
        lenientDate(year, month, day).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

    public fun utcParts(ms: Long): Parts {
        val d = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
        return Parts(d.year, d.monthValue, d.dayOfMonth)
    }

    private val isoFormat = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

    /** `Date.toISOString()`: `2024-03-15T10:00:00.000Z`. */
    public fun isoString(ms: Long): String = isoFormat.format(Instant.ofEpochMilli(ms))

    /** `YYYY-MM-DD` in the given zone (UTC by default). */
    public fun ymd(ms: Long, zone: ZoneId = ZoneOffset.UTC): String =
        Instant.ofEpochMilli(ms).atZone(zone).toLocalDate().toString()

    /** A `YYYY-MM-DD` as a calendar date, for date pickers. */
    public fun localDate(ymd: String): LocalDate? =
        ymdRe.matchEntire(ymd)?.let { runCatching { LocalDate.parse(ymd) }.getOrNull() }
}
