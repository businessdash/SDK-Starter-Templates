defmodule BiabStarterWeb.StoreController do
  use BiabStarterWeb, :controller

  alias BiabStarter.Biab

  def index(conn, params) do
    grid =
      Biab.product_grid(
        search: Map.get(params, "search"),
        category_id: Map.get(params, "categoryId"),
        sort: Map.get(params, "sort")
      )

    render(conn, :index,
      products: Map.get(grid, "items", []),
      category_counts: Map.get(grid, "categoryCounts", []),
      search: Map.get(params, "search", "")
    )
  end

  def show(conn, %{"id" => id}) do
    case Biab.product(id) do
      nil ->
        conn |> put_status(:not_found) |> text("Product not found")

      product ->
        render(conn, :show,
          product: product,
          related: Biab.related_products(id),
          reviews: Biab.product_reviews(id)
        )
    end
  end
end
