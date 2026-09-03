defmodule BdStarter.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: BdStarter.PubSub},
      # Tag-addressed read cache. Starts before the endpoint so the first
      # request can't race an uninitialised ETS table.
      BdStarter.Bd.Cache,
      # One poller per open Front Desk chat session — see ChatSession.
      {Registry, keys: :unique, name: BdStarter.ChatRegistry},
      {DynamicSupervisor, strategy: :one_for_one, name: BdStarter.ChatSupervisor},
      BdStarterWeb.Endpoint
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: BdStarter.Supervisor)
  end

  @impl true
  def config_change(changed, _new, removed) do
    BdStarterWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
