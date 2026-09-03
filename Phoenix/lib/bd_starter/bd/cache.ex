defmodule BdStarter.Bd.Cache do
  @moduledoc """
  Tag-addressed read cache, backed by ETS.

  Two reasons this is a GenServer with its own table rather than `:persistent_term`
  or a library:

    * **Tags.** The publish webhook names exactly which tags changed, so a
      publish drops `bd:blog` without touching the product catalog. Entries
      are stored keyed by cache key AND indexed by tag.
    * **PubSub.** A purge broadcasts on `#{inspect(__MODULE__)}` so every
      connected LiveView re-reads immediately. On a multi-node deploy the
      broadcast crosses nodes while the ETS table doesn't — each node keeps its
      own copy and each is told to drop it. That is the correct shape: the
      cache is a local optimisation, the invalidation is cluster-wide.
  """

  use GenServer

  alias Phoenix.PubSub

  @table :bd_cache
  @tags :bd_cache_tags
  @topic "bd:cache"

  # ── Public API ────────────────────────────────────────────────────────────

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "Topic LiveViews subscribe to for purge notifications."
  def topic, do: @topic

  @doc """
  Read through the cache.

  `fun` returns `{:ok, value} | {:error, reason}`. Only `:ok` is cached — a
  failed read must not pin an error in place for the whole TTL. On error the
  caller gets `default`, so a page renders its local fallback instead of
  crashing.
  """
  @spec fetch(String.t(), [String.t()], (-> {:ok, term()} | {:error, term()}), term()) :: term()
  def fetch(key, tags, fun, default \\ nil) do
    case lookup(key) do
      {:hit, value} ->
        value

      :miss ->
        case fun.() do
          {:ok, value} ->
            put(key, tags, value)
            value

          {:error, reason} ->
            log_miss(key, reason)
            default
        end
    end
  end

  @doc """
  Uncached read with the same swallow-and-fall-back contract. For anything
  per-visitor — cart, customer portal — where caching would serve one
  customer's data to the next.
  """
  @spec attempt((-> {:ok, term()} | {:error, term()}), term()) :: term()
  def attempt(fun, default \\ nil) do
    case fun.() do
      {:ok, value} -> value
      {:error, reason} -> log_miss("(uncached)", reason) && default
    end
  end

  @doc "Drop every entry carrying any of `tags`, then tell listeners."
  @spec purge([String.t()]) :: :ok
  def purge([]), do: :ok

  def purge(tags) do
    GenServer.call(__MODULE__, {:purge, tags})
    PubSub.broadcast(BdStarter.PubSub, @topic, {:bd_cache_purged, tags})
    :ok
  end

  # ── GenServer ─────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    :ets.new(@tags, [:named_table, :public, :bag, read_concurrency: true])
    {:ok, %{}}
  end

  @impl true
  def handle_call({:purge, tags}, _from, state) do
    keys =
      tags
      |> Enum.flat_map(&:ets.lookup(@tags, &1))
      |> Enum.map(fn {_tag, key} -> key end)
      |> Enum.uniq()

    Enum.each(keys, &:ets.delete(@table, &1))
    Enum.each(tags, &:ets.delete(@tags, &1))

    {:reply, length(keys), state}
  end

  # ── Internals ─────────────────────────────────────────────────────────────

  defp lookup(key) do
    case :ets.lookup(@table, key) do
      [{^key, value, expires_at}] ->
        if System.monotonic_time(:second) < expires_at, do: {:hit, value}, else: :miss

      [] ->
        :miss
    end
  end

  defp put(key, tags, value) do
    ttl = Application.get_env(:bd_starter, :bd_cache_ttl, 300)
    :ets.insert(@table, {key, value, System.monotonic_time(:second) + ttl})
    Enum.each(tags, &:ets.insert(@tags, {&1, key}))
    value
  end

  defp log_miss(key, reason) do
    require Logger
    Logger.debug("[bd] read failed for #{key}: #{inspect(reason)} — using fallback")
    true
  end
end
