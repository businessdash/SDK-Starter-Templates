import Config

config :bd_starter, BdStarterWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "testonlytestonlytestonlytestonlytestonlytestonlytestonlytestonly64",
  server: false

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime
