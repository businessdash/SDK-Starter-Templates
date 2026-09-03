defmodule BdStarter.Bd.Auth do
  @moduledoc """
  Tenant sign-in / sign-up / sign-out.

      GET  /api/bd-auth/sign-in?returnTo=/my-account
           → POST auth/start → 302 to the platform-hosted auth page
      GET  /api/bd-auth/callback?code=…&state=…
           → POST auth/exchange → httpOnly `bd_session` cookie → 302 returnTo
      GET  /api/bd-auth/sign-out
           → POST auth/sign-out → clear the cookie → 302 home

  The cookie lives on THIS app's domain, so ordinary plugs and HEEx can read
  it. The bearer key never leaves the server, and the browser holds nothing
  but its own opaque session value.

  ⚠️ `auth/me` takes the session in a lowercase **`x-bd-session`** header.
  This differs from the `X-BD-Session-Token` used by cart and customer-portal
  routes. Sending the wrong one looks like "signed out", not like an error.
  """

  alias BdStarter.Bd.Client

  def callback_url, do: Application.get_env(:bd_starter, :bd_auth_callback_url)

  @doc "Where to send the browser to begin. `intent` is \"sign-in\" or \"sign-up\"."
  def start_url(client, intent, return_to, login_hint \\ nil) do
    body =
      %{
        intent: if(intent == "sign-up", do: "sign-up", else: "sign-in"),
        returnTo: absolutize(return_to),
        redirectUri: callback_url()
      }
      |> then(&if(login_hint, do: Map.put(&1, :loginHint, login_hint), else: &1))

    case Client.post(client, "auth/start", body) do
      {:ok, %{"url" => url}} -> {:ok, url}
      {:ok, _} -> {:error, :no_url}
      error -> error
    end
  end

  @doc "Trade the callback's `code` for a session."
  def exchange(client, code, state) do
    Client.post(client, "auth/exchange", %{
      code: code,
      state: state,
      redirectUri: callback_url()
    })
  end

  @doc """
  Validate a cookie value. `nil` for absent / expired / revoked — never an
  error tuple, so a stale cookie renders a signed-out page rather than a 500.
  """
  def session(_client, nil), do: nil
  def session(nil, _cookie), do: nil

  def session(client, cookie) do
    case Client.get(client, "auth/me", [], [{"x-bd-session", cookie}]) do
      {:ok, %{"user" => _} = session} -> session
      _ -> nil
    end
  end

  @doc "Best effort — the cookie is cleared either way."
  def sign_out(nil), do: :ok

  def sign_out(client) do
    Client.post(client, "auth/sign-out")
    :ok
  end

  @doc """
  The platform round-trips `returnTo` inside the OAuth `state` as base64url
  JSON.

  Decoded defensively and reduced to a PATH: a malformed or hostile state is a
  redirect target an attacker controls, so an absolute URL in there must never
  survive to a `redirect(external:)`.
  """
  def return_to_from_state(nil, fallback), do: fallback

  def return_to_from_state(state, fallback) do
    with {:ok, json} <- Base.url_decode64(state, padding: false),
         {:ok, %{"returnTo" => return_to}} when is_binary(return_to) <- Jason.decode(json),
         %URI{path: path} = uri when is_binary(path) <- URI.parse(return_to) do
      if uri.query, do: path <> "?" <> uri.query, else: path
    else
      _ -> fallback
    end
  end

  defp absolutize("http://" <> _ = url), do: url
  defp absolutize("https://" <> _ = url), do: url

  defp absolutize(path) do
    origin = Application.get_env(:bd_starter, :bd_site_origin, "http://localhost:4000")
    String.trim_trailing(origin, "/") <> "/" <> String.trim_leading(path, "/")
  end
end
