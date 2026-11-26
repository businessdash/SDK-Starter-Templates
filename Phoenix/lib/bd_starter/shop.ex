defmodule BdStarter.Shop do
  @moduledoc """
  The product page's rules, the same as `shop.ts` in the other BD starters
  (priv/static/shop/shop.js here, which the browser uses): shaping a product
  for its page, which photos show for an option, what "from $40" means, and
  the product as the saved lists keep it.

  The page is drawn on the server as it opens (the first variant that can be
  bought, nothing else chosen); `<bd-gallery>` and `<bd-product-form>` take
  over from there in the browser.

  Money: variants and options carry DOLLARS; product cards and saved
  products carry integer CENTS.
  """

  @size_order ~w(XXS 2XS XS S SM M MD L LG XL 2XL XXL 3XL 4XL)

  @doc "Shape a `storefront.getProduct` response for the product page."
  def product_view(product) do
    product = if is_map(product), do: product, else: %{}
    category = if is_map(product["category"]), do: product["category"]

    product_images =
      product["productImages"]
      |> records()
      |> Enum.map(&%{url: text(&1["url"]), order: num(&1["order"]) || 0})
      |> Enum.filter(&(&1.url != ""))
      |> Enum.sort_by(& &1.order)
      |> Enum.map(& &1.url)

    images =
      if is_list(product["images"]),
        do: product["images"] |> Enum.map(&text/1) |> Enum.reject(&(&1 == "")),
        else: []

    %{features: features, specs: specs} = read_specs(product["specifications"])

    %{
      id: text(product["id"]),
      name: blank_as(text(product["name"]), "Untitled"),
      description: text(product["description"]),
      category_id: blank_as(text(product["categoryId"]), nil),
      category_name: category && blank_as(text(category["name"]), nil),
      images: if(images != [], do: images, else: product_images),
      variants:
        for variant <- records(product["variants"]) do
          %{
            id: text(variant["id"]),
            name: blank_as(text(variant["name"]), "Default"),
            price: num(variant["price"]),
            stock: num(variant["stock"]),
            available: variant["isLive"] != false and not zero?(variant["stock"])
          }
        end,
      variant_images:
        product["variantImages"]
        |> records()
        |> Enum.map(
          &%{
            variant_id: text(&1["variantId"]),
            url: text(&1["url"]),
            order: num(&1["order"]) || 0
          }
        )
        |> Enum.filter(&(&1.url != "")),
      option_titles:
        for title <- records(product["crossVariantTitles"]) do
          %{
            id: text(title["id"]),
            title: text(title["title"]),
            variant_id: blank_as(text(title["variantId"]), nil)
          }
        end,
      option_values:
        for option <- records(product["crossVariants"]) do
          %{
            id: text(option["id"]),
            title_id: text(option["crossVariantTitleId"]),
            value: text(option["value"]),
            price: num(option["price"]) || 0,
            stock: num(option["stock"]),
            available: option["isLive"] != false and not zero?(option["stock"])
          }
        end,
      features: features,
      specs: specs
    }
  end

  @doc "The variant a page opens on: the first one that can be bought."
  def default_variant(view),
    do: Enum.find(view.variants, & &1.available) || List.first(view.variants)

  @doc "The photos for a variant: its own when it has any, else the product's."
  def gallery_for(view, variant_id) do
    own =
      view.variant_images
      |> Enum.filter(&(&1.variant_id == variant_id))
      |> Enum.sort_by(& &1.order)
      |> Enum.map(& &1.url)

    if own != [], do: own, else: view.images
  end

  @doc "The option groups (Size, Colour…) that apply to a variant."
  def option_groups_for(view, variant_id) do
    view.option_titles
    |> Enum.filter(&(is_nil(&1.variant_id) or &1.variant_id == variant_id))
    |> Enum.map(&group_of(view, &1))
    |> Enum.filter(&(&1.values != []))
  end

  @doc """
  Every option group, with the variant it belongs to (nil: every variant).
  The page draws them all; `<bd-product-form>` shows the ones for the chosen
  variant.
  """
  def all_option_groups(view) do
    view.option_titles
    |> Enum.map(&Map.put(group_of(view, &1), :variant_id, &1.variant_id))
    |> Enum.filter(&(&1.values != []))
  end

  @doc """
  The sets of photos the page draws: the product's (variant ""), then one
  per variant with photos of its own. `<bd-gallery>` shows the chosen
  variant's set, or the product's.
  """
  def photo_sets(view) do
    own =
      view.variant_images
      |> Enum.map(& &1.variant_id)
      |> Enum.uniq()
      |> Enum.reject(&(&1 == ""))

    [%{variant_id: "", photos: view.images}] ++
      Enum.map(own, &%{variant_id: &1, photos: gallery_for(view, &1)})
  end

  @doc """
  The price shown for a variant and the options chosen so far (`chosen` maps
  an option group's id to an option value's id).
  """
  def price_for(view, variant_id, chosen \\ %{}) do
    variant = Enum.find(view.variants, &(&1.id == variant_id))
    groups = if variant && variant.available, do: option_groups_for(view, variant_id), else: []

    picks =
      Enum.map(groups, fn group -> Enum.find(group.values, &(&1.id == chosen[group.id])) end)

    cond do
      !(variant && variant.available) ->
        %{amount: nil, from: false, stock: 0, ready: false}

      groups == [] ->
        %{amount: variant.price, from: false, stock: variant.stock, ready: true}

      Enum.any?(picks, &is_nil/1) ->
        lowest =
          Enum.map(groups, fn group ->
            case Enum.filter(group.values, & &1.available) do
              [] -> 0
              open -> open |> Enum.map(& &1.price) |> Enum.min()
            end
          end)

        %{amount: Enum.sum(lowest), from: true, stock: nil, ready: false}

      not Enum.all?(picks, & &1.available) ->
        %{amount: nil, from: false, stock: 0, ready: false}

      true ->
        stocks = picks |> Enum.map(& &1.stock) |> Enum.reject(&is_nil/1)

        %{
          amount: picks |> Enum.map(& &1.price) |> Enum.sum(),
          from: false,
          stock: if(stocks == [], do: nil, else: Enum.min(stocks)),
          ready: true
        }
    end
  end

  @doc """
  The product as the saved lists keep it, priced for what's chosen. It goes
  to the browser as is, so its keys are the elements' (`priceCents`).
  """
  def product_summary(view, variant_id, chosen \\ %{}) do
    first = List.first(view.variants)
    start = price_for(view, variant_id, chosen).amount || (first && first.price)

    %{
      id: view.id,
      name: view.name,
      image: List.first(view.images),
      priceCents: if(start, do: round(start * 100))
    }
  end

  @doc "A related product as a card in a rail (`price_cents` from its dollars)."
  def related_card(related) do
    dollars = num(related["minPriceDollars"])

    %{
      id: text(related["id"]),
      name: text(related["name"]),
      image: blank_as(text(related["coverImageUrl"]), nil),
      price_cents: if(dollars, do: round(dollars * 100))
    }
  end

  @doc "The variant an add-on is added as: its first."
  def addon_variant(addon) do
    case addon["variants"] do
      [first | _] when is_map(first) ->
        case first["variantId"] || first["id"] do
          id when is_binary(id) -> id
          _ -> nil
        end

      _ ->
        nil
    end
  end

  @doc ~S|A review's date, as "Mar 4, 2026".|
  def review_date(iso) when is_binary(iso) and iso != "" do
    case DateTime.from_iso8601(iso) do
      {:ok, at, _offset} -> Calendar.strftime(at, "%b %-d, %Y")
      _ -> ""
    end
  end

  def review_date(_), do: ""

  # One option group's choices, sizes in size order.
  defp group_of(view, title) do
    values = Enum.filter(view.option_values, &(&1.title_id == title.id))

    values =
      if Regex.match?(~r/^sizes?$/i, title.title) do
        rank = fn value ->
          Enum.find_index(@size_order, &(&1 == String.upcase(value))) || length(@size_order)
        end

        Enum.sort_by(values, &rank.(&1.value))
      else
        values
      end

    %{id: title.id, title: title.title, values: values}
  end

  # The specifications column (`{ features, groups: [{ name, rows }] }`).
  defp read_specs(raw) do
    raw = if is_map(raw), do: raw, else: %{}

    features =
      if is_list(raw["features"]),
        do: raw["features"] |> Enum.map(&text/1) |> Enum.reject(&(&1 == "")),
        else: []

    specs =
      raw["groups"]
      |> records()
      |> Enum.map(fn group ->
        rows =
          group["rows"]
          |> records()
          |> Enum.map(&%{label: text(&1["label"]), value: text(&1["value"])})
          |> Enum.filter(&(&1.label != "" and &1.value != ""))

        %{name: text(group["name"]), rows: rows}
      end)
      |> Enum.filter(&(&1.name != "" and &1.rows != []))

    %{features: features, specs: specs}
  end

  defp text(value) when is_binary(value), do: String.trim(value)
  defp text(_), do: ""

  defp num(value) when is_number(value), do: value
  defp num(_), do: nil

  # A stock of none: sold out. (No stock count means it isn't tracked.)
  defp zero?(value), do: is_number(value) and value == 0

  defp blank_as("", fallback), do: fallback
  defp blank_as(value, _fallback), do: value

  defp records(value) when is_list(value), do: Enum.filter(value, &is_map/1)
  defp records(_), do: []
end
