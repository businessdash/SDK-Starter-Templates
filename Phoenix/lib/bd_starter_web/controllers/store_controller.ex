defmodule BdStarterWeb.StoreController do
  @moduledoc """
  The store: the product list with its filters, one product, the wishlist,
  the comparison and the order confirmation.

  The product page, wishlist, compare table and save buttons are custom
  elements (priv/static/shop/shop-elements.js), the same ones every BD
  starter ships. This controller reads the data on the server and the
  template writes it into the element as JSON; the element draws the page in
  the browser.
  """
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarterWeb.CartVisitor

  @sorts [
    {"featured", "Featured"},
    {"newest", "Newest"},
    {"price-asc", "Price: low to high"},
    {"price-desc", "Price: high to low"},
    {"rating-desc", "Top rated"}
  ]

  # Reviews shown at first, and how many more each "Show more" adds.
  @reviews_page 10

  @filter_keys ~w(q category priceMin priceMax rating)

  def sorts, do: @sorts

  @doc """
  The filters live in the URL (?q, ?category, ?priceMin, ?priceMax, ?rating,
  ?sort) and are links, so a filtered list can be shared and the back button
  steps through them.
  """
  def index(conn, params) do
    query =
      params
      |> Map.take(@filter_keys ++ ["sort"])
      |> Enum.filter(fn {_k, v} -> is_binary(v) and String.trim(v) != "" end)
      |> Map.new(fn {k, v} -> {k, String.trim(v)} end)

    rating =
      case Integer.parse(query["rating"] || "") do
        {n, ""} when n in 1..5 -> n
        _ -> nil
      end

    sort = if List.keymember?(@sorts, query["sort"], 0), do: query["sort"], else: "featured"

    filters = %{
      search: query["q"],
      category_id: query["category"],
      min_price_cents: cents(query["priceMin"]),
      max_price_cents: cents(query["priceMax"]),
      min_rating: rating,
      sort: sort
    }

    listing = Bd.product_grid(Map.put(filters, :limit, 48))

    render(conn, :index,
      page_title: "Store",
      store_nav: true,
      main_class: "bd-page",
      cart_count: CartVisitor.item_count(conn),
      configured: Bd.configured?(),
      listing: listing,
      products: (listing && listing["items"]) || [],
      counts:
        Map.new((listing && listing["categoryCounts"]) || [], &{&1["categoryId"], &1["count"]}),
      price_range: listing && listing["priceRange"],
      categories: Bd.store_categories(),
      query: query,
      filters: filters,
      has_filters: Map.take(query, @filter_keys) != %{}
    )
  end

  def show(conn, %{"id" => id} = params) do
    review_limit =
      case Integer.parse(params["reviews"] || "") do
        {n, ""} when n > @reviews_page -> min(n, 100)
        _ -> @reviews_page
      end

    {status, data, unavailable} =
      case Bd.product_lookup(id) do
        {:ok, product} ->
          reviews = Bd.product_review_page(id, review_limit)
          shown = length((reviews && reviews["items"]) || [])

          more =
            if reviews && (reviews["totalCount"] || 0) > shown,
              do: ~p"/store/#{id}?#{[reviews: review_limit + @reviews_page]}" <> "#reviews"

          {200,
           %{
             product: product,
             reviews: reviews,
             addons: Bd.product_addons(id),
             related: Bd.related_products(id, 6),
             moreReviewsHref: more
           }, false}

        {:error, :unavailable} ->
          {200, nil, true}

        {:error, :not_found} ->
          # A 404, so the page isn't indexed; the store bar and a link back still show.
          {if(Bd.configured?(), do: 404, else: 200), nil, false}
      end

    conn
    |> put_status(status)
    |> render(:show,
      page_title: if(data, do: "#{data.product["name"]} — Store", else: "Product — Store"),
      store_nav: true,
      main_class: "bd-page",
      cart_count: CartVisitor.item_count(conn),
      configured: Bd.configured?(),
      unavailable: unavailable,
      data: data
    )
  end

  @doc "Products saved on this device with ♡ Save; `<bd-wishlist>` draws them there."
  def wishlist(conn, _params) do
    render(conn, :wishlist,
      page_title: "Wishlist — Store",
      store_nav: true,
      main_class: "bd-page",
      cart_count: CartVisitor.item_count(conn)
    )
  end

  @doc """
  Up to four products side by side. The products come from ?ids=a,b, so a
  comparison can be shared; opened without ids, `<bd-compare>` moves this
  browser's picks into the URL.
  """
  def compare(conn, params) do
    ids =
      (params["ids"] || "")
      |> to_string()
      |> String.split(",", trim: true)
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.take(4)

    columns =
      Enum.flat_map(ids, fn id ->
        case Bd.product(id) do
          nil ->
            []

          product ->
            reviews = Bd.product_review_page(id, 1)
            count = (reviews && reviews["totalCount"]) || 0

            [
              %{
                product: product,
                rating: if(count > 0, do: %{avg: reviews["avgRating"], count: count})
              }
            ]
        end
      end)

    render(conn, :compare,
      page_title: "Compare — Store",
      store_nav: true,
      main_class: "bd-page",
      cart_count: CartVisitor.item_count(conn),
      compare: %{ids: ids, columns: columns}
    )
  end

  @doc "Back from Stripe: `checkout/{sessionId}` says whether the order is paid."
  def order(conn, params) do
    status =
      case params["session_id"] do
        id when is_binary(id) and id != "" -> Bd.checkout_status(id)
        _ -> nil
      end

    render(conn, :order,
      page_title: "Order — Store",
      store_nav: true,
      main_class: "bd-page",
      cart_count: CartVisitor.item_count(conn),
      paid: status["paymentStatus"] == "paid",
      email: status["customerEmail"]
    )
  end

  defp cents(nil), do: nil

  defp cents(value) do
    case Float.parse(value) do
      {n, ""} when n >= 0 -> round(n * 100)
      _ -> nil
    end
  end
end
