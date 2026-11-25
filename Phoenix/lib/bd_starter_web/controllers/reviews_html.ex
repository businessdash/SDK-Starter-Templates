defmodule BdStarterWeb.ReviewsHTML do
  @moduledoc false
  use BdStarterWeb, :html

  alias BdStarter.Reviews

  embed_templates "reviews_html/*"

  def empty_message(nil) do
    "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."
  end

  def empty_message(source), do: "No #{Reviews.source_label(source)} reviews yet."
end
