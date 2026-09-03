defmodule BdStarter.Bd.Resources.Reviews do
  @moduledoc "The org-wide review wall. Per-product reviews live on Storefront."

  alias BdStarter.Bd.Client

  def list(client, limit \\ 10, offset \\ 0),
    do: Client.get(client, "reviews", limit: limit, offset: offset)
end
