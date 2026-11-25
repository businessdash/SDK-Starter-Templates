defmodule BdStarterWeb.ProductComponents do
  @moduledoc """
  The product page's parts, one function component each, and
  `product_detail/1`, which lays the page out from them: photos that follow
  the chosen option, option and size buttons, the price for what's chosen,
  add to cart, save and compare, share, details, add-ons, reviews, related
  products and what was viewed before.

  They're drawn on the server as the page opens (the first variant that can
  be bought, nothing else chosen; the rules are `BdStarter.Shop`).
  `<bd-gallery>` and `<bd-product-form>` (priv/static/shop/shop-elements.js)
  bring them to life: they find the parts by their `data-bd-*` attributes,
  so move, restyle or drop any part, or lay them out your own way.
  """
  use Phoenix.Component

  import BdStarterWeb.Money
  import BdStarterWeb.ShopComponents, only: [stars: 1, element_data: 1]

  alias BdStarter.Shop

  @doc """
  The whole product page. `data` is what `StoreController.show/2` gathers:
  product, reviews, addons, related, moreReviewsHref.
  """
  attr :data, :map, required: true
  attr :store_href, :string, default: "/store"
  attr :cart_href, :string, default: "/cart"
  attr :add_url, :string, required: true
  attr :contact_href, :string, default: "/#contact"

  def product_detail(assigns) do
    view = Shop.product_view(assigns.data.product)
    variant_id = (Shop.default_variant(view) || %{id: ""}).id
    price = Shop.price_for(view, variant_id)

    assigns =
      assign(assigns,
        view: view,
        variant_id: variant_id,
        price: price,
        summary: Shop.product_summary(view, variant_id),
        related: Enum.map(assigns.data.related || [], &Shop.related_card/1)
      )

    ~H"""
    <.product_breadcrumbs product={@view} store_href={@store_href} />

    <div class="product-detail">
      <.product_gallery
        name={@view.name}
        product_id={@view.id}
        sets={Shop.photo_sets(@view)}
        variant_id={@variant_id}
      />

      <div class="product-detail__info bd-card">
        <.product_title product={@view} reviews={@data.reviews} />
        <bd-product-form data-add-url={@add_url} data-cart-href={@cart_href}>
          <.element_data value={%{product: @data.product}} />
          <.product_price price={@price} />
          <p :if={@view.description != ""} class="product-detail__desc">{@view.description}</p>
          <.variant_picker
            selected={@variant_id}
            show_prices={Shop.option_groups_for(@view, @variant_id) == []}
            variants={@view.variants}
          />
          <.option_picker
            :for={group <- Shop.all_option_groups(@view)}
            group={group}
            hidden={group.variant_id != nil and group.variant_id != @variant_id}
          />
          <.stock_note stock={@price.stock} />

          <div class="buy">
            <.quantity_stepper max={@price.stock} />
            <.add_to_cart_button price={@price} />
          </div>
          <.cart_notice cart_href={@cart_href} />

          <div class="product-detail__tools">
            <.save_buttons product={@summary} />
            <.share_button title={@view.name} />
          </div>
          <.product_policies contact_href={@contact_href} />
        </bd-product-form>
      </div>
    </div>

    <.product_specs features={@view.features} specs={@view.specs} />
    <.product_addons add_url={@add_url} addons={@data.addons || []} />
    <.product_reviews more_href={@data.moreReviewsHref} reviews={@data.reviews} />
    <.product_rail products={@related} store_href={@store_href} title="You may also like" />
    <.recently_viewed product={@summary} store_href={@store_href} />
    <.compare_bar store_href={@store_href} />
    """
  end

  @doc "Store / Category / This product. `product` is from `Shop.product_view/1`."
  attr :product, :map, required: true
  attr :store_href, :string, default: "/store"

  def product_breadcrumbs(assigns) do
    ~H"""
    <nav aria-label="Breadcrumb" class="crumbs">
      <a href={@store_href}>Store</a>
      <%= if @product.category_id do %>
        <span aria-hidden="true">/</span>
        <a href={"#{@store_href}?category=#{URI.encode_www_form(@product.category_id)}"}>{@product.category_name || "Category"}</a>
      <% end %>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{@product.name}</span>
    </nav>
    """
  end

  @doc """
  The photos: a set for the product, then one per option with photos of its
  own (`Shop.photo_sets/1`). `<bd-gallery>` shows the chosen option's set,
  and steps through it with ‹ › and the thumbnails.
  """
  attr :product_id, :string, required: true
  attr :name, :string, required: true
  attr :sets, :list, required: true
  attr :variant_id, :string, required: true

  def product_gallery(assigns) do
    shown = if Enum.any?(assigns.sets, &(&1.variant_id == assigns.variant_id)), do: assigns.variant_id, else: ""
    assigns = assign(assigns, :shown, shown)

    ~H"""
    <bd-gallery data-product-id={@product_id}>
      <div
        :for={set <- @sets}
        class="gallery"
        data-bd-photos-for={set.variant_id}
        hidden={set.variant_id != @shown}
      >
        <div class="gallery__main">
          <img
            :if={set.photos != []}
            alt={@name}
            data-bd-main
            loading={if set.variant_id != @shown, do: "lazy"}
            referrerpolicy="no-referrer"
            src={hd(set.photos)}
          />
          <div :if={set.photos == []} class="gallery__placeholder">No photo yet</div>
          <%= if length(set.photos) > 1 do %>
            <button aria-label="Previous photo" class="gallery__step gallery__step--prev" data-bd-step="-1" type="button">‹</button>
            <button aria-label="Next photo" class="gallery__step gallery__step--next" data-bd-step="1" type="button">›</button>
          <% end %>
        </div>
        <div :if={length(set.photos) > 1} class="gallery__thumbs">
          <button
            :for={{src, i} <- Enum.with_index(set.photos)}
            aria-current={to_string(i == 0)}
            aria-label={"Photo #{i + 1} of #{length(set.photos)}"}
            class={["gallery__thumb", i == 0 && "gallery__thumb--on"]}
            data-bd-photo={i}
            type="button"
          ><img alt="" loading="lazy" referrerpolicy="no-referrer" src={src} /></button>
        </div>
      </div>
    </bd-gallery>
    """
  end

  @doc "The category, the name, and the stars linking to the reviews."
  attr :product, :map, required: true
  attr :reviews, :map, default: nil

  def product_title(assigns) do
    reviews = assigns.reviews || %{}
    assigns = assign(assigns, count: reviews["totalCount"] || 0, average: (reviews["avgRating"] || 0) / 1)

    ~H"""
    <div>
      <p :if={@product.category_name} class="product-detail__eyebrow">{@product.category_name}</p>
      <h1>{@product.name}</h1>
      <a :if={@count > 0} class="product-detail__rating" href="#reviews"><.stars rating={@average} /><span>{one_decimal(@average)} · {@count} reviews</span></a>
    </div>
    """
  end

  @doc """
  The price for what's chosen times the quantity: "From" until every option
  is picked, the price each when buying more than one, Sold out when there's
  none. `price` is from `Shop.price_for/3`; `<bd-product-form>` keeps it
  current.
  """
  attr :price, :map, required: true
  attr :quantity, :integer, default: 1

  def product_price(assigns) do
    ~H"""
    <p class="product-detail__price" data-bd-price>
      <span class="product-detail__from" data-bd-from hidden={!(@price.amount && @price.from)}>From</span> <span data-bd-amount>{if @price.amount, do: amount(@price.amount * @quantity), else: "Sold out"}</span><span class="product-detail__each" data-bd-each hidden={!(@price.amount && @quantity > 1)}>{if @price.amount && @quantity > 1, do: " (#{amount(@price.amount)} each)"}</span>
    </p>
    """
  end

  @doc """
  A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
  ones can't be pressed. Nothing shows for a product with one variant. A
  variant's price shows on its button while it has no options of its own.
  """
  attr :variants, :list, required: true
  attr :selected, :string, required: true
  attr :show_prices, :boolean, default: true

  def variant_picker(assigns) do
    ~H"""
    <fieldset :if={length(@variants) > 1} class="choice">
      <legend class="bd-label">Option</legend>
      <div class="choice__values">
        <button
          :for={v <- @variants}
          aria-pressed={to_string(v.id == @selected)}
          class={["choice__value", v.id == @selected && "choice__value--on"]}
          data-bd-variant={v.id}
          disabled={!v.available}
          type="button"
        >{v.name}<small :if={v.price} data-bd-variant-price hidden={!@show_prices}> {amount(v.price)}</small></button>
      </div>
    </fieldset>
    """
  end

  @doc """
  One option group (Size, Colour…): a button per value. Groups that belong
  to another variant start hidden; `<bd-product-form>` shows the chosen
  variant's and names the chosen value beside the title.
  """
  attr :group, :map, required: true
  attr :hidden, :boolean, default: false

  def option_picker(assigns) do
    ~H"""
    <fieldset class="choice" data-bd-for-variant={@group.variant_id} data-bd-group={@group.id} hidden={@hidden}>
      <legend class="bd-label">{@group.title}<span class="choice__picked" data-bd-picked hidden></span></legend>
      <div class="choice__values">
        <button
          :for={value <- @group.values}
          aria-pressed="false"
          class="choice__value"
          data-bd-value={value.id}
          disabled={!value.available}
          title={if !value.available, do: "Sold out"}
          type="button"
        >{value.value}</button>
      </div>
    </fieldset>
    """
  end

  @doc ~S|"Only 3 left", at five or fewer.|
  attr :stock, :any, default: nil

  def stock_note(assigns) do
    assigns = assign(assigns, :low, is_number(assigns.stock) and assigns.stock > 0 and assigns.stock <= 5)

    ~H"""
    <p class="product-detail__stock" data-bd-stock hidden={!@low}>{if @low, do: "Only #{whole(@stock)} left"}</p>
    """
  end

  @doc "− and + around how many to add, from 1 up to what's in stock."
  attr :quantity, :integer, default: 1
  attr :max, :any, default: nil

  def quantity_stepper(assigns) do
    ~H"""
    <div aria-label="Quantity" class="qty" role="group">
      <button aria-label="One fewer" data-bd-qty="-1" disabled={@quantity <= 1} type="button">−</button>
      <span aria-live="polite" data-bd-qty-value>{@quantity}</span>
      <button aria-label="One more" data-bd-qty="1" disabled={is_number(@max) and @quantity >= @max} type="button">+</button>
    </div>
    """
  end

  @doc ~S|Add to cart; "Choose options" until every option is picked, Sold out when there's none.|
  attr :price, :map, required: true

  def add_to_cart_button(assigns) do
    ~H"""
    <button class="bd-btn buy__add" data-bd-add disabled={!@price.ready} type="button">{cond do
        is_nil(@price.amount) -> "Sold out"
        not @price.ready -> "Choose options"
        true -> "Add to cart"
      end}</button>
    """
  end

  @doc ~S|After adding: "Added 2 to your cart." with View cart, or what went wrong.|
  attr :cart_href, :string, default: "/cart"

  def cart_notice(assigns) do
    ~H"""
    <div class="product-detail__msg" data-bd-notice hidden role="status"><span data-bd-notice-text></span><a class="bd-btn bd-btn--ghost" data-bd-notice-link href={@cart_href}>View cart</a></div>
    """
  end

  @doc "♡ Save and ⇄ Compare for a product (`product`: id, name, image, priceCents)."
  attr :product, :map, required: true
  attr :compact, :boolean, default: false

  def save_buttons(assigns) do
    ~H"""
    <bd-save-buttons compact={@compact} data-product={Jason.encode!(@product)}></bd-save-buttons>
    """
  end

  @doc ~S|↗ Share: the share sheet, or the link copied ("Link copied").|
  attr :title, :string, required: true

  def share_button(assigns) do
    ~H"""
    <bd-share data-title={@title}>
      <button class="share" data-bd-share type="button"><span aria-hidden="true">↗</span> Share</button>
      <span class="share__note" data-bd-share-note hidden role="status"></span>
    </bd-share>
    """
  end

  @doc "Secure checkout, and a link to ask before buying."
  attr :contact_href, :string, default: "/#contact"

  def product_policies(assigns) do
    ~H"""
    <ul class="policies">
      <li>Secure checkout with Stripe</li>
      <li>Questions? <a href={@contact_href}>Ask us</a> before you buy</li>
    </ul>
    """
  end

  @doc "Details: the feature list, then a table per spec group."
  attr :features, :list, default: []
  attr :specs, :list, default: []

  def product_specs(assigns) do
    ~H"""
    <section :if={@features != [] or @specs != []} class="product-section" id="specs">
      <h2 class="product-section__title">Details</h2>
      <ul :if={@features != []} class="features">
        <li :for={feature <- @features}>{feature}</li>
      </ul>
      <table :for={group <- @specs} class="specs">
        <caption>{group.name}</caption>
        <tbody>
          <tr :for={row <- group.rows}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        </tbody>
      </table>
    </section>
    """
  end

  @doc ~S|"Complete your purchase": add-ons, each with Add (`<bd-addon>` posts it to `add_url`).|
  attr :addons, :list, default: []
  attr :add_url, :string, required: true

  def product_addons(assigns) do
    ~H"""
    <section :if={@addons != []} class="product-section">
      <h2 class="product-section__title">Complete your purchase</h2>
      <div class="addon-grid">
        <div :for={addon <- @addons} class="addon-card bd-card">
          <div class="addon-card__media">
            <img
              :if={addon["imageUrl"]}
              alt={addon["addonName"]}
              loading="lazy"
              referrerpolicy="no-referrer"
              src={addon["imageUrl"]}
            />
            <div :if={!addon["imageUrl"]} class="addon-card__noimg">—</div>
          </div>
          <div class="addon-card__body">
            <span :if={addon["groupLabel"]} class="addon-card__group">{addon["groupLabel"]}</span>
            <p class="addon-card__name">{addon["addonName"]}</p>
            <span :if={addon["priceCents"]} class="addon-card__price">{cents(addon["priceCents"])}</span>
          </div>
          <bd-addon
            data-add-url={@add_url}
            data-product-id={addon["addonProductId"]}
            data-variant-id={Shop.addon_variant(addon)}
          >
            <button class="bd-btn bd-btn--ghost addon-card__add" data-bd-add type="button">Add</button>
          </bd-addon>
        </div>
      </div>
    </section>
    """
  end

  @doc "The product's reviews: the average, each review, and Show more reviews (`more_href`)."
  attr :reviews, :map, default: nil
  attr :more_href, :string, default: nil

  def product_reviews(assigns) do
    reviews = assigns.reviews || %{}

    assigns =
      assign(assigns,
        items: reviews["items"] || [],
        total: reviews["totalCount"] || 0,
        average: (reviews["avgRating"] || 0) / 1
      )

    ~H"""
    <section class="product-section" id="reviews">
      <h2 class="product-section__title">Reviews</h2>
      <%= if @items != [] do %>
        <p class="reviews__summary"><.stars rating={@average} /><strong>{one_decimal(@average)} out of 5</strong><span>from {@total} reviews</span></p>
        <div class="review-list">
          <article :for={review <- @items} class="review">
            <div class="review__head"><.stars rating={review["rating"] || 0} /><span class="review__name">{review["reviewerName"] || "Verified buyer"}</span><span class="review__date">{Shop.review_date(review["createdAt"])}</span></div>
            <p :if={review["title"]} class="review__title">{review["title"]}</p>
            <p :if={review["content"] || review["body"]} class="review__body">{review["content"] || review["body"]}</p>
          </article>
        </div>
        <a :if={@more_href} class="bd-btn bd-btn--ghost reviews__more" href={@more_href}>Show more reviews</a>
      <% else %>
        <p class="reviews__none">No reviews yet.</p>
      <% end %>
    </section>
    """
  end

  @doc "A row of small product cards (related products). `products`: id, name, image, price_cents."
  attr :title, :string, required: true
  attr :products, :list, default: []
  attr :store_href, :string, default: "/store"

  def product_rail(assigns) do
    ~H"""
    <section :if={@products != []} class="product-rail">
      <h2 class="product-rail__title">{@title}</h2>
      <ul class="product-rail__row">
        <li :for={product <- @products}>
          <a class="bd-card product-rail__card" href={"#{@store_href}/#{URI.encode(product.id, &URI.char_unreserved?/1)}"}><img :if={product.image} alt="" loading="lazy" referrerpolicy="no-referrer" src={product.image} /><span :if={!product.image} aria-hidden="true" class="product-rail__noimg"></span><span class="product-rail__name">{product.name}</span><span :if={product.price_cents} class="product-rail__price">{cents(product.price_cents)}</span></a>
        </li>
      </ul>
    </section>
    """
  end

  @doc "What this browser opened before, as a rail; this product joins the list for next time."
  attr :product, :map, required: true
  attr :store_href, :string, default: "/store"

  def recently_viewed(assigns) do
    ~H"""
    <bd-recently-viewed data-product={Jason.encode!(@product)} data-store-href={@store_href}></bd-recently-viewed>
    """
  end

  @doc "The products picked to compare, along the bottom, with Compare and Clear."
  attr :store_href, :string, default: "/store"

  def compare_bar(assigns) do
    ~H"""
    <bd-compare-bar data-store-href={@store_href}></bd-compare-bar>
    """
  end

  defp one_decimal(n), do: :erlang.float_to_binary(n / 1, decimals: 1)

  defp whole(n) when is_float(n) and n == trunc(n), do: trunc(n)
  defp whole(n), do: n
end
