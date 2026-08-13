import Config

# ═══════════════════════════════════════════════════════════════════════════
# BIAB configuration.
#
# Read at RUNTIME, not compile time, so the same release binary works across
# environments and a key rotation needs a restart rather than a rebuild.
#
# There is no public-prefix convention to get wrong here: Elixir has no
# bundler inlining values into a browser bundle, so nothing below is exposed
# unless a template prints it.
# ═══════════════════════════════════════════════════════════════════════════

config :biab_starter,
  biab_host: System.get_env("BIAB_HOST", "https://www.biab.app"),
  biab_site_id: System.get_env("BIAB_SITE_ID"),
  biab_api_key: System.get_env("BIAB_API_KEY"),
  biab_publishable_key: System.get_env("BIAB_PK"),
  biab_revalidation_secret: System.get_env("BIAB_REVALIDATION_SECRET"),
  biab_auth_callback_url: System.get_env("BIAB_AUTH_CALLBACK_URL"),
  biab_site_origin: System.get_env("BIAB_SITE_ORIGIN", "http://localhost:4000"),
  biab_cache_ttl: String.to_integer(System.get_env("BIAB_CACHE_TTL", "300"))

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE is missing. Generate one with: mix phx.gen.secret"

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :biab_starter, BiabStarterWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base
end
