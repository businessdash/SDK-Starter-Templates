defmodule BiabStarterWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :biab_starter

  @session_options [
    store: :cookie,
    key: "_biab_starter_key",
    signing_salt: "biab-starter",
    same_site: "Lax"
  ]

  socket "/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]]

  plug Plug.Static,
    at: "/",
    from: :biab_starter,
    gzip: false,
    only: BiabStarterWeb.static_paths()

  if code_reloading? do
    plug Phoenix.CodeReloader
  end

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  # `body_reader` is what makes the revalidation webhook verifiable. Plug.Parsers
  # consumes the body stream, and re-encoding the decoded map produces different
  # bytes — so the raw payload is stashed on the way past for that one path.
  # Without this the HMAC always mismatches and it looks like a wrong secret.
  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    body_reader: {BiabStarterWeb.Plugs.CacheBodyReader, :read_body, []},
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug BiabStarterWeb.Router
end
