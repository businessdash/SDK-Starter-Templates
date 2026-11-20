import SwiftUI

/// `YYYY-MM-DD` ↔ a local `Date`, and `HH:mm` ↔ a time today.
enum BdDateText {
    static func date(_ ymd: String?) -> Date? {
        guard let ymd, !ymd.isEmpty else { return nil }
        return BdDates.localDate(fromYMD: String(ymd.prefix(10)))
    }

    static func ymd(_ date: Date) -> String { BdDates.ymd(local: date) }

    static func time(_ hhmm: String?) -> Date? {
        guard let hhmm, hhmm.count >= 4 else { return nil }
        let parts = hhmm.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
        return Calendar.current.date(bySettingHour: h, minute: m, second: 0, of: Date())
    }

    static func hhmm(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

/// A date or time that can be unset: "Add date" until chosen, then the
/// native picker with a clear button.
struct BdOptionalDatePicker: View {
    let label: String
    @Binding var date: Date?
    var components: DatePickerComponents = .date
    var range: PartialRangeFrom<Date>?
    var showsLabel = false
    var onCommit: () -> Void = {}

    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        HStack {
            if showsLabel {
                Text(label)
                Spacer(minLength: 0)
            }
            if let current = date {
                Group {
                    if let range {
                        DatePicker(label, selection: Binding(get: { max(current, range.lowerBound) }, set: { date = $0; onCommit() }), in: range, displayedComponents: components)
                    } else {
                        DatePicker(label, selection: Binding(get: { current }, set: { date = $0; onCommit() }), displayedComponents: components)
                    }
                }
                .labelsHidden()
                Button { date = nil; onCommit() } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("\(strings.clear) \(label)")
            } else {
                Button(components == .hourAndMinute ? strings.addTime : strings.addDate) {
                    let base = range.map { max(Date(), $0.lowerBound) } ?? Date()
                    date = components == .hourAndMinute
                        ? Calendar.current.date(bySetting: .minute, value: 0, of: base) ?? base
                        : base
                    onCommit()
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("\(components == .hourAndMinute ? strings.addTime : strings.addDate), \(label)")
            }
            if !showsLabel { Spacer(minLength: 0) }
        }
    }
}

struct BdDateControl: View {
    let ctx: BdFieldContext

    var body: some View {
        BdCard {
            BdOptionalDatePicker(
                label: ctx.field.label,
                date: Binding(
                    get: { BdDateText.date(ctx.value?.stringValue) },
                    set: { ctx.set($0.map { .string(BdDateText.ymd($0)) } ?? .string("")) }
                ),
                onCommit: ctx.commit
            )
        }
    }
}

struct BdDateRangeControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    func part(_ key: String) -> Binding<Date?> {
        Binding(
            get: { BdDateText.date(ctx.value?[key]?.stringValue) },
            set: { new in
                var o = ctx.value?.objectValue ?? [:]
                o[key] = .string(new.map(BdDateText.ymd) ?? "")
                ctx.set(.object(o))
            }
        )
    }

    var body: some View {
        let start = BdDateText.date(ctx.value?["start"]?.stringValue)
        let sameDayOK = ctx.field.dateRangeConfig?.allowSameDay != false
        let minEnd = start.map { sameDayOK ? $0 : Calendar.current.date(byAdding: .day, value: 1, to: $0) ?? $0 }
        BdRows {
            BdOptionalDatePicker(label: strings.start, date: part("start"), showsLabel: true, onCommit: ctx.commit)
            BdOptionalDatePicker(label: strings.end, date: part("end"), range: minEnd.map { $0... }, showsLabel: true, onCommit: ctx.commit)
        }
    }
}

struct BdTimeControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let cfg = ctx.field.timeConfig
        switch cfg?.mode ?? "simple" {
        case "time_block":
            BdRows {
                BdOptionalDatePicker(label: strings.start, date: part("start", time: true), components: .hourAndMinute, showsLabel: true, onCommit: ctx.commit)
                BdOptionalDatePicker(label: strings.end, date: part("end", time: true), components: .hourAndMinute, showsLabel: true, onCommit: ctx.commit)
            }
        case "appointment":
            BdRows {
                BdOptionalDatePicker(label: strings.date, date: part("date", time: false), range: Calendar.current.startOfDay(for: Date())..., showsLabel: true, onCommit: ctx.commit)
                BdOptionalDatePicker(label: strings.time, date: part("time", time: true), components: .hourAndMinute, showsLabel: true, onCommit: ctx.commit)
            }
        default:
            let step = max(cfg?.stepMinutes ?? 30, 1)
            let twelve = (cfg?.format ?? "12h") != "24h"
            let options: [BdOption] = stride(from: 0, to: 24 * 60, by: step).map { minutes in
                let h = minutes / 60, m = minutes % 60
                let value = String(format: "%02d:%02d", h, m)
                let label = twelve ? String(format: "%d:%02d %@", h % 12 == 0 ? 12 : h % 12, m, h < 12 ? "AM" : "PM") : value
                return BdOption(value: value, label: label)
            }
            BdOptionPicker(
                title: ctx.field.label,
                placeholder: ctx.field.placeholder.flatMap { $0.isEmpty ? nil : $0 } ?? strings.selectTime,
                options: options,
                selection: Binding(
                    get: { ctx.value?.stringValue.flatMap { $0.isEmpty ? nil : [$0] } ?? [] },
                    set: { ctx.set(.string($0.first ?? "")); ctx.commit() }
                ),
                multi: false,
                searchable: false
            )
        }
    }

    func part(_ key: String, time: Bool) -> Binding<Date?> {
        Binding(
            get: { time ? BdDateText.time(ctx.value?[key]?.stringValue) : BdDateText.date(ctx.value?[key]?.stringValue) },
            set: { new in
                var o = ctx.value?.objectValue ?? [:]
                o[key] = .string(new.map { time ? BdDateText.hhmm($0) : BdDateText.ymd($0) } ?? "")
                ctx.set(.object(o))
            }
        )
    }
}

