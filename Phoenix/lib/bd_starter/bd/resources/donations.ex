defmodule BdStarter.Bd.Resources.Donations do
  @moduledoc """
  One-time and monthly gifts, paid on the org's own Stripe account. Needs a
  key holding `donations:give`.

  `page/1` returns the giving page — presets, which frequencies are offered,
  the minimum, and the tax statement the receipt will carry. `start_checkout/2`
  returns a Stripe Checkout URL under `"url"`; redirect with a 303.

  The gift is recorded, the donor added as a contact and the receipt emailed
  by BusinessDash once Stripe confirms — nothing to call after the redirect.
  """

  alias BdStarter.Bd.Client

  @doc """
  The giving page. Check `"unavailable"` (nil when gifts can be taken) before
  showing a form. Amounts are integer cents.
  """
  def page(client), do: Client.get(client, "donations")

  @doc """
  Start a gift.

  `input` keys: `"amountCents"` (integer, before any covered fee),
  `"frequency"` (`"one_time"` | `"monthly"`), `"donor"`
  (`%{"name" => …, "email" => …}`), and optionally `"coverFees"`,
  `"message"`, `"successUrl"`, `"cancelUrl"`. Return URLs must be on one of
  the org's verified domains; omit both to use the hosted give page.

  Errors with a 409 (`donations_unavailable`) when giving is off or payments
  aren't ready, and a 400 when the amount, frequency or a return URL isn't
  allowed.
  """
  def start_checkout(client, input) when is_map(input),
    do: Client.post(client, "donations/checkout", input)

  @doc """
  What "cover the fees" adds to a gift — the same cents the checkout charges.
  Pass the page's `"coverFee"` map:
  `ceil((amount + fixedCents) * 10000 / (10000 - rateBps)) - amount`.
  """
  def cover_fee_cents(amount_cents, %{"rateBps" => rate, "fixedCents" => fixed})
      when is_integer(amount_cents) and amount_cents > 0 and rate < 10_000 do
    gross = Float.ceil((amount_cents + fixed) * 10_000 / (10_000 - rate)) |> trunc()
    gross - amount_cents
  end

  def cover_fee_cents(_amount_cents, _cover_fee), do: 0
end
