defmodule BdStarterWeb.PortalController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Auth

  @doc """
  Customer portal. Everything here is per-customer, so nothing is cached — a
  cached portal read would serve one customer's jobs to the next.
  """
  def index(conn, _params) do
    case session(conn) do
      nil ->
        redirect(conn, to: "/api/bd-auth/sign-in?returnTo=/my-account")

      session ->
        render(conn, :index,
          user: Map.get(session, "user"),
          work: Bd.portal_work(token(conn), Map.get(session, "organizationId"))
        )
    end
  end

  def submit_review(conn, params) do
    rating = params |> Map.get("rating", "5") |> to_int(5) |> min(5) |> max(1)
    body = params |> Map.get("body", "") |> String.trim()

    case session(conn) do
      nil ->
        redirect(conn, to: "/api/bd-auth/sign-in?returnTo=/my-account")

      _session when body == "" ->
        conn |> put_flash(:error, "A review needs some text.") |> redirect(to: ~p"/my-account")

      session ->
        result =
          Bd.portal_review(token(conn), Map.get(session, "organizationId"), %{
            rating: rating,
            body: body
          })

        conn
        |> put_flash(
          if(result, do: :info, else: :error),
          if(result, do: "Thanks for the review.", else: "Could not submit that review.")
        )
        |> redirect(to: ~p"/my-account")
    end
  end

  defp session(conn) do
    case Bd.client() do
      nil -> nil
      client -> Auth.session(client, token(conn))
    end
  end

  defp token(conn) do
    conn = fetch_cookies(conn)
    cookie = Application.get_env(:bd_starter, :bd_session_cookie, "bd_session")

    case conn.cookies[cookie] do
      value when is_binary(value) and value != "" -> value
      _ -> nil
    end
  end

  defp to_int(value, default) do
    case Integer.parse(to_string(value)) do
      {n, _} -> n
      _ -> default
    end
  end
end
