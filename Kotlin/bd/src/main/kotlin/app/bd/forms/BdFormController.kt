package app.bd.forms

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where a value lives: a field id, inside zero or more repeater entries. */
public data class BdFieldPath(val fieldId: String, val entries: List<Entry> = emptyList()) {
    public data class Entry(val repeaterId: String, val index: Int)

    /** `email`, or `kids[1].name` inside a repeater. Errors are keyed by this. */
    val key: String get() = entries.joinToString("") { "${it.repeaterId}[${it.index}]." } + fieldId

    public fun child(id: String): BdFieldPath = BdFieldPath(id, entries)

    /** The entries a field inside this repeater's entry [index] sits in. */
    public fun entry(index: Int): List<Entry> = entries + Entry(fieldId, index)
}

public sealed interface BdLoadState<out T> {
    public data object Idle : BdLoadState<Nothing>
    public data object Loading : BdLoadState<Nothing>
    public data class Loaded<T>(val value: T) : BdLoadState<T>
    public data class Failed(val message: String) : BdLoadState<Nothing>

    public val valueOrNull: T? get() = (this as? Loaded<T>)?.value
}

/** Options sent with every submit. */
public data class BdSubmitOptions(
    val submitterEmail: String? = null,
    val submitterName: String? = null,
    val dryRun: Boolean = false,
    /** Where the submission came from, e.g. `android-app`. */
    val source: String? = "android-app",
    val referrer: String? = null,
    val metadata: Map<String, BdJson>? = null,
)

/** Everything a form UI draws from, as one immutable snapshot. */
public data class BdFormState(
    val phase: Phase = Phase.Idle,
    val schema: BdFormSchema? = null,
    val values: Map<String, BdJson> = emptyMap(),
    /** Field path key → message. */
    val errors: Map<String, String> = emptyMap(),
    val step: Int = 0,
    val movingForward: Boolean = true,
    val isSubmitting: Boolean = false,
    val uploadingCount: Int = 0,
    val result: BdSubmitResult? = null,
    /**
     * Set when the visitor has tried to submit or advance: from then on
     * required errors show as they edit, not just on the next attempt.
     */
    val hasAttempted: Boolean = false,
    /** Bumped each time an attempt surfaces errors, so a view can scroll to the first one. */
    val errorScrollToken: Int = 0,
    val collectionOptions: Map<String, BdLoadState<List<BdCollectionOption>>> = emptyMap(),
    val scheduleSlots: Map<String, BdLoadState<List<String>>> = emptyMap(),
) {
    public sealed interface Phase {
        public data object Idle : Phase
        public data object Loading : Phase
        public data object Ready : Phase
        public data class Failed(val message: String) : Phase
    }
}

/**
 * The headless form: state and behaviour, no UI.
 *
 * The Compose `BdForm` renders one of these, and an app that wants its own UI
 * can drive it directly. It is the native `useForm`: values, errors, steps and
 * submission, with BD's rules applied exactly as the server applies them.
 *
 * ```kotlin
 * val form = BdFormController("contact", backend, scope = viewModelScope)
 * val state by form.state.collectAsState()
 *
 * TextField(form.value("email")?.stringValue ?: "", { form.setValue(BdJson.of(it), "email") })
 * form.error("email")?.let { Text(it) }
 * Button({ scope.launch { form.submit() } }, enabled = !state.isSubmitting) { Text("Send") }
 * ```
 *
 * State lives in [state]; every mutation publishes a new snapshot. Call it
 * from the main thread, as a UI does.
 *
 * @param scope runs background work the controller starts itself (loading a
 *   collection's records for a condition). Pass a lifecycle scope so it is
 *   cancelled with the screen.
 */
