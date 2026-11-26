defmodule BdStarter.Bd do
  @moduledoc """
  The app-facing entry point. Controllers and LiveViews talk to this, not to
  `Client` — it owns the memoised client, the cache tags, and the fallbacks.

  Every read here follows the same contract: return real data when BD
  answers, return the caller's `default` when it doesn't, and never raise. A
  fresh clone with no credentials renders a complete site.
  """

  alias BdStarter.Bd.Cache
  alias BdStarter.Bd.Client

  alias BdStarter.Bd.Resources.{
    Blog,
    Cart,
    Checkout,
    DataModel,
    Followers,
    Forms,
    Marketing,
    ParallelPages,
    Portal,
    Reviews,
    Storefront,
    Subscriptions
  }

  @doc "The client, or nil when BD isn't configured."
  def client, do: Client.new()

  @doc "True once a site id is present — drives the 'not connected' banner."
  def configured?, do: not is_nil(Application.get_env(:bd_starter, :bd_site_id))

  @doc "Host root, for dashboard deep links."
  def host, do: Application.get_env(:bd_starter, :bd_host, "https://businessdash.us")

  # ── Cached reads ──────────────────────────────────────────────────────────

  def page_bundle(page_key \\ "home") do
    cached("marketing:#{page_key}", ["bd:marketing"], &Marketing.page_bundle(&1, page_key), %{})
  end

  def featured_products(limit \\ 6) do
    cached(
      "storefront:featured:#{limit}",
      ["bd:storefront"],
      &Storefront.list(&1, limit: limit),
      %{}
    )
    |> Map.get("items", [])
  end

  @doc "The product list with its filters, counts and price range; nil when BD doesn't answer."
  def product_grid(params) do
    key = "storefront:grid:" <> (params |> :erlang.term_to_binary() |> Base.encode16())
    cached(key, ["bd:storefront"], &Storefront.grid(&1, params), nil)
  end

  def store_categories do
    cached("storefront:categories", ["bd:storefront"], &Storefront.categories/1, %{})
    |> Map.get("items", [])
  end

  @doc """
  One product for its page: `{:ok, product}`, or `{:error, :unavailable}` when
  the site's BD access is suspended, `{:error, :not_found}` otherwise.
  """
  def product_lookup(id) do
    case product(id) do
      nil ->
        # The cached read keeps no reason; ask once more to tell a missing
        # product from a suspended site.
        with client when not is_nil(client) <- client(),
             {:error, reason} <- Storefront.get(client, id) do
          {:error, if(Client.unavailable?(reason), do: :unavailable, else: :not_found)}
        else
          {:ok, product} -> {:ok, product}
          nil -> {:error, :not_found}
        end

      product ->
        {:ok, product}
    end
  end

  @doc "A page of a product's reviews with `totalCount` and `avgRating`; nil when BD doesn't answer."
  def product_review_page(id, limit) do
    cached(
      "storefront:reviews:#{id}:#{limit}",
      ["bd:storefront"],
      &Storefront.reviews(&1, id, limit),
      nil
    )
  end

  def product_addons(id) do
    cached("storefront:addons:#{id}", ["bd:storefront"], &Storefront.addons(&1, id), %{})
    |> Map.get("items", [])
  end

  def product(id) do
    cached("storefront:product:#{id}", ["bd:storefront"], &Storefront.get(&1, id), nil)
  end

  def related_products(id, limit \\ 4) do
    cached(
      "storefront:related:#{id}:#{limit}",
      ["bd:storefront"],
      &Storefront.related(&1, id, limit),
      %{}
    )
    |> Map.get("items", [])
  end

  def product_reviews(id, limit \\ 5) do
    cached("storefront:reviews:#{id}", ["bd:storefront"], &Storefront.reviews(&1, id, limit), %{})
    |> Map.get("items", [])
  end

  def posts(limit \\ 20) do
    cached("blog:list:#{limit}", ["bd:blog"], &Blog.list(&1, limit), %{})
    |> Map.get("items", [])
  end

  @doc "One page of posts: `%{\"items\", \"nextCursor\"}`, in a category or not."
  def post_page(limit, cursor, category_id) do
    key = "blog:page:#{limit}:#{cursor}:#{category_id}"

    cached(key, ["bd:blog"], &Blog.list(&1, limit, cursor, category_id), %{
      "items" => [],
      "nextCursor" => nil
    })
  end

  def blog_categories do
    cached("blog:categories", ["bd:blog"], &Blog.categories/1, %{}) |> Map.get("items", [])
  end

  def blog_tags do
    cached("blog:tags", ["bd:blog"], &Blog.tags/1, %{}) |> Map.get("items", [])
  end

  def post(slug) do
    # The API wraps the post: `%{"post" => …, "access" => "granted" | "paywall"}`.
    cached("blog:post:#{slug}", ["bd:blog", "bd:blog:#{slug}"], &Blog.get(&1, slug), nil)
  end

  def post_comments(slug) do
    cached("blog:comments:#{slug}", ["bd:blog", "bd:blog:#{slug}"], &Blog.comments(&1, slug), %{})
    |> Map.get("items", [])
  end

  @doc """
  The first `shown` reviews, newest first: `%{"items", "totalCount",
  "nextOffset"}`, read a page of up to 50 at a time.
  """
  def reviews_page(shown \\ 10, source \\ nil) do
    cached(
      "reviews:#{source || "all"}:#{shown}",
      ["bd:reviews"],
      &first_reviews(&1, shown, source),
      %{}
    )
  end

  @doc "The newest 50 reviews, for the platform filter; nil when BD doesn't answer."
  def review_sources do
    case cached("reviews:sources", ["bd:reviews"], &Reviews.list(&1, 50, 0), nil) do
      %{"items" => items} when is_list(items) -> items
      _ -> nil
    end
  end

  defp first_reviews(client, shown, source, items \\ [], offset \\ 0) do
    case Reviews.list(client, min(50, shown - length(items)), offset, source) do
      {:ok, %{} = page} ->
        got = List.wrap(page["items"])
        items = items ++ got
        next = if is_integer(page["nextOffset"]), do: page["nextOffset"], else: nil

        if next && got != [] && length(items) < shown do
          first_reviews(client, shown, source, items, next)
        else
          {:ok,
           %{
             "items" => items,
             "totalCount" => page["totalCount"] || length(items),
             "nextOffset" => next
           }}
        end

      {:ok, _} ->
        {:error, :unexpected_reply}

      error ->
        error
    end
  end

  def subscription_plans do
    cached("subscriptions", ["bd:subscriptions"], &Subscriptions.list/1, %{})
    |> Map.get("items", [])
  end

  def service_area_variants do
    cached(
      "parallel:variants",
      ["bd:parallel-pages"],
      &ParallelPages.variants(&1, "service-area"),
      %{}
    )
    |> Map.get("variants", [])
  end

  def service_area(service, area) do
    key = "parallel:#{service}:#{area}"

    cached(
      key,
      ["bd:parallel-pages"],
      &ParallelPages.render(&1, "service-area", %{
        "service" => service,
        "area" => area
      }),
      nil
    )
  end

  def todos do
    cached("data-model:todos", ["bd:data-model"], &DataModel.all(&1, "todos"), [])
  end

  def todo_images do
    cached("data-model:todoImages", ["bd:data-model"], &DataModel.all(&1, "todoImages"), [])
  end

  # ── Uncached (per-visitor) ────────────────────────────────────────────────

  def cart(visitor_token), do: uncached(&Cart.get(&1, visitor_token), nil)
  def cart_add(visitor_token, input), do: uncached(&Cart.add_item(&1, visitor_token, input), nil)

  def cart_update(visitor_token, item_id, input),
    do: uncached(&Cart.update_item(&1, visitor_token, item_id, input), nil)

  def cart_remove(visitor_token, item_id),
    do: uncached(&Cart.remove_item(&1, visitor_token, item_id), nil)

  def cart_coupon(visitor_token, code),
    do: uncached(&Cart.apply_coupon(&1, visitor_token, code), nil)

  def cart_clear(visitor_token), do: uncached(&Cart.clear(&1, visitor_token), nil)

  def checkout_start(visitor_token, urls),
    do: uncached(&Checkout.start(&1, visitor_token, urls), nil)

  @doc "Back from Stripe: the checkout session's status (`paymentStatus`, `customerEmail`)."
  def checkout_status(session_id), do: uncached(&Checkout.get(&1, nil, session_id), nil)

  # Comments and likes are read fresh: a cached list would hide a comment just posted.
  def post_comments_fresh(slug),
    do: uncached(&Blog.comments(&1, slug), %{}) |> Map.get("items", [])

  def like_status(slug, session_token),
    do: uncached(&Blog.like_status(&1, slug, session_token), nil)

  def toggle_like(slug, session_token),
    do: uncached(&Blog.toggle_like(&1, slug, session_token), nil)

  def post_comment(slug, content, session_token),
    do: uncached(&Blog.post_comment(&1, slug, content, session_token), nil)

  def portal_work(session_token, org_id),
    do: uncached(&Portal.work(&1, session_token, org_id), nil)

  def portal_review(session_token, org_id, input),
    do: uncached(&Portal.submit_review(&1, session_token, org_id, input), nil)

  def form_schema(slug), do: uncached(&Forms.schema(&1, slug), nil)
  def form_submit(slug, data, opts \\ []), do: uncached(&Forms.submit(&1, slug, data, opts), nil)
  def follower_join(email, name), do: uncached(&Followers.join(&1, email, name), nil)

  # ── Cache plumbing ────────────────────────────────────────────────────────

  def purge(tags), do: Cache.purge(tags)

  defp cached(key, tags, fun, default) do
    case client() do
      nil -> default
      client -> Cache.fetch(key, tags, fn -> fun.(client) end, default)
    end
  end

  defp uncached(fun, default) do
    case client() do
      nil -> default
      client -> Cache.attempt(fn -> fun.(client) end, default)
    end
  end
end
