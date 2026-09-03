defmodule BdStarter.Bd.Resources.Followers do
  @moduledoc """
  Newsletter / update subscribers.

  Followers ride the site ACTIONS endpoint rather than a route of their own:
  `POST sites/{siteId}/actions/{actionName}` with the arguments wrapped in a
  `payload` envelope. Same envelope for every named action, so `run/3` works
  for any other action the org exposes.
  """

  alias BdStarter.Bd.Client

  def join(client, email, name \\ nil) do
    payload = %{email: email} |> then(&if(name, do: Map.put(&1, :name, name), else: &1))
    run(client, "followers.join", Map.put(payload, :source, "phoenix-starter"))
  end

  def me(client, email), do: run(client, "followers.me", %{email: email})

  def run(client, action_name, payload \\ %{}) do
    Client.post(client, Client.site_path(client, "actions/#{enc(action_name)}"), %{payload: payload})
  end

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
