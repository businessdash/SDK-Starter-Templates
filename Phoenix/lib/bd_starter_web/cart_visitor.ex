defmodule BdStarterWeb.CartVisitor do
  @moduledoc """
  The visitor's cart token: an httpOnly cookie on this domain, minted on the
  first add. The cart itself lives at BD, keyed on whatever arrives in
  `X-BD-Cart-Visitor`, so nothing about it is in the session or a database,
  which is why this works unchanged behind a load balancer with no sticky
  sessions.
  """

  import Plug.Conn

  alias BdStarter.Bd
  alias BdStarter.Bd.Resources.Cart

  @doc "The token, or nil before the first add."
  def token(conn) do
    conn = fetch_cookies(conn)

    case conn.cookies[cookie_name()] do
      token when is_binary(token) and token != "" -> token
      _ -> nil
    end
  end

  @doc """
  The token, minting one on first write. There is no round trip to get one:
  the platform keys the cart on whatever arrives in the header.
  """
  def ensure(conn) do
    case token(conn) do
      token when is_binary(token) ->
        {conn, token}

      nil ->
        token = Cart.new_visitor_token()

        conn =
          put_resp_cookie(conn, cookie_name(), token,
            http_only: true,
            same_site: "Lax",
            secure: conn.scheme == :https,
            max_age: 60 * 60 * 24 * 30
          )

        {conn, token}
    end
  end

  @doc "The items in this visitor's cart, for the store bar; 0 without a cart."
  def item_count(conn) do
    case token(conn) && Bd.cart(token(conn)) do
      %{"itemCount" => count} when is_integer(count) -> count
      _ -> 0
    end
  end

  defp cookie_name, do: Application.get_env(:bd_starter, :bd_cart_cookie, "bd_cart_visitor")
end
