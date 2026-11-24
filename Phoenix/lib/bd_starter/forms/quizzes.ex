defmodule BdStarter.Forms.Quizzes do
  @moduledoc """
  BD's quizzes (`/api/package/v1/quizzes/…`) with this server's secret key,
  as the visitor when they're signed in (an invitation can require the
  invited account). Every call raises `FormsError` with a message for the taker.
  """

  alias BdStarter.Forms.{FormsError, Json, QuizBackend, QuizScoring}

  defstruct [:endpoint, :api_key, :origin, :session_token]

  @doc "From config, or nil until BD_API_KEY and BD_SITE_ID are set."
  def from_config(session_token \\ nil) do
    host = Application.get_env(:bd_starter, :bd_host)
    key = Application.get_env(:bd_starter, :bd_api_key)

    if host not in [nil, ""] and key not in [nil, ""] and Application.get_env(:bd_starter, :bd_site_id) not in [nil, ""] do
      %__MODULE__{
        endpoint: String.trim_trailing(host, "/") <> "/api/package/v1/quizzes",
        api_key: key,
        origin: String.trim_trailing(Application.get_env(:bd_starter, :bd_site_origin) || "", "/"),
        session_token: if(session_token in [nil, ""], do: nil, else: session_token)
      }
    end
  end

  # Path segments, each escaped as one.
  defp call(q, parts, method \\ :get, body \\ nil) do
    url = q.endpoint <> "/" <> Enum.map_join(parts, "/", &URI.encode(&1, fn c -> URI.char_unreserved?(c) end))

    headers =
      [{"accept", "application/json"}, {"origin", q.origin}, {"x-bd-client", "phoenix-quiz/1"}] ++
        if(q.session_token, do: [{"x-bd-session-token", q.session_token}], else: []) ++
        if(body != nil, do: [{"content-type", "application/json"}], else: [])

    opts = [method: method, url: url, auth: {:bearer, q.api_key}, headers: headers, receive_timeout: 15_000, retry: false, decode_body: false]
    opts = if body != nil, do: Keyword.put(opts, :body, Json.encode!(body)), else: opts

    case Req.request(opts) do
      {:ok, %Req.Response{status: status, body: raw}} ->
        json =
          try do
            Json.decode!(raw)
          rescue
            _ -> nil
          end

        cond do
          status not in 200..299 ->
            raise FormsError, message: Json.str(Json.get(json, "message")) || "BD returned #{status}.", status: status

          not Json.object?(json) ->
            raise FormsError, message: "BD sent something unexpected."

          true ->
            json
        end

      {:error, _} ->
        raise FormsError, message: "Could not reach BD."
    end
  end

  defp start_info(o) do
    %{
      started_at: o["startedAt"],
      deadline_at: o["deadlineAt"],
      server_now: Json.num(o["serverNow"]) || System.os_time(:microsecond) / 1000
    }
  end

  def invitation(q, token), do: call(q, ["invitations", token])
  def practice(q, slug), do: call(q, [slug])

  def invitation_backend(q, token) do
    %QuizBackend{
      submit: fn answers, _ids ->
        QuizScoring.read_completion(call(q, ["invitations", token, "submit"], :post, %{"answers" => answers}))
      end,
      start: fn -> start_info(call(q, ["invitations", token, "start"], :post)) end,
      save_draft: fn answers -> call(q, ["invitations", token, "draft"], :post, %{"answers" => answers}) end,
      lock_answer: fn field_id, answer ->
        QuizScoring.read_result(Json.get(call(q, ["invitations", token, "lock"], :post, %{"fieldId" => field_id, "answer" => answer}), "result"))
      end
    }
  end

  def practice_backend(q, slug) do
    %QuizBackend{
      submit: fn answers, ids ->
        QuizScoring.read_completion(call(q, [slug, "score"], :post, %{"answers" => answers, "questionFieldIds" => ids}))
      end,
      lock_answer: fn field_id, answer ->
        QuizScoring.read_result(call(q, [slug, "check"], :post, %{"fieldId" => field_id, "answer" => answer}))
      end
    }
  end
end
