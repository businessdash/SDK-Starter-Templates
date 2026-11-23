package app.bd.forms.ui

import android.text.format.DateFormat
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.bd.forms.BdDates
import app.bd.forms.BdJson
import app.bd.forms.BdLoadState
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.util.Locale
import kotlinx.coroutines.launch

private const val DAY_MS = 86_400_000L

private val dateFormat: DateTimeFormatter get() = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.getDefault())
private val timeFormat: DateTimeFormatter get() = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(Locale.getDefault())

/** `YYYY-MM-DD` ↔ a calendar date, and `HH:mm` ↔ a time of day. */
internal object BdDateText {
    fun date(ymd: String?): LocalDate? = ymd?.takeIf { it.isNotEmpty() }?.take(10)?.let { BdDates.localDate(it) }

    fun time(hhmm: String?): LocalTime? {
        val parts = hhmm?.split(":") ?: return null
        if (parts.size < 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].take(2).toIntOrNull() ?: return null
        return if (h in 0..23 && m in 0..59) LocalTime.of(h, m) else null
    }

    fun hhmm(t: LocalTime): String = String.format(Locale.ROOT, "%02d:%02d", t.hour, t.minute)
}

/** A date that can be unset: tap to pick in the Material date picker, clear to unset. */
@Composable
internal fun BdDateField(
    value: String?,
    onChange: (String?) -> Unit,
    label: String? = null,
    description: String? = null,
    min: LocalDate? = null,
    isError: Boolean = false,
) {
    val strings = LocalBdFormStrings.current
    var open by remember { mutableStateOf(false) }
    val date = BdDateText.date(value)
    BdPickerField(
        text = date?.format(dateFormat) ?: "",
        placeholder = strings.addDate,
        label = label,
        description = description,
        isError = isError,
        onClick = { open = true },
        trailingIcon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
        onClear = { onChange(null) },
    )
    if (open) BdDateDialog(date, min, onDismiss = { open = false }) { onChange(it.toString()) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BdDateDialog(initial: LocalDate?, min: LocalDate?, onDismiss: () -> Unit, onPick: (LocalDate) -> Unit) {
    val strings = LocalBdFormStrings.current
    val minMs = min?.toEpochDay()?.times(DAY_MS)
    val state = rememberDatePickerState(
        initialSelectedDateMillis = initial?.toEpochDay()?.times(DAY_MS),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = minMs == null || utcTimeMillis >= minMs
            override fun isSelectableYear(year: Int): Boolean = min == null || year >= min.year
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(enabled = state.selectedDateMillis != null, onClick = {
                // The picker's millis are UTC midnight of the chosen day.
                state.selectedDateMillis?.let { onPick(LocalDate.ofEpochDay(Math.floorDiv(it, DAY_MS))) }
                onDismiss()
            }) { Text(strings.done) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
    ) {
        DatePicker(state = state)
    }
}

/** A time of day that can be unset, picked on the Material clock. */
@Composable
internal fun BdTimeField(value: String?, onChange: (String?) -> Unit, label: String? = null, isError: Boolean = false) {
    val strings = LocalBdFormStrings.current
    var open by remember { mutableStateOf(false) }
    val time = BdDateText.time(value)
    BdPickerField(
        text = time?.format(timeFormat) ?: "",
        placeholder = strings.addTime,
        label = label,
        isError = isError,
        onClick = { open = true },
        trailingIcon = null,
        onClear = { onChange(null) },
    )
    if (open) BdTimeDialog(time, onDismiss = { open = false }) { onChange(BdDateText.hhmm(it)) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BdTimeDialog(initial: LocalTime?, onDismiss: () -> Unit, onPick: (LocalTime) -> Unit) {
    val strings = LocalBdFormStrings.current
    val context = LocalContext.current
    val state = rememberTimePickerState(
        initialHour = initial?.hour ?: LocalTime.now().hour,
        initialMinute = initial?.minute ?: 0,
        is24Hour = DateFormat.is24HourFormat(context),
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                onPick(LocalTime.of(state.hour, state.minute))
                onDismiss()
            }) { Text(strings.done) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } },
        text = { TimePicker(state = state) },
    )
}

@Composable
internal fun BdDateControl(ctx: BdFieldContext) {
    BdDateField(
        value = ctx.value?.stringValue,
        onChange = {
            ctx.setText(it ?: "")
            ctx.commit()
        },
        description = ctx.field.label,
        isError = ctx.error != null,
    )
}

@Composable
internal fun BdDateRangeControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val start = BdDateText.date(ctx.value?.get("start")?.stringValue)
    val sameDayOk = ctx.field.dateRangeConfig?.allowSameDay != false
    val minEnd = start?.let { if (sameDayOk) it else it.plusDays(1) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BdDateField(
            value = ctx.value?.get("start")?.stringValue,
            onChange = {
                ctx.setKey("start", BdJson.Str(it ?: ""))
                ctx.commit()
            },
            label = strings.start,
            isError = ctx.error != null,
        )
        BdDateField(
            value = ctx.value?.get("end")?.stringValue,
            onChange = {
                ctx.setKey("end", BdJson.Str(it ?: ""))
                ctx.commit()
            },
            label = strings.end,
            min = minEnd,
            isError = ctx.error != null,
        )
    }
}

@Composable
internal fun BdTimeControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val cfg = ctx.field.timeConfig
    val error = ctx.error != null

    fun write(key: String, v: String?) {
        ctx.setKey(key, BdJson.Str(v ?: ""))
        ctx.commit()
    }

    when (cfg?.mode ?: "simple") {
        "time_block" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BdTimeField(ctx.value?.get("start")?.stringValue, { write("start", it) }, strings.start, error)
            BdTimeField(ctx.value?.get("end")?.stringValue, { write("end", it) }, strings.end, error)
        }
        "appointment" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BdDateField(ctx.value?.get("date")?.stringValue, { write("date", it) }, strings.date, min = LocalDate.now(), isError = error)
            BdTimeField(ctx.value?.get("time")?.stringValue, { write("time", it) }, strings.time, error)
        }
        else -> {
            val step = maxOf(cfg?.stepMinutes ?: 30, 1)
            val twelve = (cfg?.format ?: "12h") != "24h"
            val options = (0 until 24 * 60 step step).map { minutes ->
                val h = minutes / 60
                val m = minutes % 60
                val value = String.format(Locale.ROOT, "%02d:%02d", h, m)
                val label = if (twelve) {
                    String.format(Locale.ROOT, "%d:%02d %s", if (h % 12 == 0) 12 else h % 12, m, if (h < 12) "AM" else "PM")
                } else {
                    value
                }
                BdOption(value, label)
            }
            BdOptionPicker(
                title = ctx.field.label,
                placeholder = ctx.field.placeholder.nonEmpty() ?: strings.selectTime,
                options = options,
                selection = listOfNotNull(ctx.value?.stringValue.nonEmpty()),
                onSelect = {
                    ctx.setText(it.firstOrNull() ?: "")
                    ctx.commit()
                },
                multi = false,
                searchable = false,
                isError = error,
                // Nothing chosen yet: open on the working day, not midnight.
                startAt = "09:00",
            )
        }
    }
}

