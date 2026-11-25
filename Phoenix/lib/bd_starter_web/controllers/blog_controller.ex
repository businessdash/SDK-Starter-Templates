defmodule BdStarterWeb.BlogController do
  @moduledoc """
  The blog: the post list with its category and tag filters, one post, and
  the like and comment endpoints for signed-in customers.

  A post's HTML is rebuilt from an allowlist (`BdStarterWeb.PostHtml`) before
  it reaches the page. The like button and comments are custom elements
  (priv/static/shop/blog-elements.js); signed out, they lead to sign-in and
  back.
  """
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Auth
  alias BdStarterWeb.PostHtml

  @page 12

  @doc """
  One page of posts, pinned first on the first page. A tag is matched here,
  over the newest 50 posts, because the API filters by category only.
  """
  def index(conn, params) do
    category = text(params["category"])
    tag = text(params["tag"])

    cursor =
      case Integer.parse(params["cursor"] || "") do
        {n, ""} -> n
        _ -> nil
      end

    list = Bd.post_page(if(tag, do: 50, else: @page), cursor, category)
    posts = Enum.filter(list["items"] || [], &(tag == nil or tag in (&1["tags"] || [])))
    # Pinned first; the sort is stable, so the rest keep their order.
    posts = if cursor, do: posts, else: Enum.sort_by(posts, &if(&1["isPinned"], do: 0, else: 1))
    categories = Bd.blog_categories()
    active = Enum.find(categories, &(&1["id"] == category))

    render(conn, :index,
      page_title: if(active, do: "#{active["name"]} — Blog", else: "Blog"),
      main_class: "bd-page",
      blog: :list,
      configured: Bd.configured?(),
      posts: posts,
      paged: cursor != nil,
      next_cursor: if(tag, do: nil, else: list["nextCursor"]),
      categories: categories,
      tags: Bd.blog_tags(),
      category: category,
      tag: tag,
      active: active
    )
  end

  def show(conn, %{"slug" => slug}) do
    # The API wraps the post: `%{"post" => …, "access" => "granted" | "paywall"}`.
    # `access` is how a paywalled post is signalled — the body comes back
    # truncated rather than absent, so a template that ignores it silently
    # renders a teaser as if it were the whole article.
    case Bd.post(slug) do
      %{"post" => %{} = post} = wrapper ->
        token = session_token(conn)
        signed_in = token != nil and Auth.session(Bd.client(), token) != nil
        likes = Bd.like_status(slug, if(signed_in, do: token))
        content = post["content"] || ""

        render(conn, :show,
          page_title: "#{post["title"]} — Blog",
          main_class: "bd-page",
          blog: :post,
          post: post,
          html: PostHtml.safe(content),
          minutes: PostHtml.reading_minutes(content),
          paywalled: Map.get(wrapper, "access", "granted") == "paywall",
          likes: %{
            likes: likes || %{liked: false, likesCount: post["likes"] || 0},
            signedIn: signed_in
          },
          comments: %{comments: Bd.post_comments_fresh(slug), signedIn: signed_in},
          sign_in_href: ~p"/my-account?#{[next: "/blog/" <> URI.encode(slug, &URI.char_unreserved?/1)]}"
        )

      _ ->
        # A 404, so the page isn't indexed; a link back still shows.
        conn
        |> put_status(if(Bd.configured?(), do: 404, else: 200))
        |> render(:show, page_title: "Post not found", main_class: "bd-page", blog: :list, post: nil)
    end
  end

  @doc "Like or unlike, for the signed-in customer: `%{liked, likesCount}` or `%{error}`."
  def like(conn, %{"slug" => slug}) do
    with :ok <- configured(),
         {:ok, token} <- signed_in(conn, "Sign in to like posts.") do
      case Bd.toggle_like(slug, token) do
        %{} = result ->
          reply(conn, 200, %{liked: result["liked"] == true, likesCount: result["likesCount"] || 0})

        _ ->
          reply(conn, 502, %{error: "Couldn't save your like. Try again."})
      end
    else
      {:error, status, message} -> reply(conn, status, %{error: message})
    end
  end

  @doc "`%{content}` in; out, whether it shows now or waits for approval, and the comments as they are now."
  def comment(conn, %{"slug" => slug} = params) do
    content = if is_binary(params["content"]), do: String.trim(params["content"]), else: ""

    with :ok <- configured(),
         {:ok, token} <- signed_in(conn, "Sign in to comment."),
         :ok <- valid_comment(content) do
      case Bd.post_comment(slug, content, token) do
        %{} = posted ->
          reply(conn, 200, %{
            ok: true,
            approved: get_in(posted, ["moderation", "isApproved"]) == true,
            comments: Bd.post_comments_fresh(slug)
          })

        _ ->
          reply(conn, 502, %{ok: false, error: "Couldn't post your comment. Try again."})
      end
    else
      {:error, status, message} -> reply(conn, status, %{ok: false, error: message})
    end
  end

  defp configured do
    if Bd.configured?(), do: :ok, else: {:error, 503, "The blog isn't connected yet."}
  end

  defp signed_in(conn, message) do
    case session_token(conn) do
      nil -> {:error, 401, message}
      token -> {:ok, token}
    end
  end

  defp valid_comment(""), do: {:error, 400, "Write something first."}

  defp valid_comment(content) do
    if String.length(content) > 5000,
      do: {:error, 400, "Comments are up to 5,000 characters."},
      else: :ok
  end

  defp session_token(conn) do
    conn = fetch_cookies(conn)

    case conn.cookies[Application.get_env(:bd_starter, :bd_session_cookie, "bd_session")] do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp reply(conn, status, body) do
    conn |> put_resp_header("cache-control", "no-store") |> put_status(status) |> json(body)
  end

  defp text(value) when is_binary(value) and value != "", do: value
  defp text(_), do: nil
end
