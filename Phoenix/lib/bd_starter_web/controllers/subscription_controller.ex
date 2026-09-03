defmodule BdStarterWeb.SubscriptionController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Resources.Subscriptions

  def index(conn, _params), do: render(conn, :index, plans: Bd.subscription_plans())

  def checkout(conn, %{"id" => id}) do
    urls = %{
      successUrl: url(~p"/subscriptions") <> "?status=success",
      cancelUrl: url(~p"/subscriptions") <> "?status=cancelled"
    }

    result =
      case Bd.client() do
        nil -> nil
        client -> Subscriptions.checkout(client, id, urls)
      end

    case result do
      {:ok, %{"stripeUrl" => stripe_url}} ->
        redirect(conn, external: stripe_url)

      _ ->
        conn
        |> put_flash(:error, "Could not start checkout.")
        |> redirect(to: ~p"/subscriptions")
    end
  end
end
