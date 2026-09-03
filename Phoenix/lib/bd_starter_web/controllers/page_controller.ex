defmodule BdStarterWeb.PageController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd

  def home(conn, _params) do
    render(conn, :home,
      bundle: Bd.page_bundle("home"),
      products: Bd.featured_products(6),
      posts: Bd.posts(3)
    )
  end

  def reviews(conn, params) do
    offset = params |> Map.get("offset", "0") |> to_int()
    render(conn, :reviews, reviews: Bd.reviews(10, offset), offset: offset)
  end

  def updates(conn, _params) do
    render(conn, :updates, updates: Map.get(Bd.page_bundle("home"), "updates", []))
  end

  @doc """
  Newsletter join. Rides the server-side key rather than a publishable token —
  this app renders entirely server-side, so there is no browser client holding
  one.
  """
  def subscribe(conn, params) do
    email = Map.get(params, "email", "")

    flash =
      if valid_email?(email) do
        case Bd.follower_join(email, Map.get(params, "name")) do
          nil -> {:error, "Could not subscribe right now."}
          _ -> {:info, "Thanks — you are on the list."}
        end
      else
        {:error, "That email doesn't look right."}
      end

    {kind, message} = flash

    conn
    |> put_flash(kind, message)
    |> redirect(to: ~p"/")
  end

  defp valid_email?(email), do: is_binary(email) and String.match?(email, ~r/^[^@\s]+@[^@\s]+\.[^@\s]+$/)

  defp to_int(value) do
    case Integer.parse(to_string(value)) do
      {n, _} when n >= 0 -> n
      _ -> 0
    end
  end
end
