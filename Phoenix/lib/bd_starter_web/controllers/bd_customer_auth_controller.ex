defmodule BdStarterWeb.BdCustomerAuthController do
  @moduledoc """
  The customer sign-in routes at `/api/bd-auth/customer/*path` — the Elixir
  twin of the JS SDK's `createAuthHandler` customer routes, for apps and pages
  that bring their own screen. The sign-in screen on /my-account
  (`BdStarterWeb.SignInLive`) runs the same steps through
  `BdStarter.Bd.CustomerAuth`; the oauth routes here are its
  "Continue with …" links.

      GET  options                      the business's name, colours, providers
      POST sign-in | verify | id-token  → sets the httpOnly `bd_session` cookie
      POST sign-up | forgot-password    → %{pendingId, expiresAt} (a code is sent)
      GET  oauth/google|apple|github|discord?returnTo=/path
           → PKCE verifier in a short httpOnly cookie, then to WorkOS's link
      GET  oauth/callback?bd_oauth_code=…
           → redeemed with that verifier, `bd_session` set, back to returnTo

  Every step is BD's `auth/customer/*`, which runs it through WorkOS — the
  same accounts as BD's hosted sign-in. The key stays on this server and the
  session token never reaches page scripts.

  POSTs must be JSON (a cross-site form can't send that without a CORS
  preflight), which is why these routes skip the :browser pipeline's CSRF
  check — there's no session to hold a token yet anyway.
  """
  use BdStarterWeb, :controller

  alias BdStarter.Bd
  alias BdStarter.Bd.Client
  alias BdStarter.Bd.CustomerAuth

  @providers ~w(apple google github discord)
  @pkce_cookie "bd_oauth_pkce"
  @oauth_path "/api/bd-auth/customer/oauth"

  def handle(conn, %{"path" => segments}) do
    conn = fetch_cookies(conn)

    case {Bd.client(), segments} do
      {nil, _} -> problem(conn, 503, "unavailable", "Sign-in isn't set up yet.")
      {client, ["oauth", "callback"]} -> oauth_callback(conn, client)
      {client, ["oauth", provider]} -> oauth_start(conn, client, provider)
      {client, [path]} -> customer(conn, client, path, CustomerAuth.route(path))
      _ -> problem(conn, 404, "not_found", "Not found.")
    end
  end

  # ── password, codes, Apple / Google ID tokens ──────────────────────────────

  defp customer(conn, _client, _path, nil), do: problem(conn, 404, "not_found", "Not found.")

  defp customer(conn, client, path, {method, _signs_in}) do
    cond do
      conn.method != method ->
        problem(conn, 405, "method_not_allowed", "Use #{method} for customer/#{path}.")

      method == "POST" and not json?(conn) ->
        problem(conn, 415, "unsupported_media_type", "Send JSON (Content-Type: application/json).")

      # Plug.Parsers puts a top-level JSON array under "_json".
      method == "POST" and Map.has_key?(conn.body_params, "_json") ->
        problem(conn, 400, "invalid_json", "Check the form and try again.")

      method == "POST" ->
        client |> CustomerAuth.forward(path, conn.body_params) |> reply(conn)

      true ->
        client |> CustomerAuth.forward(path) |> reply(conn)
    end
  end

  defp reply({:answered, body}, conn), do: send_json(conn, 200, body)
  defp reply({:refused, status, code, message}, conn), do: problem(conn, status, code, message)

  defp reply({:signed_in, token, age, body}, conn) do
    # The token goes in the httpOnly cookie, never to the page.
    conn
    |> CustomerAuth.put_session_cookie(token, age)
    |> send_json(200, %{
      user: body["user"],
      organizationId: body["organizationId"],
      role: body["role"],
      expiresAt: body["expiresAt"]
    })
  end

  # ── "Continue with Google / Apple / GitHub / Discord" ──────────────────────

  defp oauth_start(%{method: "GET"} = conn, client, provider) when provider in @providers do
    return_to = same_path(conn.params["returnTo"]) || "/my-account"
    verifier = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    challenge = Base.url_encode64(:crypto.hash(:sha256, verifier), padding: false)

    body = %{
      provider: provider,
      redirectUri: origin(conn, client) <> @oauth_path <> "/callback",
      returnTo: return_to,
      codeChallenge: challenge
    }

    case Client.once(client, :post, "auth/customer/oauth/start", body) do
      {:ok, status, %{"url" => url}} when status in 200..299 and is_binary(url) ->
        conn
        |> put_resp_cookie(@pkce_cookie, verifier,
          http_only: true,
          same_site: "Lax",
          secure: conn.scheme == :https,
          max_age: 600,
          path: @oauth_path
        )
        |> put_resp_header("cache-control", "no-store")
        |> redirect(external: url)

      result ->
        land(conn, return_to, %{
          "bd_oauth_error" => "failed",
          "bd_oauth_message" =>
            message(result, "That sign-in isn't available just now. Try again, or use your email.")
        })
    end
  end

  defp oauth_start(%{method: "GET"} = conn, _client, _provider),
    do: problem(conn, 404, "not_found", "Not found.")

  defp oauth_start(conn, _client, provider),
    do: problem(conn, 405, "method_not_allowed", "Use GET for customer/oauth/#{provider}.")

  defp oauth_callback(%{method: "GET"} = conn, client) do
    params = conn.params
    return_to = same_path(params["bd_return_to"]) || "/my-account"
    verifier = conn.req_cookies[@pkce_cookie]
    conn = delete_resp_cookie(conn, @pkce_cookie, path: @oauth_path)

    case params do
      %{"bd_oauth_error" => failed} when is_binary(failed) and failed != "" ->
        land(conn, return_to, %{
          "bd_oauth_error" => if(failed == "cancelled", do: "cancelled", else: "failed"),
          "bd_oauth_message" => present(params["bd_oauth_message"]) || "Sign-in didn't finish. Try again."
        })

      %{"bd_oauth_code" => code}
      when is_binary(code) and code != "" and is_binary(verifier) and verifier != "" ->
        exchange = %{code: code, codeVerifier: verifier}

        with {:ok, status, %{"sessionToken" => token, "expiresAt" => expires_at}}
             when status in 200..299 and is_binary(token) and is_binary(expires_at) <-
               Client.once(client, :post, "auth/customer/oauth/exchange", exchange),
             age when is_integer(age) <- CustomerAuth.max_age(expires_at) do
          conn |> CustomerAuth.put_session_cookie(token, age) |> land(return_to, %{})
        else
          result ->
            land(conn, return_to, %{
              "bd_oauth_error" => "failed",
              "bd_oauth_message" => message(result, "Sign-in didn't finish. Try again.")
            })
        end

      _ ->
        land(conn, return_to, %{
          "bd_oauth_error" => "failed",
          "bd_oauth_message" => "That sign-in took too long, or started in another browser. Try again."
        })
    end
  end

  defp oauth_callback(conn, _client),
    do: problem(conn, 405, "method_not_allowed", "Use GET for customer/oauth/callback.")

  # ── helpers ────────────────────────────────────────────────────────────────

  # BD_SITE_ORIGIN, else this request's own origin.
  defp origin(conn, client) do
    case Client.site_origin(client) do
      "" -> URI.to_string(%URI{scheme: Atom.to_string(conn.scheme), host: conn.host, port: conn.port})
      configured -> configured
    end
  end

  defp land(conn, path, params) do
    query =
      cond do
        params == %{} -> ""
        String.contains?(path, "?") -> "&" <> URI.encode_query(params)
        true -> "?" <> URI.encode_query(params)
      end

    conn
    |> put_resp_header("location", path <> query)
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(303, "")
  end

  # A path on this site, or nil: one leading `/`, no `//`, `\` or control characters.
  defp same_path("/" <> _ = raw) do
    if String.starts_with?(raw, "//") or Regex.match?(~r/[\\\x00-\x1f\x7f]/, raw),
      do: nil,
      else: raw
  end

  defp same_path(_), do: nil

  defp message({:ok, _status, %{"message" => m}}, _fallback) when is_binary(m) and m != "", do: m
  defp message(_result, fallback), do: fallback

  defp present(value) when is_binary(value) and value != "", do: value
  defp present(_), do: nil

  defp json?(conn) do
    conn
    |> get_req_header("content-type")
    |> Enum.any?(&String.starts_with?(String.downcase(&1), "application/json"))
  end

  defp send_json(conn, status, body) do
    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_status(status)
    |> json(body)
  end

  defp problem(conn, status, code, message),
    do: send_json(conn, status, %{error: code, message: message})
end
