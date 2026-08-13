defmodule BiabStarter.Biab do
  @moduledoc """
  The app-facing entry point. Controllers and LiveViews talk to this, not to
  `Client` — it owns the memoised client, the cache tags, and the fallbacks.

  Every read here follows the same contract: return real data when BIAB
  answers, return the caller's `default` when it doesn't, and never raise. A
  fresh clone with no credentials renders a complete site.
  """

  alias BiabStarter.Biab.Cache
  alias BiabStarter.Biab.Client

  alias BiabStarter.Biab.Resources.{
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

  @doc "The client, or nil when BIAB isn't configured."
  def client, do: Client.new()

  @doc "True once a site id is present — drives the 'not connected' banner."
  def configured?, do: not is_nil(Application.get_env(:biab_starter, :biab_site_id))

  @doc "Host root, for dashboard deep links."
  def host, do: Application.get_env(:biab_starter, :biab_host, "https://www.biab.app")

  # ── Cached reads ──────────────────────────────────────────────────────────

  def page_bundle(page_key \\ "home") do
    cached("marketing:#{page_key}", ["biab:marketing"], &Marketing.page_bundle(&1, page_key), %{})
  end

  def featured_products(limit \\ 6) do
    cached("storefront:featured:#{limit}", ["biab:storefront"], &Storefront.list(&1, limit: limit), %{})
    |> Map.get("items", [])
  end

  def product_grid(params) do
    key = "storefront:grid:" <> (params |> :erlang.term_to_binary() |> Base.encode16())
    cached(key, ["biab:storefront"], &Storefront.grid(&1, params), %{})
  end

  def product(id) do
    cached("storefront:product:#{id}", ["biab:storefront"], &Storefront.get(&1, id), nil)
  end

  def related_products(id, limit \\ 4) do
    cached("storefront:related:#{id}", ["biab:storefront"], &Storefront.related(&1, id, limit), %{})
    |> Map.get("items", [])
  end

  def product_reviews(id, limit \\ 5) do
    cached("storefront:reviews:#{id}", ["biab:storefront"], &Storefront.reviews(&1, id, limit), %{})
    |> Map.get("items", [])
  end

  def posts(limit \\ 20) do
    cached("blog:list:#{limit}", ["biab:blog"], &Blog.list(&1, limit), %{})
    |> Map.get("items", [])
  end

  def post(slug) do
    # The API wraps the post: `%{"post" => …, "access" => "granted" | "paywall"}`.
    cached("blog:post:#{slug}", ["biab:blog", "biab:blog:#{slug}"], &Blog.get(&1, slug), nil)
  end

  def post_comments(slug) do
    cached("blog:comments:#{slug}", ["biab:blog", "biab:blog:#{slug}"], &Blog.comments(&1, slug), %{})
    |> Map.get("items", [])
  end

  def reviews(limit \\ 10, offset \\ 0) do
    cached("reviews:#{offset}:#{limit}", ["biab:reviews"], &Reviews.list(&1, limit, offset), %{})
    |> Map.get("items", [])
  end

  def subscription_plans do
    cached("subscriptions", ["biab:subscriptions"], &Subscriptions.list/1, %{})
    |> Map.get("items", [])
  end

  def service_area_variants do
    cached("parallel:variants", ["biab:parallel-pages"], &ParallelPages.variants(&1, "service-area"), %{})
    |> Map.get("variants", [])
  end

  def service_area(service, area) do
    key = "parallel:#{service}:#{area}"

    cached(key, ["biab:parallel-pages"], &ParallelPages.render(&1, "service-area", %{
      "service" => service,
      "area" => area
    }), nil)
  end

  def todos do
    cached("data-model:todos", ["biab:data-model"], &DataModel.all(&1, "todos"), [])
  end

  def todo_images do
    cached("data-model:todoImages", ["biab:data-model"], &DataModel.all(&1, "todoImages"), [])
  end

  # ── Uncached (per-visitor) ────────────────────────────────────────────────

  def cart(visitor_token), do: uncached(&Cart.get(&1, visitor_token), nil)
  def cart_add(visitor_token, input), do: uncached(&Cart.add_item(&1, visitor_token, input), nil)

  def cart_update(visitor_token, item_id, input),
    do: uncached(&Cart.update_item(&1, visitor_token, item_id, input), nil)

  def cart_remove(visitor_token, item_id), do: uncached(&Cart.remove_item(&1, visitor_token, item_id), nil)
  def cart_coupon(visitor_token, code), do: uncached(&Cart.apply_coupon(&1, visitor_token, code), nil)
  def cart_clear(visitor_token), do: uncached(&Cart.clear(&1, visitor_token), nil)

  def checkout_start(visitor_token, urls), do: uncached(&Checkout.start(&1, visitor_token, urls), nil)

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
