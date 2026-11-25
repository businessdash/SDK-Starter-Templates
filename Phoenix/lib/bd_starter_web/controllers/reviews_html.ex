defmodule BdStarterWeb.ReviewsHTML do
  @moduledoc false
  use BdStarterWeb, :html

  alias BdStarter.Reviews

  embed_templates "reviews_html/*"

  @doc "A review's photos that are web addresses."
  def photos(review), do: review["photos"] |> List.wrap() |> Enum.map(&Reviews.web_url/1) |> Enum.reject(&is_nil/1)

  def average(%{average: average}), do: :erlang.float_to_binary(average, decimals: 1)

  def width(share), do: "width: #{round(share * 100)}%"

  def empty_message(nil) do
    "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."
  end

  def empty_message(source), do: "No #{Reviews.source_label(source)} reviews yet."
end
