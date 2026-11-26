defmodule BdStarterWeb.StoreComponents do
  @moduledoc """
  The store list's and the cart's parts, one function component each: the
  search, category, price and rating filters, the sort, the product grid
  and its cards; a cart line, the subtotal, the coupon box and Checkout.

  The filters are plain links and forms in the URL, so the list works
  without JavaScript; `query` is the list's filters as they are
  (`StoreController.index/2`).
  """
  use Phoenix.Component

  use Phoenix.VerifiedRoutes,
    endpoint: BdStarterWeb.Endpoint,
    router: BdStarterWeb.Router,
    statics: BdStarterWeb.static_paths()

  import Phoenix.Controller, only: [get_csrf_token: 0]
  import BdStarterWeb.Money
  import BdStarterWeb.ProductComponents, only: [save_buttons: 1]
  import BdStarterWeb.ShopComponents, only: [stars: 1]

  @doc "Search the products (`?q=`); Enter searches."
  attr :query, :map, required: true

  def store_search(assigns) do
    ~H"""
    <search>
      <form action={~p"/store"} method="get">
        <label class="bd-label" for="store-search">Search</label>
        <input
          autocomplete="off"
          class="bd-input"
          id="store-search"
          name="q"
          placeholder="Search products…"
          type="search"
          value={@query["q"]}
        />
        <.kept_fields except={["q"]} query={@query} />
      </form>
    </search>
    """
  end

  @doc "All products, then a link per category with its count; the chosen one is marked."
  attr :categories, :list, default: []
  attr :counts, :map, default: %{}
  attr :selected, :string, default: nil
  attr :query, :map, required: true

  def category_filter(assigns) do
    ~H"""
    <div :if={@categories != []} class="store-facet">
      <p class="store-facet__title">Category</p>
      <ul class="store-facet__list">
        <li>
          <a
            class={["store-facet__item", is_nil(@selected) && "store-facet__item--active"]}
            href={href_with(@query, category: nil)}
          >
            All products
          </a>
        </li>
        <li :for={category <- @categories}>
          <% active = @selected == category["id"] %>
          <a
            class={["store-facet__item store-facet__item--row", active && "store-facet__item--active"]}
            href={href_with(@query, category: if(active, do: nil, else: category["id"]))}
          >
            <span>{category["name"]}</span>
            <span class="store-facet__count">{Map.get(@counts, category["id"], 0)}</span>
          </a>
        </li>
      </ul>
    </div>
    """
  end

  @doc "Lowest and highest price, with Apply (`?priceMin`, `?priceMax`). `range` is the store's price range."
  attr :range, :map, default: nil
  attr :query, :map, required: true

  def price_filter(assigns) do
    ~H"""
    <form action={~p"/store"} class="store-facet" method="get">
      <p class="store-facet__title">Price</p>
      <div class="store-price">
        <input
          aria-label="Lowest price"
          class="bd-input"
          inputmode="decimal"
          name="priceMin"
          placeholder={if @range, do: "$#{floor(@range["minDollars"] || 0)}", else: "Min"}
          value={@query["priceMin"]}
        />
        <span aria-hidden="true" class="store-price__sep">–</span>
        <input
          aria-label="Highest price"
          class="bd-input"
          inputmode="decimal"
          name="priceMax"
          placeholder={if @range, do: "$#{ceil(@range["maxDollars"] || 0)}", else: "Max"}
          value={@query["priceMax"]}
        />
      </div>
      <.kept_fields except={["priceMin", "priceMax"]} query={@query} />
      <button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
    </form>
    """
  end

  @doc "4, 3 or 2 stars & up (`?rating`); choosing the chosen one again clears it."
  attr :selected, :any, default: nil
  attr :query, :map, required: true

  def rating_filter(assigns) do
    ~H"""
    <div class="store-facet">
      <p class="store-facet__title">Rating</p>
      <ul class="store-facet__list">
        <li :for={stars <- [4, 3, 2]}>
          <% active = @selected == stars %>
          <a
            class={["store-facet__item store-facet__rating", active && "store-facet__item--active"]}
            href={href_with(@query, rating: if(active, do: nil, else: stars))}
          >
            <.stars rating={stars} /><span class="store-facet__count">&amp; up</span>
          </a>
        </li>
      </ul>
    </div>
    """
  end

  @doc "Clear all filters."
  def clear_filters(assigns) do
    ~H"""
    <a class="store-clear" href={~p"/store"}>Clear all filters</a>
    """
  end

  @doc "Sort the list (`?sort`); it applies as soon as it changes, or with Sort without JavaScript."
  attr :selected, :string, required: true
  attr :query, :map, required: true

  def sort_select(assigns) do
    ~H"""
    <form action={~p"/store"} class="store-sort" method="get">
      <label for="store-sort">Sort</label>
      <select class="bd-select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
        <option
          :for={{value, label} <- BdStarterWeb.StoreController.sorts()}
          value={value}
          selected={@selected == value}
        >
          {label}
        </option>
      </select>
      <.kept_fields except={["sort"]} query={@query} />
      <noscript><button class="bd-btn bd-btn--ghost" type="submit">Sort</button></noscript>
    </form>
    """
  end

  @doc "The store's other filters, as hidden fields, so a form changes only its own."
  attr :query, :map, required: true
  attr :except, :list, default: []

  def kept_fields(assigns) do
    ~H"""
    <input
      :for={{name, value} <- @query |> Map.drop(@except) |> Enum.sort()}
      type="hidden"
      name={name}
      value={value}
    />
    """
  end

  @doc "The products, three across on wide screens."
  attr :products, :list, required: true

  def product_grid(assigns) do
    ~H"""
    <div class="bd-grid-3">
      <.product_card :for={product <- @products} product={product} />
    </div>
    """
  end

  @doc """
  A product in the list: photo with Best seller / New / Sale badges, name,
  stars, price, Low stock, and ♡ Save and ⇄ Compare. `product` is a card from
  `storefront.listProductsWithMeta`.
  """
  attr :product, :map, required: true

  def product_card(assigns) do
    product = assigns.product

    assigns =
      assign(assigns,
        name: product["name"] || "Untitled",
        price: product["cheapestPriceCents"]
      )

    ~H"""
    <div class="bd-card product-card">
      <a class="product-card__link" href={~p"/store/#{@product["id"]}"}>
        <div class="product-card__media">
          <img
            :if={@product["coverImage"]}
            alt={@name}
            class="product-card__img"
            loading="lazy"
            referrerpolicy="no-referrer"
            src={@product["coverImage"]}
          />
          <div :if={!@product["coverImage"]} class="product-card__noimg">No image</div>
          <div class="product-card__badges">
            <span :if={@product["isBestSeller"]} class="bd-badge">Best seller</span>
            <span :if={@product["isNew"]} class="bd-badge">New</span>
            <span :if={@product["isOnSale"]} class="bd-badge product-card__badge--sale">Sale</span>
          </div>
        </div>
        <div class="product-card__body">
          <h3>{@name}</h3>
          <div :if={(@product["reviewCount"] || 0) > 0} class="product-card__rating">
            <.stars rating={@product["avgRating"] || 0} />
            <span class="product-card__count">({@product["reviewCount"]})</span>
          </div>
          <div class="product-card__price">
            <span class="product-card__amount">
              <%= if @price do %>
                {if @product["hasMultipleVariants"], do: "From "}{cents(@price)}
              <% else %>
                View details
              <% end %>
            </span>
            <span
              :if={@product["isOnSale"] && @product["comparePriceCents"]}
              class="product-card__compare"
            >
              {cents(@product["comparePriceCents"])}
            </span>
          </div>
          <span :if={@product["isLowStock"]} class="product-card__lowstock">Low stock</span>
        </div>
      </a>
      <div class="product-card__save">
        <.save_buttons
          compact
          product={
            %{id: @product["id"], name: @name, image: @product["coverImage"], priceCents: @price}
          }
        />
      </div>
    </div>
    """
  end

  @doc "A line in the cart: name and option, the price each, Update the quantity (0 removes it), and Remove."
  attr :item, :map, required: true

  def cart_line(assigns) do
    ~H"""
    <li>
      <span>
        {@item["productName"]}<span :if={@item["variantTitle"]}> · {@item["variantTitle"]}</span>
        <span class="muted">{amount(@item["unitPrice"])} each</span>
      </span>

      <form method="post" action={~p"/cart/items/#{@item["id"]}"}>
        <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
        <input type="hidden" name="_method" value="patch" />
        <input type="number" name="quantity" value={@item["quantity"] || 1} min="0" />
        <button type="submit">Update</button>
      </form>

      <form method="post" action={~p"/cart/items/#{@item["id"]}"}>
        <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
        <input type="hidden" name="_method" value="delete" />
        <button type="submit">Remove</button>
      </form>
    </li>
    """
  end

  @doc "The subtotal. Cart totals arrive DECIMAL; product prices arrive in integer cents."
  attr :cart, :map, required: true

  def cart_summary(assigns) do
    ~H"""
    <p class="total">Subtotal: {amount(@cart["subtotal"])}</p>
    """
  end

  @doc "A coupon code with Apply."
  def coupon_form(assigns) do
    ~H"""
    <form method="post" action={~p"/cart/coupon"} class="coupon">
      <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
      <input type="text" name="code" placeholder="Coupon code" />
      <button type="submit">Apply</button>
    </form>
    """
  end

  @doc "Checkout: on to Stripe."
  def cart_actions(assigns) do
    ~H"""
    <form method="post" action={~p"/cart/checkout"}>
      <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
      <button type="submit" class="button">Checkout</button>
    </form>
    """
  end

  # This list with some filters changed (nil removes one).
  defp href_with(query, changes) do
    next =
      query
      |> Map.merge(Map.new(changes, fn {k, v} -> {to_string(k), v} end))
      |> Enum.reject(fn {_k, v} -> v in [nil, ""] end)
      |> Enum.sort()

    if next == [], do: ~p"/store", else: ~p"/store?#{next}"
  end
end
