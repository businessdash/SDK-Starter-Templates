defmodule BdStarter.Bd.Resources.Blog do
  @moduledoc """
  Posts, categories, tags, threaded comments, likes.

  Commenting and liking are done as the signed-in customer: their `bd_session`
  cookie goes out as **`X-BD-Session-Token`** (not the lowercase
  `x-bd-session` that `auth/me` takes).
  """

  alias BdStarter.Bd.Client

  def list(client, limit \\ 20, cursor \\ nil, category_id \\ nil),
    do: Client.get(client, "blog/posts", limit: limit, cursor: cursor, categoryId: category_id)

  def get(client, slug), do: Client.get(client, "blog/posts/#{enc(slug)}")

  def comments(client, slug, limit \\ 50),
    do: Client.get(client, "blog/posts/#{enc(slug)}/comments", limit: limit)

  def categories(client), do: Client.get(client, "blog/categories")
  def tags(client), do: Client.get(client, "blog/tags")

  @doc """
  `%{"liked", "likesCount"}`. With a session, `liked` says whether this
  customer already liked the post; without one it is false.
  """
  def like_status(client, slug, session_token \\ nil),
    do: Client.get(client, "blog/posts/#{enc(slug)}/like", [], session(session_token))

  @doc "Like or unlike as the signed-in customer; returns the new `%{\"liked\", \"likesCount\"}`."
  def toggle_like(client, slug, session_token),
    do: Client.post(client, "blog/posts/#{enc(slug)}/like", nil, session(session_token))

  @doc """
  Comment as the signed-in customer. The reply carries the comment and the
  moderation verdict: `moderation.isApproved` false means it waits for review.
  """
  def post_comment(client, slug, content, session_token),
    do:
      Client.post(
        client,
        "blog/posts/#{enc(slug)}/comments",
        %{content: content},
        session(session_token)
      )

  defp session(nil), do: []
  defp session(token), do: [{"x-bd-session-token", token}]

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
