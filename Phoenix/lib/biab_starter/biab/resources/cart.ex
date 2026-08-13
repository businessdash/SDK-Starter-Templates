defmodule BiabStarter.Biab.Resources.Cart do
  @moduledoc """
  Server-side cart. All state lives at BIAB — this app only holds the visitor
  token, in an httpOnly cookie.

  The token is an opaque id WE generate; there is no round trip to mint one.
  The platform keys the cart on whatever arrives in `X-BIAB-Cart-Visitor`.
  (`cart/session` exists but mints a tokenized iframe-embed URL — a different
  feature, and the wrong call here.)

  Because no cart state is held in the session or in this process, the app
  works unchanged behind a load balancer with no sticky sessions.
  """

  alias BiabStarter.Biab.Client

  def get(client, token), do: Client.get(client, "cart", [], headers(token))

  def add_item(client, token, input), do: Client.post(client, "cart/items", input, headers(token))

  def update_item(client, token, item_id, input),
    do: Client.patch(client, "cart/items/#{enc(item_id)}", input, headers(token))

  def remove_item(client, token, item_id),
    do: Client.delete(client, "cart/items/#{enc(item_id)}", headers(token))

  def apply_coupon(client, token, code),
    do: Client.post(client, "cart/coupon", %{code: code}, headers(token))

  def remove_coupon(client, token), do: Client.delete(client, "cart/coupon", headers(token))

  def clear(client, token), do: Client.post(client, "cart/clear", nil, headers(token))

  @doc "A fresh anonymous visitor id. Store it in an httpOnly cookie."
  def new_visitor_token, do: Ecto.UUID.generate()

  defp headers(nil), do: []
  defp headers(token), do: [{"x-biab-cart-visitor", token}]
  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
