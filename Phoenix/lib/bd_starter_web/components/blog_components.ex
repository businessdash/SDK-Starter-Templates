defmodule BdStarterWeb.BlogComponents do
  @moduledoc """
  The blog's parts, one function component each: the filters and a post
  card for the list; meta, body (or members only), call to action, tags,
  like button and comments for a post. The like button and comments are
  `<bd-post-like>` and `<bd-post-comments>` (priv/static/shop/blog-elements.js);
  signed out, they lead to sign-in and back to the post.
  """
  use Phoenix.Component

  use Phoenix.VerifiedRoutes,
    endpoint: BdStarterWeb.Endpoint,
    router: BdStarterWeb.Router,
    statics: BdStarterWeb.static_paths()

  import BdStarterWeb.ShopComponents, only: [element_data: 1]

  alias BdStarterWeb.PostHtml

  @doc "All and a link per category, then the tags; choosing one resets the paging."
  attr :categories, :list, default: []
  attr :tags, :list, default: []
  attr :category, :string, default: nil
  attr :tag, :string, default: nil

  def blog_filters(assigns) do
    ~H"""
    <nav :if={@categories != [] or @tags != []} aria-label="Blog topics" class="blog-filters">
      <ul :if={@categories != []}>
        <li>
          <a
            aria-current={if is_nil(@category), do: "true"}
            href={filter_href(@category, @tag, "category", nil)}
          >All</a>
        </li>
        <li :for={item <- @categories}>
          <a
            aria-current={if @category == item["id"], do: "true"}
            href={filter_href(@category, @tag, "category", item["id"])}
          >
            {item["name"]}
          </a>
        </li>
      </ul>
      <ul :if={@tags != []} class="blog-filters__tags">
        <li :for={item <- @tags}>
          <a
            aria-current={if @tag == item, do: "true"}
            href={filter_href(@category, @tag, "tag", if(@tag == item, do: nil, else: item))}
          >
            #{item}
          </a>
        </li>
      </ul>
    </nav>
    """
  end

  @doc "A post in the list: cover, Pinned, date, reading time, title, excerpt and author. `lead` draws it large."
  attr :post, :map, required: true
  attr :lead, :boolean, default: false

  def post_card(assigns) do
    ~H"""
    <li class={["bd-card post-card", @lead && "post-card--lead"]}>
      <a class="post-card__link" href={~p"/blog/#{@post["slug"]}"}>
        <img
          :if={@post["imageUrl"]}
          alt=""
          class="post-card__img"
          loading="lazy"
          referrerpolicy="no-referrer"
          src={@post["imageUrl"]}
        />
        <div class="post-card__body">
          <p class="post-card__meta">
            <span :if={@post["isPinned"]} class="bd-badge">Pinned</span>
            <span>{PostHtml.date(@post["publishedAt"])}</span>
            <span>· {PostHtml.reading_minutes(@post["content"] || @post["excerpt"] || "")} min read</span>
          </p>
          <h2>{@post["title"]}</h2>
          <p :if={@post["excerpt"]} class="post-card__excerpt">{@post["excerpt"]}</p>
          <p :if={@post["authorName"]} class="post-card__author">{@post["authorName"]}</p>
        </div>
      </a>
    </li>
    """
  end

  @doc "The author with their photo, the date and the reading time."
  attr :post, :map, required: true
  attr :minutes, :integer, required: true

  def post_meta(assigns) do
    ~H"""
    <p class="post__meta">
      <img
        :if={@post["authorAvatarUrl"]}
        alt=""
        referrerpolicy="no-referrer"
        src={@post["authorAvatarUrl"]}
      />
      <span :if={@post["authorName"]}>{@post["authorName"]}</span>
      <span>{PostHtml.date(@post["publishedAt"])}</span>
      <span>· {@minutes} min read</span>
    </p>
    """
  end

  @doc "The post. `html` must come from `PostHtml.safe/1`, which rebuilds it from an allowlist."
  attr :html, :string, required: true

  def post_body(assigns) do
    ~H"""
    <div class="post__body">{Phoenix.HTML.raw(@html)}</div>
    """
  end

  @doc "In place of a members' post for visitors: Sign in to read it."
  attr :sign_in_href, :string, required: true

  def members_only(assigns) do
    ~H"""
    <div class="bd-empty">
      This post is for members.
      <p><a class="bd-btn" href={@sign_in_href}>Sign in to read it</a></p>
    </div>
    """
  end

  @doc """
  The post's call to action, when it has one. Only web, mail, same-site and
  in-page links; anything else goes nowhere.
  """
  attr :post, :map, required: true

  def post_cta(assigns) do
    ~H"""
    <aside :if={@post["ctaHref"] && @post["ctaLabel"]} class="bd-card post__cta">
      <p :if={@post["ctaDescription"]}>{@post["ctaDescription"]}</p>
      <a class="bd-btn" href={cta_href(@post["ctaHref"])}>{@post["ctaLabel"]}</a>
    </aside>
    """
  end

  @doc "The post's tags, each a link to the posts with it."
  attr :tags, :list, default: []

  def post_tags(assigns) do
    ~H"""
    <ul :if={@tags != []} class="post__tags">
      <li :for={tag <- @tags}><a href={~p"/blog?#{[tag: tag]}"}>#{tag}</a></li>
    </ul>
    """
  end

  @doc "♡ Like with the count. Signed out, it leads to sign-in and back."
  attr :likes, :map, required: true
  attr :like_url, :string, required: true
  attr :sign_in_href, :string, required: true

  def like_button(assigns) do
    ~H"""
    <bd-post-like data-like-url={@like_url} data-sign-in-href={@sign_in_href}>
      <.element_data value={@likes} />
    </bd-post-like>
    """
  end

  @doc "The comments and, signed in, a box to add one; signed out, a link to sign in and back."
  attr :comments, :any, required: true
  attr :comment_url, :string, required: true
  attr :sign_in_href, :string, required: true

  def comments(assigns) do
    ~H"""
    <bd-post-comments data-comment-url={@comment_url} data-sign-in-href={@sign_in_href}>
      <.element_data value={@comments} />
    </bd-post-comments>
    """
  end

  # This list with one filter changed and the paging reset.
  defp filter_href(category, tag, key, value) do
    next =
      %{"category" => category, "tag" => tag}
      |> Map.put(key, value)
      |> Enum.reject(fn {_k, v} -> v in [nil, ""] end)
      |> Enum.sort()

    if next == [], do: ~p"/blog", else: ~p"/blog?#{next}"
  end

  defp cta_href(href) when is_binary(href) do
    href = String.trim(href)
    if Regex.match?(~r/^(https?:|mailto:|\/|#)/i, href), do: href, else: "#"
  end

  defp cta_href(_), do: "#"
end
