defmodule BdStarter.Bd.Resources.Notifications do
  @moduledoc """
  What a customer wants to hear about, and where.

  ## Preferences are per ORG, not per person

  A customer who buys from three businesses on this platform has three
  independent preference matrices. Muting marketing email from one must not
  mute it from the others — they are separate relationships, and treating them
  as one setting would either leak a decision across companies or force the
  customer to accept the loudest.

  So `org_id` is a real argument on every call here, not an optional pin. Pass
  the org from `Portal.other_orgs/3` to read or write that company's settings.

  ## The matrix is sparse on write

  `update/5` merges: send `%{"marketing" => %{"email" => false}}` and only that
  flips. Send the full matrix to overwrite. The response is the MERGED result,
  which is what should be rendered — echoing the request back would show the
  customer a matrix the server never agreed to.

  ## Destinations are inert until verified

  Adding an email address or phone number does not start sending to it.
  `start_verification/5` sends a link (email, 15-minute TTL) or a 6-digit OTP
  (phone, 5 minutes); `confirm_verification/4` consumes the token. Until then
  the channel stays off — otherwise anyone with a session could point a
  company's notifications at an address they do not control.
  """

  alias BdStarter.Bd.Client

  @doc "The customer's preference matrix for `org_id`, plus the category and channel definitions to render it."
  def get(client, token, org_id \\ nil),
    do: Client.get(client, "customer-portal/notification-preferences", [], headers(token, org_id))

  @doc """
  Merge a sparse preference update into `org_id`'s stored matrix.

  Returns the merged matrix — render that, not the request.
  """
  def update(client, token, org_id, preferences) when is_map(preferences),
    do:
      Client.post(
        client,
        "customer-portal/notification-preferences",
        %{"preferences" => preferences},
        headers(token, org_id)
      )

  @doc """
  Send a verification link or OTP to `destination`.

  `kind` is `"email"` or `"phone"`.
  """
  def start_verification(client, token, org_id, kind, destination)
      when kind in ["email", "phone"],
      do:
        Client.post(
          client,
          "notifications/preferences/verify",
          %{"kind" => kind, "destination" => destination},
          headers(token, org_id)
        )

  @doc """
  Consume the token from the email link or the SMS code.

  Takes only the token: the server already knows which destination it was
  issued for, and accepting a caller-supplied one would let a token minted for
  one address verify another.
  """
  def confirm_verification(client, token, org_id, verification_token),
    do:
      Client.post(
        client,
        "notifications/preferences/verify/confirm",
        %{"token" => verification_token},
        headers(token, org_id)
      )

  defp headers(token, nil), do: [{"x-bd-session-token", token}]

  defp headers(token, org_id),
    do: [{"x-bd-session-token", token}, {"x-bd-customer-portal-org", org_id}]
end
