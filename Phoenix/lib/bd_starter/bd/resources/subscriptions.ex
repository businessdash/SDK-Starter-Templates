defmodule BdStarter.Bd.Resources.Subscriptions do
  @moduledoc "Subscription plans + the Stripe checkout hand-off for one."

  alias BdStarter.Bd.Client

  def list(client), do: Client.get(client, "subscriptions")
  def get(client, id), do: Client.get(client, "subscriptions/#{enc(id)}")

  def checkout(client, id, urls),
    do: Client.post(client, "subscriptions/#{enc(id)}/checkout", urls)

  defp enc(v), do: URI.encode(to_string(v), &URI.char_unreserved?/1)
end
