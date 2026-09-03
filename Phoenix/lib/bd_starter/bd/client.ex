defmodule BdStarter.Bd.Client do
  @moduledoc """
  Transport for the BD Package API.

  Deliberately thin — the platform surface is plain REST with a bearer key, so
  this is a wrapper around `Req` rather than a port of the TypeScript SDK.
  Responses come back as plain maps with string keys.

  Two things it does NOT leave to callers, because getting them wrong fails
  quietly rather than loudly:

    1. **The access gate.** A read against a lapsed plan answers HTTP **200**
       with `{"available": false, …}` in the BODY — reads use a body-only
       signal so a cached CDN response can't hard-fail a page. A client that
       only pattern-matches on status renders a silently empty section.
    2. **The `Origin` header.** Server-to-server calls carry no browser origin,
       but the platform gates on it, so it is sent explicitly from config.

  Every function returns `{:ok, body}` or `{:error, reason}` — nothing raises,
  because a marketing page must not 500 because a CMS read blipped.
  """

  @type t :: %{
          base_url: String.t(),
          api_key: String.t(),
          site_id: String.t(),
          origin: String.t()
        }

  @type error ::
          {:access_rejected, reason :: String.t(), message :: String.t()}
          | {:http, status :: integer(), body :: term()}
          | {:transport, term()}

  @doc """
  Build a client from application config.

  Returns `nil` when BD isn't configured. That is a supported state, not an
  error: every section falls back to local content, so `mix phx.server` on a
  fresh clone renders a complete site with no credentials at all.
  """
  @spec new() :: t() | nil
  def new do
    host = env(:bd_host)
    key = env(:bd_api_key)
    site_id = env(:bd_site_id)

    if host && key && site_id do
      %{
        base_url: String.trim_trailing(host, "/") <> "/api/package/v1",
        api_key: key,
        site_id: site_id,
        origin: String.trim_trailing(env(:bd_site_origin) || "", "/")
      }
    end
  end

  @doc "Path prefix for every site-scoped route."
  @spec site_path(t(), String.t()) :: String.t()
  def site_path(client, suffix) do
    "sites/" <> URI.encode(client.site_id, &URI.char_unreserved?/1) <> "/" <> suffix
  end

  @spec get(t(), String.t(), keyword(), list()) :: {:ok, map()} | {:error, error()}
  def get(client, path, query \\ [], headers \\ []) do
    request(client, :get, path, params: clean(query), headers: headers)
  end

  @spec post(t(), String.t(), map() | nil, list()) :: {:ok, map()} | {:error, error()}
  def post(client, path, body \\ nil, headers \\ []) do
    request(client, :post, path, json: body || %{}, headers: headers)
  end

  @spec patch(t(), String.t(), map(), list()) :: {:ok, map()} | {:error, error()}
  def patch(client, path, body, headers \\ []) do
    request(client, :patch, path, json: body, headers: headers)
  end

  @spec delete(t(), String.t(), list()) :: {:ok, map()} | {:error, error()}
  def delete(client, path, headers \\ []) do
    request(client, :delete, path, headers: headers)
  end

  # ── Internals ─────────────────────────────────────────────────────────────

  defp request(nil, _method, _path, _opts), do: {:error, {:transport, :not_configured}}

  defp request(client, method, path, opts) do
    headers =
      [{"accept", "application/json"}, {"origin", client.origin}] ++
        Keyword.get(opts, :headers, [])

    opts =
      opts
      |> Keyword.drop([:headers])
      |> Keyword.merge(
        method: method,
        url: client.base_url <> "/" <> String.trim_leading(path, "/"),
        auth: {:bearer, client.api_key},
        headers: headers,
        receive_timeout: 15_000,
        retry: :transient,
        max_retries: 2
      )

    opts |> Req.request() |> handle()
  rescue
    # Req can raise on malformed URLs / encoding problems. A page must not 500
    # because of one bad read.
    e -> {:error, {:transport, e}}
  end

  # Access gate FIRST — it arrives with a 200 on reads, so a status-only match
  # above this clause would let an empty page through as success.
  defp handle({:ok, %Req.Response{body: %{"available" => false} = body}}) do
    {:error, {:access_rejected, body["reason"], body["message"]}}
  end

  defp handle({:ok, %Req.Response{status: status, body: body}}) when status in 200..299 do
    {:ok, if(is_map(body), do: body, else: %{})}
  end

  defp handle({:ok, %Req.Response{status: status, body: body}}), do: {:error, {:http, status, body}}
  defp handle({:error, reason}), do: {:error, {:transport, reason}}

  @doc """
  True when a failure means the org's site is lapsed or suspended, as opposed
  to a transient blip. Callers that want to show a specific notice branch on
  this; everything else just falls back to local content.
  """
  @spec unavailable?(error()) :: boolean()
  def unavailable?({:access_rejected, reason, _}) when reason in ~w(payment_required service_suspended),
    do: true

  def unavailable?(_), do: false

  # Drop nils and render booleans as "true"/"false" — Req would otherwise send
  # them in a shape the platform's query parser doesn't recognise.
  defp clean(query) do
    query
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Enum.map(fn
      {k, v} when is_boolean(v) -> {k, to_string(v)}
      pair -> pair
    end)
  end

  defp env(key) do
    case Application.get_env(:bd_starter, key) do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end
end
