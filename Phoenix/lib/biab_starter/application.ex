defmodule BiabStarter.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: BiabStarter.PubSub},
      # Tag-addressed read cache. Starts before the endpoint so the first
      # request can't race an uninitialised ETS table.
      BiabStarter.Biab.Cache,
      # One poller per open Front Desk chat session — see ChatSession.
      {Registry, keys: :unique, name: BiabStarter.ChatRegistry},
      {DynamicSupervisor, strategy: :one_for_one, name: BiabStarter.ChatSupervisor},
      BiabStarterWeb.Endpoint
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: BiabStarter.Supervisor)
  end

  @impl true
  def config_change(changed, _new, removed) do
    BiabStarterWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
