defmodule BdStarterWeb.ShopComponents do
  @moduledoc """
  The pieces the store and blog pages share: the store bar, the stars for a
  rating, and an element's data as JSON.
  """
  use Phoenix.Component

  use Phoenix.VerifiedRoutes,
    endpoint: BdStarterWeb.Endpoint,
    router: BdStarterWeb.Router,
    statics: BdStarterWeb.static_paths()

  @doc """
  The bar under the header on every store and plan page: products and plans
  on the left; wishlist, compare and the cart with their counts on the right.

  The cart count comes from the server; after that `<bd-cart-count>` follows
  each `bd:cart-count` event the product page sends when it adds. The
  wishlist and compare lists live in this browser, so the shop elements
  (priv/static/shop/shop-elements.js) fill in their counts there.
  """
  attr :count, :integer, default: 0

  def store_nav(assigns) do
    ~H"""
    <nav aria-label="Store" class="store-nav">
      <div class="store-nav__links">
        <a href={~p"/store"}>Products</a>
        <a href={~p"/subscriptions"}>Plans</a>
      </div>
      <div class="store-nav__links">
        <a href={~p"/store/wishlist"}>Wishlist<bd-saved-count data-list="wishlist"></bd-saved-count></a>
        <a href={~p"/store/compare"}>Compare<bd-saved-count data-list="compare"></bd-saved-count></a>
        <a class="store-nav__cart" href={~p"/cart"}>Cart<bd-cart-count data-count={@count}><span :if={@count > 0} class="store-nav__badge">{@count}</span></bd-cart-count></a>
      </div>
    </nav>
    """
  end

  @doc "Stars for a rating, the same markup the shop elements draw."
  attr :rating, :any, default: 0

  def stars(assigns) do
    assigns = assign(assigns, :rating, to_float(assigns.rating))

    ~H"""
    <span aria-label={"#{:erlang.float_to_binary(@rating, decimals: 1)} out of 5"} class="stars" role="img"><span
        :for={i <- 1..5}
        class={[
          "stars__star",
          @rating >= i && "stars__star--on",
          @rating < i and @rating >= i - 0.5 && "stars__star--half"
        ]}
      >★</span></span>
    """
  end

  @doc """
  Server data for a shop or blog element, as JSON in a script tag inside it.
  `<`, `>` and `&` can only appear inside JSON strings, so writing them as
  \\u escapes changes nothing for the reader and means the JSON can't close
  the tag early.
  """
  attr :value, :any, required: true

  def element_data(assigns) do
    assigns = assign(assigns, :json, json(assigns.value))

    ~H"""
    <script type="application/json"><%= Phoenix.HTML.raw(@json) %></script>
    """
  end

  defp json(value) do
    value
    |> Jason.encode!()
    |> String.replace("<", "\\u003c")
    |> String.replace(">", "\\u003e")
    |> String.replace("&", "\\u0026")
  end

  defp to_float(n) when is_number(n), do: n / 1
  defp to_float(_), do: 0.0
end
