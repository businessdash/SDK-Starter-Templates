defmodule BdStarterWeb.Plugs.CacheBodyReader do
  @moduledoc """
  Stashes the raw request body so the webhook can verify its HMAC.

  `Plug.Parsers` reads the body stream to exhaustion and hands you a decoded
  map. The raw bytes are gone by the time a controller runs, and re-encoding
  the map produces different bytes — different key order, different whitespace
  — so the signature never matches. The failure looks exactly like a wrong
  secret, which is why this costs people hours.

  Wired in `endpoint.ex`:

      plug Plug.Parsers,
        parsers: [:urlencoded, :multipart, :json],
        body_reader: {BdStarterWeb.Plugs.CacheBodyReader, :read_body, []},
        json_decoder: Phoenix.json_library()

  Only the webhook path is cached — every other request drops its body as
  usual, so this doesn't double the memory cost of ordinary form posts.
  """

  @cached_paths ["/api/bd/revalidate"]

  def read_body(conn, opts) do
    {:ok, body, conn} = Plug.Conn.read_body(conn, opts)

    if conn.request_path in @cached_paths do
      {:ok, body, Plug.Conn.assign(conn, :raw_body, body)}
    else
      {:ok, body, conn}
    end
  end
end
