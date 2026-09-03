defmodule BdStarter.Bd.Resources.ParallelPages do
  @moduledoc """
  Programmatic SEO. One template × N variant tuples, rendered by the platform
  so a hundred landing pages stay editable in the dashboard instead of being
  generated and forgotten in this repo.

  `variants/2` is what a sitemap iterates.
  """

  alias BdStarter.Bd.Client

  def list(client), do: Client.get(client, Client.site_path(client, "parallel-pages"))

  def variants(client, key),
    do: Client.get(client, Client.site_path(client, "parallel-pages/#{enc(key)}/variants"))

  def render(client, key, params),
    do: Client.get(client, Client.site_path(client, "parallel-pages/#{enc(key)}/render"), Map.to_list(params))

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
