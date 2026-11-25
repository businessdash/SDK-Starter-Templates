defmodule BdStarterWeb.StoreHTML do
  @moduledoc false
  use BdStarterWeb, :html

  embed_templates "store_html/*"

  @doc "This list with some filters changed (nil removes one)."
  def href_with(query, changes) do
    next =
      query
      |> Map.merge(Map.new(changes, fn {k, v} -> {to_string(k), v} end))
      |> Enum.reject(fn {_k, v} -> v in [nil, ""] end)
      |> Enum.sort()

    if next == [], do: ~p"/store", else: ~p"/store?#{next}"
  end

  @doc "The filters a form leaves alone, carried along as hidden fields."
  def keep(query, replaced), do: query |> Map.drop(replaced) |> Enum.sort()

  def save_data(product) do
    Jason.encode!(%{
      id: product["id"],
      name: product["name"] || "Untitled",
      image: product["coverImage"],
      priceCents: product["cheapestPriceCents"]
    })
  end
end
