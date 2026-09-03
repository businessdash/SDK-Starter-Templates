defmodule BdStarter.Bd.Resources.Checkout do
  @moduledoc """
  Checkout hand-off. `start/3` returns a Stripe Checkout URL under
  **`stripeUrl`** — not `url`, which is the obvious wrong guess.

  Redirect with a 303 so the browser re-issues as GET. No card data crosses
  this process, which is what keeps a Phoenix consumer out of PCI scope.
  """

  alias BdStarter.Bd.Client

  def start(client, token, urls) do
    Client.post(client, "checkout/start", urls, headers(token))
  end

  def get(client, token, session_id) do
    Client.get(client, "checkout/#{URI.encode(session_id, &URI.char_unreserved?/1)}", [], headers(token))
  end

  defp headers(nil), do: []
  defp headers(token), do: [{"x-bd-cart-visitor", token}]
end
