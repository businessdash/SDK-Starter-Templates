defmodule BiabStarter.Biab.Resources.Portal do
  @moduledoc """
  Customer portal — everything scoped to the signed-in customer's session
  token, which this app reads from its own `biab_session` cookie.

  `org_id` pins the portal to one org. Pass it whenever this site represents a
  single business; leave it nil for a multi-org portal where the customer picks
  (`other_orgs/3`).

  Note the header: portal routes take **`X-BIAB-Session-Token`**, while
  `auth/me` takes a lowercase **`x-biab-session`**. They are not
  interchangeable, and sending the wrong one reads as "not signed in" rather
  than as an error — which is why `Auth` owns its own header and this module
  owns this one.
  """

  alias BiabStarter.Biab.Client

  def context(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/context", [], headers(token, org_id))

  def work(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/work", [], headers(token, org_id))

  def profile(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/profile", [], headers(token, org_id))

  def other_orgs(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/other-orgs", [], headers(token, org_id))

  def job(client, token, org_id, id),
    do: Client.get(client, "customer-portal/jobs/#{enc(id)}", [], headers(token, org_id))

  def job_activity(client, token, org_id, id),
    do: Client.get(client, "customer-portal/jobs/#{enc(id)}/activity", [], headers(token, org_id))

  def quote(client, token, org_id, id),
    do: Client.get(client, "customer-portal/quotes/#{enc(id)}", [], headers(token, org_id))

  def accept_quote(client, token, org_id, id),
    do: Client.post(client, "customer-portal/quotes/#{enc(id)}/accept", nil, headers(token, org_id))

  def reject_quote(client, token, org_id, id),
    do: Client.post(client, "customer-portal/quotes/#{enc(id)}/reject", nil, headers(token, org_id))

  def invoice(client, token, org_id, id),
    do: Client.get(client, "customer-portal/invoices/#{enc(id)}", [], headers(token, org_id))

  def orders(client, token, org_id, limit \\ nil),
    do: Client.get(client, "customer-portal/orders", [limit: limit], headers(token, org_id))

  def payments(client, token, org_id, limit \\ nil),
    do: Client.get(client, "customer-portal/payments", [limit: limit], headers(token, org_id))

  def submit_review(client, token, org_id, input),
    do: Client.post(client, "customer-portal/reviews", input, headers(token, org_id))

  def notification_preferences(client, token, org_id),
    do: Client.get(client, "customer-portal/notification-preferences", [], headers(token, org_id))

  @doc """
  Dispatch status for a job the customer owns.

  Read `dispatchStatus` (job-level) for "is anyone on the way" and
  `assignments[].dispatchStatus` for per-technician detail. They differ on
  purpose: the job is `completed` only once the LAST assignee finishes, so
  aggregating yourself tells a customer the work is done while someone is still
  on site.

  Nothing about the dispatch cascade is exposed — who was offered the job, who
  declined, how many were asked. That is staff-internal.
  """
  def dispatch_status(client, token, org_id \\ nil, id),
    do: Client.get(client, "customer-portal/jobs/#{enc(id)}/eta", [], headers(token, org_id))

  @doc """
  Hand a customer-portal invite link out again.

ROTATES the token — the previous link stops working. That is the point rather
than a side effect: if the reason for resending was "it went to the wrong
address", rotating IS the fix, and reusing the token would leave the wrong
recipient holding a working invitation.

Rate limited to one send a minute per invitation, answering 429 with a retry
hint — resend mails an address the caller chose, so an unbounded one is a
mail-bombing tool. Refuses a revoked invitation (resending would quietly
un-revoke it) and a fully-redeemed one.
  """
  def resend_customer_invite(client, token, org_id \\ nil, invite_id, expires_in_days \\ nil) do
    body = if expires_in_days, do: %{"expiresInDays" => expires_in_days}, else: %{}
    Client.post(client, "customer-invites/#{enc(invite_id)}/resend", body, headers(token, org_id))
  end

  # ── Subscription ──────────────────────────────────────────────────────

  @doc """
  Subscription state plus the org's live offerings.

  Render entitlement from `hasAccess`, never from `status`: a lifetime purchase
  has no period to expire, and a cancelled subscription keeps access until the
  period already paid for ends. `hasAccess` is computed server-side by the same
  function the content gates use, so the portal and the gate cannot disagree.
  """
  def subscription(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/subscription", [], headers(token, org_id))

  @doc """
  Cancel at the end of the paid period.

  Ends the RENEWAL, not the access — the customer keeps everything until
  `accessUntil`. Read that back as "active until <date>", because that is true.
  """
  def cancel_subscription(client, token, org_id \\ nil),
    do:
      Client.post(
        client,
        "customer-portal/subscription/cancel",
        %{"resume" => false},
        headers(token, org_id)
      )

  @doc "Clear a pending cancellation."
  def resume_subscription(client, token, org_id \\ nil),
    do:
      Client.post(
        client,
        "customer-portal/subscription/cancel",
        %{"resume" => true},
        headers(token, org_id)
      )

  @doc """
  What the subscription entitles them to.

  When `entitled` is false these are LOCKED previews, not an empty entitlement
  — show them beside the offer.
  """
  def subscriber_content(client, token, org_id \\ nil, limit \\ nil),
    do:
      Client.get(
        client,
        "customer-portal/subscription/content",
        [limit: limit],
        headers(token, org_id)
      )

  defp headers(token, nil), do: [{"x-biab-session-token", token}]

  defp headers(token, org_id),
    do: [{"x-biab-session-token", token}, {"x-biab-customer-portal-org", org_id}]

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
