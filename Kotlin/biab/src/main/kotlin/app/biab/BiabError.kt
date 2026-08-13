package app.biab

/** Why a BIAB call failed. */
public sealed class BiabException(message: String) : Exception(message) {

    /**
     * True when the org's site is lapsed or suspended, as opposed to a
     * transient blip. Screens that want a specific notice branch on this;
     * everything else falls back to local content.
     */
    public open val isUnavailable: Boolean get() = false
}

/** A non-2xx response. */
public class BiabHttpException(
    public val status: Int,
    public val path: String,
    message: String? = null,
) : BiabException(message ?: "BIAB request to $path failed with status $status.")

/**
 * The org's billing / entitlement gate refused to serve.
 *
 * The platform signals this two ways and the client normalises both: a 402 on
 * writes, and a **200** whose body carries
 * `{ available: false, reason, upgradeUrl, message }` on reads. Reads use a
 * body-only signal so a cached CDN response can't hard-fail a page — which
 * also means a client that only inspects the status code renders a silently
 * empty screen and never notices.
 */
public class BiabAccessRejectedException(
    public val reason: AccessRejectionReason,
    public val upgradeUrl: String?,
    message: String,
) : BiabException(message) {
    override val isUnavailable: Boolean
        get() = reason == AccessRejectionReason.PAYMENT_REQUIRED ||
            reason == AccessRejectionReason.SERVICE_SUSPENDED
}

public class BiabDecodingException(
    public val path: String,
    cause: Throwable,
) : BiabException("Could not decode the BIAB response for $path: ${cause.message}")

public class BiabTransportException(
    cause: Throwable,
) : BiabException("Could not reach BIAB: ${cause.message}")

public enum class AccessRejectionReason {
    PLAN_REQUIRED,
    PAYMENT_REQUIRED,
    SERVICE_SUSPENDED;

    public companion object {
        public fun parse(raw: String): AccessRejectionReason = when (raw) {
            "payment_required" -> PAYMENT_REQUIRED
            "service_suspended" -> SERVICE_SUSPENDED
            else -> PLAN_REQUIRED
        }
    }
}