@Composable
internal fun BdMonthYearControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    var month by remember { mutableStateOf<Int?>(null) }
    var year by remember { mutableStateOf<Int?>(null) }
    val raw = ctx.value?.stringValue
    LaunchedEffect(raw) {
        val parts = raw?.takeIf { it.length == 7 }?.split("-")
        val y = parts?.getOrNull(0)?.toIntOrNull()
        val m = parts?.getOrNull(1)?.toIntOrNull()
        if (y != null && m != null) {
            year = y
            month = m
        }
    }
    val thisYear = LocalDate.now().year
    val minYear = ctx.field.monthYearConfig?.minYear ?: (thisYear - 100)
    val maxYear = maxOf(ctx.field.monthYearConfig?.maxYear ?: (thisYear + 10), minYear)

    fun emit(m: Int?, y: Int?) {
        month = m
        year = y
        ctx.setText(if (m != null && y != null) String.format(Locale.ROOT, "%04d-%02d", y, m) else "")
        ctx.commit()
    }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        BdOptionPicker(
            title = strings.month,
            placeholder = strings.month,
            options = (1..12).map { m ->
                BdOption(m.toString(), java.time.Month.of(m).getDisplayName(TextStyle.FULL, Locale.getDefault()))
            },
            selection = listOfNotNull(month?.toString()),
            onSelect = { emit(it.firstOrNull()?.toIntOrNull(), year) },
            multi = false,
            searchable = false,
            isError = ctx.error != null,
            modifier = Modifier.weight(1.3f),
        )
        BdOptionPicker(
            title = strings.year,
            placeholder = strings.year,
            options = (maxYear downTo minYear).map { BdOption(it.toString(), it.toString()) },
            selection = listOfNotNull(year?.toString()),
            onSelect = { emit(month, it.firstOrNull()?.toIntOrNull()) },
            multi = false,
            searchable = false,
            isError = ctx.error != null,
            modifier = Modifier.weight(1f),
        )
    }
}

// Schedule

