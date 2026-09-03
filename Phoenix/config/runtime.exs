import Config

# ═══════════════════════════════════════════════════════════════════════════
# BD configuration.
#
# Read at RUNTIME, not compile time, so the same release binary works across
# environments and a key rotation needs a restart rather than a rebuild.
#
# There is no public-prefix convention to get wrong here: Elixir has no
# bundler inlining values into a browser bundle, so nothing below is exposed
# unless a template prints it.
# ═══════════════════════════════════════════════════════════════════════════

config :bd_starter,
  bd_host: System.get_env("BD_HOST", "https://www.biab.app"),
  bd_site_id: System.get_env("BD_SITE_ID"),
  bd_api_key: System.get_env("BD_API_KEY"),
  bd_publishable_key: System.get_env("BD_PK"),
  bd_revalidation_secret: System.get_env("BD_REVALIDATION_SECRET"),
  bd_auth_callback_url: System.get_env("BD_AUTH_CALLBACK_URL"),
  bd_site_origin: System.get_env("BD_SITE_ORIGIN", "http://localhost:4000"),
  bd_cache_ttl: String.to_integer(System.get_env("BD_CACHE_TTL", "300"))

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE is missing. Generate one with: mix phx.gen.secret"

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :bd_starter, BdStarterWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base
end
