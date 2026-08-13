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

  defp headers(token, nil), do: [{"x-biab-session-token", token}]

  defp headers(token, org_id),
    do: [{"x-biab-session-token", token}, {"x-biab-customer-portal-org", org_id}]

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
