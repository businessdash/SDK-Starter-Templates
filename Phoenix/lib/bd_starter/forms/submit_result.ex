defmodule BdStarter.Forms.SubmitResult do
  @moduledoc """
  How a submit went. A failure's `reason` is one of: client_validation_failed,
  validation_failed, unauthorized, forbidden, plan_required, payment_required,
  service_suspended, rate_limited, not_found, invalid_request, server_error,
  network_error.
  """

  alias BdStarter.Forms.{Json, Messages}

  # issues: [%{"fieldId", "label", "reason", "message"}]
  defstruct ok: false, status: 0, submission_id: nil, dry_run: false, reason: nil, message: "", issues: []

  def success(status \\ 201, submission_id \\ nil, dry_run \\ false),
    do: %__MODULE__{ok: true, status: status, submission_id: submission_id, dry_run: dry_run}

  def failure(status, reason, message, issues \\ []),
    do: %__MODULE__{ok: false, status: status, reason: reason, message: message, issues: issues}

  @doc "Map a Package API error response onto a failure."
  def from_response(status, body) do
    message =
      case Json.str(Json.get(body, "message")) do
        m when m in [nil, ""] -> "Submission failed (#{status})."
        m -> m
      end

    code = Json.str(Json.get(body, "error"))
    gate = Json.str(Json.get(body, "reason"))

    issues =
      for raw <- Json.list(Json.get(body, "issues")) || [] do
        id = Json.str(Json.get(raw, "id")) || Json.str(Json.get(raw, "fieldId")) || ""
        label = Json.str(Json.get(raw, "label")) || if(id == "", do: "field", else: id)
        why = Json.str(Json.get(raw, "reason")) || "type"

        %{
          "fieldId" => id,
          "label" => label,
          "reason" => why,
          "message" => Json.str(Json.get(raw, "message")) || Messages.message(why, label, nil)
        }
      end

    reason =
      cond do
        status == 401 -> "unauthorized"
        status == 403 -> "forbidden"
        status == 402 and gate == "payment_required" -> "payment_required"
        status == 402 and gate == "service_suspended" -> "service_suspended"
        status == 402 -> "plan_required"
        status == 429 -> "rate_limited"
        status == 404 -> "not_found"
        status in [400, 422] -> if code == "validation_failed" or issues != [], do: "validation_failed", else: "invalid_request"
        true -> "server_error"
      end

    failure(status, reason, message, issues)
  end
end
