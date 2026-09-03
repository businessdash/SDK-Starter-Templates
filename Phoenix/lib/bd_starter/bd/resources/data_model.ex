defmodule BdStarter.Bd.Resources.DataModel do
  @moduledoc """
  The org's CUSTOM DATABASE — the tables declared in
  `bd.data-model.config.ts` and pushed with `npm run sync-data-model`.

  Distinct from Site Data collections. Reads need `metadata:read_records` on
  the key; without it the platform answers `available: false` and the client
  returns `{:error, {:access_rejected, …}}`.

  Writes go through `Forms.submit/4` against the generated form — the
  documented create path. There is no direct row-insert API for consumers.

  `object` is the object's `universalIdentifier`, NOT its display name: the
  name can be renamed in the dashboard without breaking this code.
  """

  alias BdStarter.Bd.Client

  def list(client, object, opts \\ []) do
    Client.get(client, Client.site_path(client, "data-model/records"),
      object: object,
      limit: opts[:limit],
      cursor: opts[:cursor]
    )
  end

  @doc """
  Page through everything, returning `{:ok, records}`.

  Bounded at 50 pages so a malformed cursor can't spin forever — a read path
  that never terminates is worse than one that returns a short answer.
  """
  def all(client, object, page_size \\ 200) do
    {:ok, collect(client, object, page_size, nil, [], 0)}
  end

  defp collect(_client, _object, _size, _cursor, acc, page) when page >= 50, do: acc

  defp collect(client, object, size, cursor, acc, page) do
    case list(client, object, limit: size, cursor: cursor) do
      {:ok, %{"records" => records} = body} ->
        acc = acc ++ records

        case body["nextCursor"] do
          nil -> acc
          next -> collect(client, object, size, next, acc, page + 1)
        end

      _ ->
        acc
    end
  end
end
