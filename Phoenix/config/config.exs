import Config

config :bd_starter,
  generators: [timestamp_type: :utc_datetime],
  # Seconds to cache marketing/catalog reads. The revalidate webhook busts
  # these by tag on publish, so this is a floor, not a staleness budget.
  bd_cache_ttl: 300,
  bd_session_cookie: "bd_session",
  bd_cart_cookie: "bd_cart_visitor"

config :bd_starter, BdStarterWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [html: BdStarterWeb.ErrorHTML], layout: false],
  pubsub_server: BdStarter.PubSub,
  live_view: [signing_salt: "bd-live"]

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
