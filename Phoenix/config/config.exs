import Config

config :biab_starter,
  generators: [timestamp_type: :utc_datetime],
  # Seconds to cache marketing/catalog reads. The revalidate webhook busts
  # these by tag on publish, so this is a floor, not a staleness budget.
  biab_cache_ttl: 300,
  biab_session_cookie: "biab_session",
  biab_cart_cookie: "biab_cart_visitor"

config :biab_starter, BiabStarterWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [html: BiabStarterWeb.ErrorHTML], layout: false],
  pubsub_server: BiabStarter.PubSub,
  live_view: [signing_salt: "biab-live"]

config :esbuild,
  version: "0.21.5",
  default: [
    args: ~w(js/app.js --bundle --target=es2020 --outdir=../priv/static/assets),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

config :logger, :console, format: "$time $metadata[$level] $message\n"
config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
