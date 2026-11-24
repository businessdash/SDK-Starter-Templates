defmodule BdStarter.MixProject do
  use Mix.Project

  def project do
    [
      app: :bd_starter,
      version: "0.1.0",
      elixir: "~> 1.16",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      mod: {BdStarter.Application, []},
      extra_applications: [:logger, :crypto]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:phoenix, "~> 1.7.25"},
      {:phoenix_html, "~> 4.4"},
      {:phoenix_live_view, "~> 1.0 and >= 1.0.20"},
      {:jason, "~> 1.4"},
      {:bandit, "~> 1.14 and >= 1.14.1"},
      # The only client dependency. There is no Elixir BD package — the
      # Package API is plain REST with a bearer key.
      {:req, "~> 0.6 and >= 0.6.1"},
      # For Ecto.UUID.generate/0 only (cart visitor + chat session ids). No
      # repo, no database — this starter stores nothing locally.
      {:ecto, "~> 3.14 and >= 3.14.3"},
      {:esbuild, "~> 0.8", runtime: Mix.env() == :dev},
      {:phoenix_live_reload, "~> 1.5", only: :dev}
    ]
  end
end
