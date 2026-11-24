defmodule BdStarter.Bd.CustomerAuth do
  @moduledoc """
  One step of customer sign-in at BD — `auth/customer/*`, which runs it
  through WorkOS. Shared by the JSON routes (`BdStarterWeb.BdCustomerAuthController`,
  for apps and pages that bring their own screen) and the sign-in screen on
  /my-account (`BdStarterWeb.SignInLive`).
  """

  import Plug.Conn, only: [put_resp_cookie: 4]

  alias BdStarter.Bd.Client

  # path => {method, signs someone in}
  @routes %{
    "options" => {"GET", false},
    "sign-in" => {"POST", true},
    "sign-up" => {"POST", false},
    "forgot-password" => {"POST", false},
    "verify" => {"POST", true},
    "id-token" => {"POST", true}
  }

  @unavailable "Sign-in isn't available just now. Try again in a minute."

  @typedoc """
  BD's answer: the business's options or a code on its way (`pendingId`) —
  from sign-in, "confirm your email first"; someone signed in (the token for
  the httpOnly cookie, and its max age in seconds); or BD's own refusal.
  """
  @type answer ::
          {:answered, map()}
          | {:signed_in, String.t(), pos_integer(), map()}
          | {:refused, integer(), String.t(), String.t()}

  def unavailable, do: @unavailable

  @doc "`{method, signs_in}` for a customer path, or nil."
  def route(path), do: Map.get(@routes, path)

  @spec forward(Client.t() | nil, String.t(), map() | nil) :: answer()
  def forward(client, path, body \\ nil) do
    case route(path) do
      nil ->
        {:refused, 404, "not_found", "Not found."}

      {method, signs_in} ->
        client
        |> Client.once(
          if(method == "POST", do: :post, else: :get),
          "auth/customer/" <> path,
          body
        )
        |> answer(signs_in)
    end
  end

  defp answer({:error, _}, _signs_in), do: {:refused, 502, "unavailable", @unavailable}

  # BD's own answer (wrong password, expired code…), passed on.
  defp answer({:ok, status, body}, _signs_in) when status not in 200..299 do
    message =
      case body["message"] do
        m when is_binary(m) and m != "" -> m
        _ when status == 429 -> "That's a lot of tries. Wait a few minutes, then try again."
        _ -> @unavailable
      end

    code =
      case body["error"] do
        c when is_binary(c) -> c
        _ when status == 429 -> "too_many_tries"
        _ -> "unavailable"
      end

    {:refused, if(status in 400..599, do: status, else: 502), code, message}
  end

  defp answer({:ok, _status, body}, false), do: {:answered, body}

  # Sign-in can answer "confirm your email first" (a code was sent).
  defp answer({:ok, _status, %{"pendingId" => pending} = body}, true)
       when is_binary(pending) and not is_map_key(body, "sessionToken"),
       do: {:answered, body}

  defp answer({:ok, _status, %{"sessionToken" => token, "expiresAt" => expires_at} = body}, true)
       when is_binary(token) and is_binary(expires_at) do
    case max_age(expires_at) do
      nil -> {:refused, 502, "unavailable", @unavailable}
      age -> {:signed_in, token, age, body}
    end
  end

  defp answer({:ok, _status, _body}, true), do: {:refused, 502, "unavailable", @unavailable}

  @doc "Seconds until an ISO 8601 instant (at least a minute), or nil."
  def max_age(expires_at) do
    case DateTime.from_iso8601(expires_at) do
      {:ok, dt, _offset} -> max(60, DateTime.diff(dt, DateTime.utc_now()))
      _ -> nil
    end
  end

  @doc "The httpOnly `bd_session` cookie — the token never reaches page scripts."
  def put_session_cookie(conn, token, age) do
    put_resp_cookie(
      conn,
      Application.get_env(:bd_starter, :bd_session_cookie, "bd_session"),
      token,
      http_only: true,
      same_site: "Lax",
      secure: conn.scheme == :https,
      max_age: age,
      path: "/"
    )
  end
end
