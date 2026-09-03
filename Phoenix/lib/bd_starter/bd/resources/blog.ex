defmodule BdStarter.Bd.Resources.Blog do
  @moduledoc "Posts, categories, tags, threaded comments."

  alias BdStarter.Bd.Client

  def list(client, limit \\ 20, cursor \\ nil),
    do: Client.get(client, "blog/posts", limit: limit, cursor: cursor)

  def get(client, slug), do: Client.get(client, "blog/posts/#{enc(slug)}")

  def comments(client, slug, limit \\ 50),
    do: Client.get(client, "blog/posts/#{enc(slug)}/comments", limit: limit)

  def categories(client), do: Client.get(client, "blog/categories")
  def tags(client), do: Client.get(client, "blog/tags")

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