/** Availability: "as soon as possible", preferred days and times, notes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BdAvailabilityControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val cfg = ctx.field.scheduleConfig
    val v = ctx.value
    val days = cfg?.days?.takeIf { it.isNotEmpty() } ?: listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    val windows = cfg?.timeWindows?.takeIf { it.isNotEmpty() }
        ?: if (cfg?.granularTimes == true) {
            listOf("morning_8_10", "morning_10_12", "afternoon_12_2", "afternoon_2_4", "evening_4_6", "evening_6_8")
        } else {
            listOf("morning", "afternoon", "evening")
        }

    fun toggle(key: String, item: String) {
        val cur = v?.get(key)?.stringArray.orEmpty()
        ctx.setKey(key, BdJson.Arr((if (item in cur) cur - item else cur + item).map { BdJson.Str(it) }))
        ctx.commit()
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (cfg?.allowAsap != false) {
            val on = v?.get("asap") == BdJson.Bool(true)
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).toggleable(on, role = Role.Switch) {
                    ctx.setKey("asap", BdJson.Bool(it))
                    ctx.commit()
                },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(strings.asap, modifier = Modifier.weight(1f))
                Switch(checked = on, onCheckedChange = null)
            }
        }
        BdChipGroup(strings.preferredDays, days, v?.get("days")?.stringArray.orEmpty(), { strings.dayNames[it] ?: it }) { toggle("days", it) }
        BdChipGroup(strings.preferredTimes, windows, v?.get("times")?.stringArray.orEmpty(), { strings.timeWindowNames[it] ?: it }) { toggle("times", it) }
        if (cfg?.allowNotes != false) {
            BdTextInput(
                value = v?.get("notes")?.stringValue ?: "",
                onValueChange = { ctx.setKey("notes", BdJson.Str(it)) },
                placeholder = strings.schedulingNotes,
                singleLine = false,
                minLines = 2,
                maxLines = 5,
                onCommit = ctx::commit,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BdChipGroup(title: String, items: List<String>, picked: List<String>, name: (String) -> String, onToggle: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (item in items) {
                val on = item in picked
                FilterChip(
                    selected = on,
                    onClick = { onToggle(item) },
                    label = { Text(name(item)) },
                    leadingIcon = if (on) ({ Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }) else null,
                )
            }
        }
    }
}

/** Live booking: open slots from BD, grouped by day. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun BdBookingControl(ctx: BdFieldContext) {
    val strings = LocalBdFormStrings.current
    val controller = ctx.controller
    val scope = rememberCoroutineScope()
    LaunchedEffect(ctx.field.id) { controller.loadScheduleSlots(ctx.field.id) }

    when (val state = LocalBdFormState.current.scheduleSlots[ctx.field.id]) {
        is BdLoadState.Loaded -> {
            val zone = ZoneId.systemDefault()
            val slots = state.value.mapNotNull { raw -> BdDates.parseInstant(raw)?.let { raw to Instant.ofEpochMilli(it).atZone(zone) } }
            if (slots.isEmpty()) {
                Text(strings.noOpenTimes, color = MaterialTheme.colorScheme.onSurfaceVariant)
                return
            }
            val byDay = slots.groupBy { it.second.toLocalDate() }
            val days = byDay.keys.sorted()
            val selectedStart = ctx.value?.get("slotStartAt")?.stringValue
            val selectedDay = slots.firstOrNull { it.first == selectedStart }?.second?.toLocalDate()
            var day by remember { mutableStateOf<LocalDate?>(null) }
            val current = day ?: selectedDay ?: days.first()
            val colors = MaterialTheme.colorScheme
            val corner = LocalBdFormStyle.current.cornerRadius

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (d in days) {
                        val on = d == current
                        Surface(
                            shape = RoundedCornerShape(corner),
                            color = if (on) colors.primary else colors.surfaceContainerHighest,
                            contentColor = if (on) colors.onPrimary else colors.onSurface,
                            modifier = Modifier
                                .size(width = 56.dp, height = 68.dp)
                                .clip(RoundedCornerShape(corner))
                                .clickable(role = Role.RadioButton) { day = d }
                                .semantics {
                                    contentDescription = d.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(Locale.getDefault()))
                                    selected = on
                                },
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Text(d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()), style = MaterialTheme.typography.labelSmall)
                                Text(d.dayOfMonth.toString(), style = MaterialTheme.typography.titleMedium)
                                Text(d.month.getDisplayName(TextStyle.SHORT, Locale.getDefault()), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for ((raw, at) in byDay[current].orEmpty()) {
                        val on = raw == selectedStart
                        FilterChip(
                            selected = on,
                            onClick = {
                                ctx.set(BdJson.obj("slotStartAt" to BdJson.Str(raw), "timezone" to BdJson.Str(zone.id)))
                                ctx.commit()
                            },
                            label = { Text(at.toLocalTime().format(timeFormat)) },
                            leadingIcon = if (on) ({ Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(FilterChipDefaults.IconSize)) }) else null,
                        )
                    }
                }
            }
        }
        is BdLoadState.Failed -> BdRetryRow(state.message) { scope.launch { controller.loadScheduleSlots(ctx.field.id, reload = true) } }
        else -> BdLoadingRow(strings.loadingTimes)
    }
}
