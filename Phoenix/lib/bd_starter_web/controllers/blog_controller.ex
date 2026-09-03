defmodule BdStarterWeb.BlogController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd

  def index(conn, _params), do: render(conn, :index, posts: Bd.posts(20))

  def show(conn, %{"slug" => slug}) do
    # The API wraps the post: `%{"post" => …, "access" => "granted" | "paywall"}`.
    # `access` is how a paywalled post is signalled — the body comes back
    # truncated rather than absent, so a template that ignores it silently
    # renders a teaser as if it were the whole article.
    case Bd.post(slug) do
      nil ->
        conn |> put_status(:not_found) |> text("Post not found")

      %{"post" => post} = wrapper ->
        render(conn, :show,
          post: post,
          access: Map.get(wrapper, "access", "granted"),
          comments: Bd.post_comments(slug)
        )

      _ ->
        conn |> put_status(:not_found) |> text("Post not found")
    end
  end
end