struct BdMonthYearControl: View {
    let ctx: BdFieldContext
    @State private var month: Int?
    @State private var year: Int?
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let thisYear = Calendar.current.component(.year, from: Date())
        let minYear = ctx.field.monthYearConfig?.minYear ?? thisYear - 100
        let maxYear = max(ctx.field.monthYearConfig?.maxYear ?? thisYear + 10, minYear)
        let months = Calendar.current.monthSymbols
        HStack(spacing: 12) {
            Picker(strings.month, selection: Binding(get: { month ?? 0 }, set: { month = $0 == 0 ? nil : $0; emit() })) {
                Text(strings.month).tag(0)
                ForEach(1...12, id: \.self) { m in Text(months[safe: m - 1] ?? "\(m)").tag(m) }
            }
            Picker(strings.year, selection: Binding(get: { year ?? 0 }, set: { year = $0 == 0 ? nil : $0; emit() })) {
                Text(strings.year).tag(0)
                ForEach(Array((minYear...maxYear).reversed()), id: \.self) { y in Text(String(y)).tag(y) }
            }
        }
        .pickerStyle(.menu)
        .labelsHidden()
        .onAppear(perform: adopt)
        .onChange(of: ctx.value) { _, _ in adopt() }
    }

    func adopt() {
        guard let s = ctx.value?.stringValue, s.count == 7 else { return }
        let parts = s.split(separator: "-")
        if parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]) {
            year = y
            month = m
        }
    }

    func emit() {
        if let month, let year {
            ctx.set(.string(String(format: "%04d-%02d", year, month)))
        } else {
            ctx.set(.string(""))
        }
        ctx.commit()
    }
}

// MARK: - Schedule

/// Availability: "as soon as possible", preferred days and times, notes.
struct BdAvailabilityControl: View {
    let ctx: BdFieldContext
    @Environment(\.bdFormStrings) private var strings

