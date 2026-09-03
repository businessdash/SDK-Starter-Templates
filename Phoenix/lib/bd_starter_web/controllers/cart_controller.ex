defmodule BdStarterWeb.CartController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Resources.Cart

  @doc """
  The visitor token lives in an httpOnly cookie on this domain; the cart lives
  at BD. Nothing about the cart is in the session or a database, which is
  why this works unchanged behind a load balancer with no sticky sessions.
  """
  def show(conn, _params) do
    cart = conn |> visitor_token() |> then(&if(&1, do: Bd.cart(&1)))
    render(conn, :show, cart: cart)
  end

  def add_item(conn, params) do
    {conn, token} = ensure_visitor_token(conn)

    Bd.cart_add(token, %{
      productId: Map.get(params, "productId"),
      quantity: params |> Map.get("quantity", "1") |> to_int(1)
    })

    redirect(conn, to: ~p"/cart")
  end

  def update_item(conn, %{"item_id" => item_id} = params) do
    with token when is_binary(token) <- visitor_token(conn) do
      Bd.cart_update(token, item_id, %{quantity: params |> Map.get("quantity", "1") |> to_int(0)})
    end

    redirect(conn, to: ~p"/cart")
  end

  def remove_item(conn, %{"item_id" => item_id}) do
    with token when is_binary(token) <- visitor_token(conn), do: Bd.cart_remove(token, item_id)
    redirect(conn, to: ~p"/cart")
  end

  def apply_coupon(conn, params) do
    code = Map.get(params, "code", "")

    conn =
      with token when is_binary(token) <- visitor_token(conn),
           nil <- Bd.cart_coupon(token, code) do
        put_flash(conn, :error, "That code did not apply.")
      else
        _ -> conn
      end

    redirect(conn, to: ~p"/cart")
  end

  def remove_coupon(conn, _params) do
    with token when is_binary(token) <- visitor_token(conn) do
      case Bd.client() do
        nil -> :ok
        client -> Cart.remove_coupon(client, token)
      end
    end

    redirect(conn, to: ~p"/cart")
  end

  def clear(conn, _params) do
    with token when is_binary(token) <- visitor_token(conn), do: Bd.cart_clear(token)
    redirect(conn, to: ~p"/cart")
  end

  @doc """
  Hand off to Stripe. The URL comes back as **`stripeUrl`**, not `url`.

  `redirect(external:)` issues a 302; for a POST the safer status is 303 so
  the browser re-issues as GET, which is what `put_status(:see_other)` here
  guarantees.
  """
  def checkout(conn, _params) do
    result =
      with token when is_binary(token) <- visitor_token(conn) do
        Bd.checkout_start(token, %{
          # Stripe substitutes the real id for the placeholder on success.
          successUrl: url(~p"/store") <> "?session_id={CHECKOUT_SESSION_ID}",
          cancelUrl: url(~p"/cart")
        })
      end

    case result do
      %{"stripeUrl" => stripe_url} ->
        conn |> put_status(:see_other) |> redirect(external: stripe_url)

      _ ->
        conn
        |> put_flash(:error, "Could not start checkout.")
        |> redirect(to: ~p"/cart")
    end
  end

  # ── Visitor token ─────────────────────────────────────────────────────────

  defp visitor_token(conn) do
    conn = fetch_cookies(conn)

    case conn.cookies[cookie_name()] do
      token when is_binary(token) and token != "" -> token
      _ -> nil
    end
  end

  # Mint on first write. There is no round trip to get one — the platform keys
  # the cart on whatever arrives in the header.
  defp ensure_visitor_token(conn) do
    case visitor_token(conn) do
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

  defp cookie_name, do: Application.get_env(:bd_starter, :bd_cart_cookie, "bd_cart_visitor")

  defp to_int(value, default) do
    case Integer.parse(to_string(value)) do
      {n, _} when n >= 0 -> n
      _ -> default
    end
  end
end
