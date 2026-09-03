defmodule BdStarterWeb.BdAuthController do
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Auth

  @doc """
  The whole tenant-auth flow, mounted at `/api/bd-auth/:action`.

  `BD_AUTH_CALLBACK_URL` must point at this route's `callback` action AND be
  registered as a redirect URI on the BD site, or `auth/start` refuses.
  """
  def handle(conn, %{"action" => action} = params) do
    case {Bd.client(), action} do
      {nil, _} ->
        send_resp(conn, 503, "BD auth is not configured.")

      {client, a} when a in ["sign-in", "sign-up"] ->
        start(conn, client, a, params)

      {client, "callback"} ->
        callback(conn, client, params)

      {client, "sign-out"} ->
        sign_out(conn, client)

      _ ->
        send_resp(conn, 404, "Not found")
    end
  end

  defp start(conn, client, intent, params) do
    return_to = Map.get(params, "returnTo", "/my-account")

    case Auth.start_url(client, intent, return_to, Map.get(params, "loginHint")) do
      {:ok, url} ->
        redirect(conn, external: url)

      {:error, reason} ->
        # Plain text, not an exception page: this almost always means the API
        # key is missing the `tenant_auth:public` scope or the callback URL
        # isn't registered, and the message should say so.
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(502, """
        Sign-in could not start.

        #{inspect(reason)}

        Check that the API key carries the tenant_auth scope and that
        BD_AUTH_CALLBACK_URL is registered as a redirect URI on the site.
        """)
    end
  end

  defp callback(conn, client, params) do
    with code when is_binary(code) and code != "" <- Map.get(params, "code"),
         state when is_binary(state) and state != "" <- Map.get(params, "state"),
         {:ok, %{"sessionToken" => token} = session} <- Auth.exchange(client, code, state) do
      conn
      |> put_resp_cookie(cookie_name(), token,
        http_only: true,
        same_site: "Lax",
        secure: conn.scheme == :https,
        max_age: max_age(session["expiresAt"])
      )
      |> redirect(to: Auth.return_to_from_state(state, "/my-account"))
    else
      nil -> send_resp(conn, 400, "Missing code or OAuth state")
      "" -> send_resp(conn, 400, "Missing code or OAuth state")
      {:error, reason} -> send_resp(conn, 400, "Sign-in failed: #{inspect(reason)}")
      _ -> send_resp(conn, 400, "Sign-in failed")
    end
  end

  defp sign_out(conn, client) do
    Auth.sign_out(client)

    conn = delete_resp_cookie(conn, cookie_name(), path: "/")

    if conn.method == "POST" do
      json(conn, %{ok: true})
    else
      redirect(conn, to: ~p"/")
    end
  end

  defp max_age(expires_at) when is_binary(expires_at) do
    case DateTime.from_iso8601(expires_at) do
      {:ok, dt, _} -> max(60, DateTime.diff(dt, DateTime.utc_now()))
      _ -> default_max_age()
    end
  end

  defp max_age(_), do: default_max_age()
  defp default_max_age, do: 60 * 60 * 24 * 7

  defp cookie_name, do: Application.get_env(:bd_starter, :bd_session_cookie, "bd_session")
end
