defmodule BdStarterWeb.CartController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Resources.Cart
  alias BdStarterWeb.CartVisitor

  @doc """
  The visitor token lives in an httpOnly cookie on this domain (see
  `BdStarterWeb.CartVisitor`); the cart lives at BD.
  """
  def show(conn, _params) do
    cart = conn |> visitor_token() |> then(&if(&1, do: Bd.cart(&1)))

    render(conn, :show,
      cart: cart,
      store_nav: true,
      cart_count: (cart && cart["itemCount"]) || 0,
      page_title: "Cart"
    )
  end

  @doc """
  Add to cart for the product page's `<bd-product-form>` and `<bd-addon>`:
  JSON in (`productId`, `quantity`, `variantId`, `options`), `%{ok,
  itemCount}` or `%{ok: false, error}` out.
  """
  def add_json(conn, params) do
    product_id = params["productId"]
    variant_id = params["variantId"]

    options =
      case params["options"] do
        %{} = map -> map |> Enum.filter(fn {_k, v} -> is_binary(v) end) |> Map.new()
        _ -> %{}
      end

    cond do
      not Bd.configured?() ->
        reply(conn, 503, %{ok: false, error: "The store isn't connected yet."})

      not is_binary(product_id) or product_id == "" ->
        reply(conn, 400, %{ok: false, error: "Choose a product."})

      true ->
        {conn, token} = CartVisitor.ensure(conn)

        input =
          %{
            productId: product_id,
            quantity: params |> Map.get("quantity", 1) |> to_int(1) |> max(1) |> min(99)
          }
          |> then(
            &if(is_binary(variant_id) and variant_id != "",
              do: Map.put(&1, :variantId, variant_id),
              else: &1
            )
          )
          |> then(&if(options != %{}, do: Map.put(&1, :options, options), else: &1))

        case Bd.cart_add(token, input) do
          %{} = cart -> reply(conn, 200, %{ok: true, itemCount: cart["itemCount"] || 0})
          _ -> reply(conn, 502, %{ok: false, error: "Couldn't add that to your cart. Try again."})
        end
    end
  end

  defp reply(conn, status, body) do
    conn |> put_resp_header("cache-control", "no-store") |> put_status(status) |> json(body)
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
          successUrl: url(~p"/store/order") <> "?session_id={CHECKOUT_SESSION_ID}",
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

  defp visitor_token(conn), do: CartVisitor.token(conn)
  defp ensure_visitor_token(conn), do: CartVisitor.ensure(conn)

  defp to_int(value, default) do
    case Integer.parse(to_string(value)) do
      {n, _} when n >= 0 -> n
      _ -> default
    end
  end
end
