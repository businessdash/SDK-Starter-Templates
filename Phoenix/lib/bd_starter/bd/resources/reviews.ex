defmodule BdStarter.Bd.Resources.Reviews do
  @moduledoc """
  The business's own reviews (Google, Yelp, Housecall Pro and the dashboard);
  a product's reviews live on Storefront. The average and the stars breakdown
  ride the marketing bundle's `reviews`.
  """

  alias BdStarter.Bd.Client

  @doc """
  One page, newest first: `%{"items", "totalCount", "nextOffset"}`. `source`
  narrows to one platform (google, yelp, housecall_pro, other).
  """
  def list(client, limit \\ 10, offset \\ 0, source \\ nil),
    do: Client.get(client, "reviews", limit: limit, offset: offset, source: source)
end
