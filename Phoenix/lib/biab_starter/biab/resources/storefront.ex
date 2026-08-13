defmodule BiabStarter.Biab.Resources.Storefront do
  @moduledoc "Products, categories, and the per-product detail reads behind a shop."

  alias BiabStarter.Biab.Client

  def list(client, opts \\ []) do
    Client.get(client, "storefront/products",
      limit: opts[:limit],
      cursor: opts[:cursor],
      categoryId: opts[:category_id]
    )
  end

  @doc """
  The full shop grid: enriched cards plus `categoryCounts` and the catalog-wide
  `priceRange` for a filter sidebar.

  `sort` is one of featured | newest | price-asc | price-desc | rating-desc.
  """
  def grid(client, params) do
    Client.get(client, "storefront/products",
      meta: "1",
      search: params[:search],
      categoryId: params[:category_id],
      minPriceCents: params[:min_price_cents],
      maxPriceCents: params[:max_price_cents],
      minRating: params[:min_rating],
      sort: params[:sort],
      limit: params[:limit] || 24,
      cursor: params[:cursor]
    )
  end

  def categories(client), do: Client.get(client, "storefront/categories")

  def get(client, id), do: Client.get(client, "storefront/products/#{enc(id)}")

  def related(client, id, limit \\ 4),
    do: Client.get(client, "storefront/products/#{enc(id)}/related", limit: limit)

  def reviews(client, id, limit \\ 5),
    do: Client.get(client, "storefront/products/#{enc(id)}/reviews", limit: limit)

  def addons(client, id), do: Client.get(client, "storefront/products/#{enc(id)}/addons")

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