    var body: some View {
        let cfg = ctx.field.scheduleConfig
        let v = ctx.value?.objectValue ?? [:]
        let days = cfg?.days?.isEmpty == false ? cfg!.days! : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        let windows = cfg?.timeWindows?.isEmpty == false ? cfg!.timeWindows!
            : cfg?.granularTimes == true
            ? ["morning_8_10", "morning_10_12", "afternoon_12_2", "afternoon_2_4", "evening_4_6", "evening_6_8"]
            : ["morning", "afternoon", "evening"]

        func write(_ key: String, _ value: BdJSON) {
            var o = ctx.value?.objectValue ?? [:]
            o[key] = value
            ctx.set(.object(o))
        }
        func toggle(_ key: String, _ item: String) {
            let cur = v[key]?.stringArray ?? []
            write(key, .array((cur.contains(item) ? cur.filter { $0 != item } : cur + [item]).map { .string($0) }))
            ctx.commit()
        }

        return BdCard {
            VStack(alignment: .leading, spacing: 14) {
                if cfg?.allowAsap != false {
                    Toggle(strings.asap, isOn: Binding(get: { v["asap"] == .bool(true) }, set: { write("asap", .bool($0)); ctx.commit() }))
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(strings.preferredDays).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    BdFlowLayout(spacing: 6) {
                        ForEach(days, id: \.self) { d in
                            BdChip(title: strings.dayNames[d] ?? d, selected: v["days"]?.stringArray.contains(d) == true) { toggle("days", d) }
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(strings.preferredTimes).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    BdFlowLayout(spacing: 6) {
                        ForEach(windows, id: \.self) { w in
                            BdChip(title: strings.timeWindowNames[w] ?? w, selected: v["times"]?.stringArray.contains(w) == true) { toggle("times", w) }
                        }
                    }
                }
                if cfg?.allowNotes != false {
                    TextField(
                        strings.schedulingNotes,
                        text: Binding(get: { v["notes"]?.stringValue ?? "" }, set: { write("notes", .string($0)) }),
                        axis: .vertical
                    )
                    .lineLimit(2...5)
                    .padding(10)
                    .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.vertical, 4)
        }
    }
}

/// Live booking: open slots from BD, grouped by day.
struct BdBookingControl: View {
    let ctx: BdFieldContext
    @State private var day: String?
    @Environment(\.bdFormStrings) private var strings
    @Environment(\.bdFormStyle) private var style

    struct Slot: Hashable { let startAt: String; let date: Date }

    var body: some View {
        let state = ctx.controller.scheduleSlots[ctx.field.id]
        BdCard {
            Group {
                switch state {
                case .loaded(let raw):
                    let slots = raw.compactMap { s in BdDates.parseInstant(s).map { Slot(startAt: s, date: $0) } }
                    if slots.isEmpty {
                        Text(strings.noOpenTimes).foregroundStyle(.secondary)
                    } else {
                        picker(slots)
                    }
                case .failed(let message):
                    HStack {
                        Label(message, systemImage: "exclamationmark.triangle").foregroundStyle(style.errorColor)
                        Spacer()
                        Button(strings.retry) { Task { await ctx.controller.loadScheduleSlots(ctx.field.id, reload: true) } }
                            .buttonStyle(.borderless)
                    }
                default:
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(strings.loadingTimes).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .task { await ctx.controller.loadScheduleSlots(ctx.field.id) }
    }

    @ViewBuilder
    func picker(_ slots: [Slot]) -> some View {
        let byDay = Dictionary(grouping: slots) { BdDates.ymd(local: $0.date) }
        let days = byDay.keys.sorted()
        let selectedStart = ctx.value?["slotStartAt"]?.stringValue
        let selectedDay = selectedStart.flatMap { s in slots.first { $0.startAt == s } }.map { BdDates.ymd(local: $0.date) }
        let current = day ?? selectedDay ?? days.first ?? ""
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(days, id: \.self) { d in
                        let date = BdDates.localDate(fromYMD: d) ?? Date()
                        let on = d == current
                        Button { day = d } label: {
                            VStack(spacing: 2) {
                                Text(date, format: .dateTime.weekday(.abbreviated)).font(.caption)
                                Text(date, format: .dateTime.day()).font(.title3.weight(.semibold))
                                Text(date, format: .dateTime.month(.abbreviated)).font(.caption2)
                            }
                            .frame(width: 54, height: 66)
                            .foregroundStyle(on ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
                            .background(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.tertiary), in: RoundedRectangle(cornerRadius: style.cornerRadius))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text(date, format: .dateTime.weekday(.wide).month().day()))
                        .accessibilityAddTraits(on ? [.isSelected] : [])
                    }
                }
            }
            BdFlowLayout(spacing: 6) {
                ForEach(byDay[current] ?? [], id: \.self) { slot in
                    BdChip(
                        title: slot.date.formatted(date: .omitted, time: .shortened),
                        selected: slot.startAt == selectedStart
                    ) {
                        ctx.set(["slotStartAt": .string(slot.startAt), "timezone": .string(TimeZone.current.identifier)])
                        ctx.commit()
                    }
                }
            }
        }
    }
}