public class BdFormController private constructor(
    // Backend first: with a nullable backend this would otherwise erase to
    // the same JVM signature as the public (form, backend, …) constructor.
    public val backend: BdFormsBackend?,
    /** The form's slug. */
    public val form: String,
    public var submitOptions: BdSubmitOptions,
    private val scope: CoroutineScope,
) {
    public constructor(
        form: String,
        backend: BdFormsBackend,
        submitOptions: BdSubmitOptions = BdSubmitOptions(),
        scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
    ) : this(backend as BdFormsBackend?, form, submitOptions, scope)

    /** A form you already have (prefetched, bundled, or built in code). Pass a backend to be able to submit it. */
    public constructor(
        schema: BdFormSchema,
        backend: BdFormsBackend? = null,
        submitOptions: BdSubmitOptions = BdSubmitOptions(),
        scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
    ) : this(backend, schema.slug, submitOptions, scope) {
        adopt(schema)
    }

    private val _state = MutableStateFlow(BdFormState())
    public val state: StateFlow<BdFormState> = _state.asStateFlow()
    private val s: BdFormState get() = _state.value

    public var onSuccess: ((BdSubmitSuccess) -> Unit)? = null
    public var onFailure: ((BdSubmitFailure) -> Unit)? = null

    /**
     * Collect a card for a `credit_card` field. BD creates the Stripe intent on
     * the org's connected account; your handler presents Stripe's own sheet
     * with it and returns the confirmed intent id. Card details never pass
     * through this package or BD.
     */
    public var paymentHandler: (suspend (BdPaymentIntent, BdFormField) -> String)? = null

    /** What a visitor reads for a problem. Replace to localize or reword. */
    public var messages: (reason: String, label: String, field: BdFormField?) -> String = BdFormMessages::message

    private fun message(reason: String, label: String, field: BdFormField?) = messages(reason, label, field)

    private val pendingFiles = ConcurrentHashMap<String, BdPickedFile>()
    private var seed: Map<String, BdJson> = emptyMap()
    private var functionsById: Map<String, BdBusinessFunction> = emptyMap()
    private var userFunctions: Map<String, BdFormula.UserFunction> = emptyMap()
    private var calcFields: List<BdFormField> = emptyList()
    private var fieldIndex: Map<String, BdFormField> = emptyMap()

    /** Fetch the form. Safe to call again (a retry after a failure). */
    public suspend fun load() {
        if (s.phase == BdFormState.Phase.Ready) return
        val backend = backend ?: run {
            _state.update { it.copy(phase = BdFormState.Phase.Failed("No backend to load \"$form\" from.")) }
            return
        }
        _state.update { it.copy(phase = BdFormState.Phase.Loading) }
        try {
            adopt(backend.schema(form))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val message = (e as? BdFormsException)?.message ?: "Couldn't load the form."
            _state.update { it.copy(phase = BdFormState.Phase.Failed(message)) }
        }
    }

    private fun adopt(loaded: BdFormSchema) {
        fieldIndex = BdFormRules.fieldsById(loaded.fields)
        // First definition wins on a duplicate, as on the other platforms.
        functionsById = loaded.businessFunctions.reversed().associateBy { it.id }
        userFunctions = BdFormula.userFunctions(
            loaded.businessFunctions.reversed().associateBy { it.slug.uppercase() },
        )
        calcFields = fieldIndex.values.filter { it.type == "calculation" }
        seed = applyCalcs(BdFormRules.seedInitialData(loaded.fields))
        pendingFiles.clear()
        _state.update {
            it.copy(
                phase = BdFormState.Phase.Ready,
                schema = loaded,
                values = seed,
                errors = emptyMap(),
                step = 0,
                movingForward = true,
                result = null,
                hasAttempted = false,
            )
        }
        // Conditions that compare a collection record's column need the
        // records loaded before they can evaluate.
        for (f in fieldIndex.values) {
            val rule = f.conditionRule ?: continue
            val source = rule.fieldId
            if (rule.matchField != null && source != null) scope.launch { loadCollectionOptions(source) }
        }
    }

    // Schema accessors

    public val phase: BdFormState.Phase get() = s.phase
    public val schema: BdFormSchema? get() = s.schema
    public val values: Map<String, BdJson> get() = s.values
    public val errors: Map<String, String> get() = s.errors
    public val fields: List<BdFormField> get() = s.schema?.fields ?: emptyList()
    public val settings: BdFormSettings get() = s.schema?.settings ?: BdFormSettings()

    public fun field(id: String): BdFormField? = fieldIndex[id]

    public val isConsecutive: Boolean get() = settings.isConsecutive == true

    /**
     * The steps the visitor will walk: one holding everything, or one per
     * visible top-level element. Re-derived as answers change, because a
     * condition can add or remove a page.
     */
    public val steps: List<List<BdFormField>>
        get() = BdFormRules.computeSteps(fields, isConsecutive, resolver(emptyList()))

    public val stepCount: Int get() = maxOf(steps.size, 1)
    public val currentStep: Int get() = s.step.coerceIn(0, stepCount - 1)
    public val visibleFields: List<BdFormField> get() = if (isConsecutive) steps.getOrNull(currentStep) ?: emptyList() else fields
    public val isFirstStep: Boolean get() = currentStep == 0
    public val isLastStep: Boolean get() = currentStep == stepCount - 1
    public val progress: Double get() = (currentStep + 1).toDouble() / stepCount

    public fun stepTitle(index: Int): String {
        val f = steps.getOrNull(index)?.firstOrNull()
        return f?.stepTitle ?: f?.label?.takeIf { it.isNotEmpty() } ?: "Step ${index + 1}"
    }

    public val canAdvance: Boolean get() = problems(steps.getOrNull(currentStep) ?: emptyList()).isEmpty()
    public val canSubmit: Boolean get() = problems(fields).isEmpty()
    public val isSubmitted: Boolean get() = s.result?.isSuccess == true

    /** Anything changed since the form loaded (for an exit confirmation). */
    public val isDirty: Boolean get() = s.values != seed

    // Values

    public fun value(path: BdFieldPath): BdJson? = scopeValues(path.entries)[path.fieldId]

    public fun value(id: String): BdJson? = s.values[id]

    public fun setValue(value: BdJson?, path: BdFieldPath) {
        _state.update { it.copy(values = applyCalcs(write(value, path, it.values))) }
        revalidate(path)
    }

    public fun setValue(value: BdJson?, id: String): Unit = setValue(value, BdFieldPath(id))

    /** The values a field inside these repeater entries sees. */
    public fun scopeValues(entries: List<BdFieldPath.Entry>): Map<String, BdJson> {
        var scope = s.values
        for (e in entries) scope = scope[e.repeaterId]?.arrayValue?.getOrNull(e.index)?.objectValue ?: emptyMap()
        return scope
    }

    private fun applyCalcs(vals: Map<String, BdJson>): Map<String, BdJson> {
        if (calcFields.isEmpty()) return vals
        val next = LinkedHashMap(vals)
        for (f in calcFields) {
            val cfg = f.calculationConfig ?: continue
            val r = BdCalculation.compute(cfg, { next[it] }, functionsById, userFunctions)
            next[f.id] = if (r.ok) r.value ?: BdJson.Null else BdJson.Null
        }
        return next
    }

    // Repeaters

    public fun entries(repeater: BdFieldPath): List<Map<String, BdJson>> {
        val objects = (value(repeater)?.arrayValue ?: emptyList()).map { it.objectValue ?: emptyMap() }
        return objects.ifEmpty { listOf(emptyMap()) }
    }

    public fun addEntry(repeater: BdFieldPath) {
        val f = field(repeater.fieldId) ?: return
        val list = entries(repeater)
        if (list.size >= (f.populatorConfig?.maxInstances ?: 10)) return
        setValue(BdJson.Arr((list + listOf(emptyMap())).map { BdJson.Obj(it) }), repeater)
    }

    public fun removeEntry(index: Int, repeater: BdFieldPath) {
        val list = entries(repeater).toMutableList()
        if (index !in list.indices || list.size <= 1) return
        list.removeAt(index)
        // Errors are keyed by entry index; shifting entries invalidates them.
        val prefix = repeater.key + "["
        _state.update { st -> st.copy(errors = st.errors.filterKeys { !it.startsWith(prefix) }) }
        setValue(BdJson.Arr(list.map { BdJson.Obj(it) }), repeater)
    }

    // Conditions

    /** Resolve the value a condition compares, inside the given entries. */
    public fun resolver(entries: List<BdFieldPath.Entry>): (BdConditionRule) -> BdJson? {
        val scope = if (entries.isEmpty()) {
            BdFormRules.withDerivedFieldValues(fields, BdFormRules.deriveReferenceValues(fields, s.values))
        } else {
            scopeValues(entries)
        }
        return BdFormRules.resolver(scope, matchResolver)
    }

    /** Is this block/page showing right now? */
    public fun isVisible(node: BdFormField, entries: List<BdFieldPath.Entry> = emptyList()): Boolean =
        BdFormRules.isNodeVisible(node, resolver(entries))

    /** Children of a concurrent-reveal group shown so far. */
    public fun revealCount(group: BdFormField, entries: List<BdFieldPath.Entry> = emptyList()): Int {
        val children = group.children ?: emptyList()
        if (group.concurrentReveal != true) return children.size
        return BdFormRules.concurrentRevealCount(children, scopeValues(entries))
    }

    private val matchResolver: BdMatchResolver
        get() {
            val options = s.collectionOptions
            return resolve@{ rule, raw ->
                val column = rule.matchField
                val sourceId = rule.fieldId
                val loaded = sourceId?.let { options[it]?.valueOrNull }
                if (column == null || loaded == null) return@resolve raw
                val index = LinkedHashMap<String, BdCollectionOption>()
                for (o in loaded) index.putIfAbsent(o.value, o)
                fun one(v: BdJson): BdJson {
                    val opt = index[BdJS.string(v)] ?: return v
                    if (column == "__label__") return BdJson.Str(opt.label)
                    return opt.match?.get(column)?.let { BdJson.Str(it) } ?: v
                }
                val arr = raw?.arrayValue
                if (arr != null) BdJson.Str(arr.joinToString(", ") { BdJS.string(one(it)) }) else raw?.let(::one)
            }
        }

    // Validation

    public fun error(path: BdFieldPath): String? = s.errors[path.key]

    public fun error(id: String): String? = s.errors[id]

    /** Required + value problems within these nodes, keyed by path. */
    private fun problems(nodes: List<BdFormField>): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        val values = s.values
        val match = matchResolver
        for (m in BdFormRules.findMissingRequired(nodes, values, match)) {
            out[m.path] = message("required", m.label, field(m.id))
        }
        for (bad in BdFormRules.findInvalidValues(nodes, values, match)) {
            if (bad.path !in out) out[bad.path] = message(bad.reason, bad.label, field(bad.id))
        }
        return out
    }

    /**
     * Check one field now (call on blur). Shows a format problem right away;
     * a missing answer only once the visitor has tried to move on.
     */
    public fun validate(path: BdFieldPath) {
        val f = field(path.fieldId) ?: return
        val value = scopeValues(path.entries)[path.fieldId]
        val reason = if (BdFormRules.isPendingUpload(value)) null else BdFormRules.validateValue(f, value) ?: BdFormRules.clientOnlyRule(f, value)
        val problem = when {
            reason != null -> message(reason, f.label, f)
            s.hasAttempted && (f.required || f.mustBeTrue == true) &&
                f.type !in BdFieldType.staticOrLayout && BdFormRules.isEmpty(f, value) -> message("required", f.label, f)
            else -> null
        }
        setError(path.key, problem)
    }

    private fun setError(key: String, message: String?) {
        _state.update { st ->
            val next = LinkedHashMap(st.errors)
            if (message == null) next.remove(key) else next[key] = message
            st.copy(errors = next)
        }
    }

    /** After an edit: clear a fixed error, refresh one still wrong, and keep either/or and repeater errors in step. */
    private fun revalidate(path: BdFieldPath) {
        if (path.key in s.errors) validate(path)
        // An either/or or repeater error clears once its requirement is met.
        if (!s.hasAttempted) return
        val current = problems(fields)
        val stale = s.errors.keys.filter { key ->
            if (key in current) return@filter false
            val f = field(key.substringAfterLast('.'))
            f != null && (f.type == "or_condition" || f.type == "multi_populator")
        }
        if (stale.isNotEmpty()) _state.update { st -> st.copy(errors = st.errors - stale.toSet()) }
    }

    /** Check the whole form and show every problem. Returns true when clean. */
    public fun validateAll(): Boolean {
        _state.update { it.copy(hasAttempted = true) }
        val found = problems(fields)
        _state.update { it.copy(errors = found, errorScrollToken = it.errorScrollToken + if (found.isEmpty()) 0 else 1) }
        return found.isEmpty()
    }

    // Navigation

    /** Advance if the current step is complete; otherwise show what's missing. */
    public fun next(): Boolean {
        val all = steps
        val index = currentStep
        if (index >= all.size - 1) return false
        _state.update { it.copy(hasAttempted = true) }
        val found = problems(all[index])
        if (found.isNotEmpty()) {
            _state.update { it.copy(errors = found, errorScrollToken = it.errorScrollToken + 1) }
            return false
        }
        _state.update { it.copy(errors = emptyMap(), movingForward = true, step = index + 1) }
        return true
    }

    public fun back() {
        val index = currentStep
        if (index <= 0) return
        _state.update { it.copy(movingForward = false, step = index - 1, errors = emptyMap()) }
    }

    public fun goToStep(index: Int) {
        val target = index.coerceIn(0, stepCount - 1)
        val from = currentStep
        _state.update { it.copy(movingForward = target >= from, step = target) }
    }

    // Files

    /** Add picked files to a `file_upload` field. Files the field doesn't accept are refused with a message; the rest upload on submit. */
    public fun addFiles(files: List<BdPickedFile>, path: BdFieldPath) {
        val f = field(path.fieldId) ?: return
        val list = (value(path)?.arrayValue ?: emptyList()).toMutableList()
        val maxFiles = f.fileConfig?.maxFiles ?: 1
        var problem: String? = null
        for (file in files) {
            if (list.size >= maxFiles) {
                problem = message("max", f.label, f)
                break
            }
            val p = BdFormRules.fileProblem(file.name, file.mimeType, file.size, f.fileConfig?.allowedTypes, f.fileConfig?.maxSize)
            if (p != null) {
                problem = p
                continue
            }
            list.add(placeholder(file, f.id))
        }
        setValue(BdJson.Arr(list), path)
        if (problem != null) setError(path.key, problem)
    }

    public fun removeFile(index: Int, path: BdFieldPath) {
        val list = (value(path)?.arrayValue ?: emptyList()).toMutableList()
        if (index !in list.indices) return
        list[index]["localId"]?.stringValue?.let { pendingFiles.remove(it) }
        list.removeAt(index)
        setValue(BdJson.Arr(list), path)
    }

    /** Set an `image_input` from a picked image; it uploads on submit. */
    public fun setImage(file: BdPickedFile, path: BdFieldPath) {
        val f = field(path.fieldId) ?: return
        val cfg = f.imageInputConfig
        val p = BdFormRules.fileProblem(file.name, file.mimeType, file.size, cfg?.allowedTypes ?: listOf("image/*"), cfg?.maxSize ?: 5.0)
        if (p != null) {
            setError(path.key, p)
            return
        }
        setValue(placeholder(file, f.id), path)
    }

    /** The bytes behind a pending placeholder, for a preview. */
    public fun pendingFile(value: BdJson?): BdPickedFile? = value?.get("localId")?.stringValue?.let { pendingFiles[it] }

    private fun placeholder(file: BdPickedFile, fieldId: String): BdJson {
        val id = UUID.randomUUID().toString()
        pendingFiles[id] = file
        return BdJson.obj(
            "pending" to BdJson.Bool(true),
            "localId" to BdJson.Str(id),
            "fieldId" to BdJson.Str(fieldId),
            "name" to BdJson.Str(file.name),
            "size" to BdJson.Num(file.size.toDouble()),
            "mimeType" to BdJson.Str(file.mimeType),
        )
    }

    // Remote data

    private fun setOptions(fieldId: String, state: BdLoadState<List<BdCollectionOption>>?) {
        _state.update { st ->
            st.copy(collectionOptions = if (state == null) st.collectionOptions - fieldId else st.collectionOptions + (fieldId to state))
        }
    }

    public suspend fun loadCollectionOptions(fieldId: String) {
        val current = s.collectionOptions[fieldId]
        if (current is BdLoadState.Loaded || current == BdLoadState.Loading) return
        val backend = backend ?: run {
            setOptions(fieldId, BdLoadState.Failed("Options can't load without a backend."))
            return
        }
        setOptions(fieldId, BdLoadState.Loading)
        try {
            setOptions(fieldId, BdLoadState.Loaded(backend.collectionOptions(form, fieldId)))
        } catch (e: CancellationException) {
            setOptions(fieldId, null)
            throw e
        } catch (_: Exception) {
            setOptions(fieldId, BdLoadState.Failed("Couldn't load the options."))
        }
    }

    /** Drop loaded (or failed) options and fetch them again. */
    public suspend fun reloadCollectionOptions(fieldId: String) {
        setOptions(fieldId, null)
        loadCollectionOptions(fieldId)
    }

    private fun setSlots(fieldId: String, state: BdLoadState<List<String>>) {
        _state.update { it.copy(scheduleSlots = it.scheduleSlots + (fieldId to state)) }
    }

    /** Open booking times for an auto-schedule field, three weeks ahead. */
    public suspend fun loadScheduleSlots(fieldId: String, reload: Boolean = false) {
        if (!reload && s.scheduleSlots[fieldId] is BdLoadState.Loaded) return
        val backend = backend ?: run {
            setSlots(fieldId, BdLoadState.Failed("Booking times can't load without a backend."))
            return
        }
        setSlots(fieldId, BdLoadState.Loading)
        val from = System.currentTimeMillis()
        try {
            setSlots(fieldId, BdLoadState.Loaded(backend.scheduleSlots(form, fieldId, from, from + 21L * 86_400_000)))
        } catch (e: CancellationException) {
            setSlots(fieldId, BdLoadState.Idle)
            throw e
        } catch (_: Exception) {
            setSlots(fieldId, BdLoadState.Failed("Couldn't load open times."))
        }
    }

    /** Run the app's payment handler for a `credit_card` field. */
    public suspend fun collectPayment(path: BdFieldPath) {
        val f = field(path.fieldId) ?: return
        val backend = backend
        val handler = paymentHandler
        if (backend == null || handler == null) {
            setError(path.key, "Card entry isn't set up in this app.")
            return
        }
        try {
            val intent = backend.paymentIntent(form, f.id)
            val intentId = handler(intent, f)
            setValue(BdJson.Str(intentId), path)
            setError(path.key, null)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            setError(path.key, e.message?.takeIf { it.isNotBlank() } ?: "The card couldn't be saved.")
        }
    }

    // Submit

    /**
     * Validate everything, upload picked files, and submit. Never throws for
     * a failed submission: every outcome, including a network failure, comes
     * back as a result, and field-level problems land in [errors].
     */
    public suspend fun submit(): BdSubmitResult {
        _state.update { it.copy(hasAttempted = true) }
        val found = problems(fields)
        if (found.isNotEmpty()) {
            return fail(BdSubmitFailure.Reason.ClientValidationFailed, 0, summary(found.size), found)
        }
        // Form-wide file cap across every file field.
        val fileFields = fieldIndex.values.filter { it.type == "file_upload" }
        val total = fileFields.sumOf { s.values[it.id]?.arrayValue?.size ?: 0 }
        if (total > BdFormRules.FORM_WIDE_MAX_FILES) {
            val e = LinkedHashMap<String, String>()
            for (f in fileFields) {
                if (!(s.values[f.id]?.arrayValue?.isEmpty() ?: true)) e[f.id] = "At most ${BdFormRules.FORM_WIDE_MAX_FILES} files in total."
            }
            return fail(
                BdSubmitFailure.Reason.ClientValidationFailed, 0,
                "Please attach at most ${BdFormRules.FORM_WIDE_MAX_FILES} files in total.", e,
            )
        }
        val backend = backend
            ?: return fail(BdSubmitFailure.Reason.NetworkError, 0, "This form has no backend to submit to.", emptyMap())

        _state.update { it.copy(errors = emptyMap(), isSubmitting = true) }
        try {
            // Upload every picked file, swapping placeholders for stored files.
            val uploadErrors = LinkedHashMap<String, String>()
            val uploaded = resolveUploads(s.values, "", backend, uploadErrors)
            _state.update { it.copy(values = uploaded) }
            if (uploadErrors.isNotEmpty()) {
                return fail(BdSubmitFailure.Reason.NetworkError, 0, "Some files couldn't be uploaded. Please try again.", uploadErrors)
            }

            val payload = BdFormRules.toSubmissionPayload(fields, uploaded)
            val opts = submitOptions
            val res = backend.submit(
                form,
                BdSubmission(
                    data = payload,
                    submitterEmail = opts.submitterEmail,
                    submitterName = opts.submitterName,
                    dryRun = if (opts.dryRun) true else null,
                    source = opts.source,
                    referrer = opts.referrer,
                    metadata = opts.metadata,
                ),
            )
            _state.update { it.copy(result = res) }
            when (res) {
                is BdSubmitSuccess -> onSuccess?.invoke(res)
                is BdSubmitFailure -> {
                    _state.update { it.copy(errors = mapIssues(res.issues)) }
                    jumpToFirstError()
                    onFailure?.invoke(res)
                }
            }
            return res
        } finally {
            _state.update { it.copy(isSubmitting = false) }
        }
    }

    private fun summary(count: Int): String = "Please fix the highlighted field${if (count == 1) "" else "s"}."

    private fun fail(reason: BdSubmitFailure.Reason, status: Int, message: String, errors: Map<String, String>): BdSubmitResult {
        val issues = errors.map { (key, msg) ->
            val id = key.substringAfterLast('.')
            BdFormIssue(
                fieldId = id,
                label = field(id)?.label ?: id,
                reason = if (reason == BdSubmitFailure.Reason.ClientValidationFailed) "invalid" else "upload",
                message = msg,
            )
        }
        val failure = BdSubmitFailure(status, reason, message, issues)
        _state.update { it.copy(errors = errors, result = failure) }
        jumpToFirstError()
        onFailure?.invoke(failure)
        return failure
    }

    /** Server issues arrive by field id (or output key); map them onto field errors with readable messages. */
    private fun mapIssues(issues: List<BdFormIssue>): Map<String, String> {
        val keyToId = HashMap<String, String>()
        for (f in fieldIndex.values) f.key?.let { keyToId[it] = f.id }
        val out = LinkedHashMap<String, String>()
        for (issue in issues) {
            if (issue.fieldId.isEmpty()) continue
            val id = if (issue.fieldId in fieldIndex) issue.fieldId else keyToId[issue.fieldId] ?: issue.fieldId
            val f = field(id)
            out[id] = message(issue.reason, f?.label ?: issue.label, f)
        }
        return out
    }

    /** In a stepped form, move to the step holding the first error. */
    private fun jumpToFirstError() {
        _state.update { it.copy(errorScrollToken = it.errorScrollToken + 1) }
        val first = s.errors.keys.firstOrNull()
        if (!isConsecutive || first == null) return
        val rootId = first.substringBefore('[').substringBefore('.')
        val index = steps.indexOfFirst { step -> step.any { rootId in BdFormRules.fieldsById(listOf(it)) } }
        if (index < 0 || index == currentStep) return
        val from = currentStep
        _state.update { it.copy(movingForward = index > from, step = index) }
    }

    private suspend fun resolveUploads(
        scope: Map<String, BdJson>,
        prefix: String,
        backend: BdFormsBackend,
        errors: MutableMap<String, String>,
    ): Map<String, BdJson> {
        val out = LinkedHashMap(scope)
        for ((key, value) in scope) {
            val f = field(key) ?: continue
            when (f.type) {
                "file_upload" -> {
                    val list = value.arrayValue ?: continue
                    if (list.none(BdFormRules::isPendingUpload)) continue
                    val done = ArrayList<BdJson>()
                    for (item in list) {
                        val id = item["localId"]?.stringValue
                        val file = id?.let { pendingFiles[it] }
                        if (!BdFormRules.isPendingUpload(item) || file == null) {
                            done.add(item)
                            continue
                        }
                        done.add(upload(f, file, id, prefix + key, errors)?.json ?: item)
                    }
                    out[key] = BdJson.Arr(done)
                }
                "image_input" -> {
                    val id = value["localId"]?.stringValue
                    val file = id?.let { pendingFiles[it] }
                    if (!BdFormRules.isPendingUpload(value) || file == null) continue
                    upload(f, file, id, prefix + key, errors)?.let { out[key] = BdJson.Str(it.url) }
                }
                "multi_populator" -> {
                    val list = value.arrayValue ?: continue
                    out[key] = BdJson.Arr(
                        list.mapIndexed { i, inst ->
                            val o = inst.objectValue ?: return@mapIndexed inst
                            BdJson.Obj(resolveUploads(o, "$prefix$key[$i].", backend, errors))
                        },
                    )
                }
            }
        }
        return out
    }

    private suspend fun upload(f: BdFormField, file: BdPickedFile, localId: String, errorKey: String, errors: MutableMap<String, String>): BdUploadedFile? {
        val backend = backend ?: return null
        _state.update { it.copy(uploadingCount = it.uploadingCount + 1) }
        return try {
            backend.upload(form, f.id, file).also { pendingFiles.remove(localId) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            errors[errorKey] = (e as? BdFormsException)?.message ?: "Couldn't upload ${file.name}."
            null
        } finally {
            _state.update { it.copy(uploadingCount = it.uploadingCount - 1) }
        }
    }

    /** Back to the first step with the starting values. */
    public fun reset() {
        val schema = s.schema ?: return
        adopt(schema)
    }

    public companion object {
        internal fun write(value: BdJson?, path: BdFieldPath, root: Map<String, BdJson>): Map<String, BdJson> {
            fun go(scope: Map<String, BdJson>, entries: List<BdFieldPath.Entry>): Map<String, BdJson> {
                val next = LinkedHashMap(scope)
                val e = entries.firstOrNull()
                if (e == null) {
                    next[path.fieldId] = value ?: BdJson.Null
                    return next
                }
                val arr = (scope[e.repeaterId]?.arrayValue ?: emptyList()).toMutableList()
                while (arr.size <= e.index) arr.add(BdJson.Obj(emptyMap()))
                arr[e.index] = BdJson.Obj(go(arr[e.index].objectValue ?: emptyMap(), entries.drop(1)))
                next[e.repeaterId] = BdJson.Arr(arr)
                return next
            }
            return go(root, path.entries)
        }
    }
}
