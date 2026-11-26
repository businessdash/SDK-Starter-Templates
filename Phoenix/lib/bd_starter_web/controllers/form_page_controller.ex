defmodule BdStarterWeb.FormPageController do
  @moduledoc """
  Forms and quizzes, drawn on this server (`BdStarterWeb.FormLive` and `QuizLive`):

      /forms/:slug          any form from the dashboard (the home page's contact section is one)
      /forms/demo           the bundled sample form, checked here and never sent
      /quiz                 BD_QUIZ (a practice quiz), or the bundled sample
      /quiz/:slug           any practice quiz ("Practice on your site" in BD)
      /quiz/sample          the sample: graded here, never sent anywhere
      /quiz-invite/:token   an invitation. BD's invite emails link here when the
                            quiz's invite domain (in the builder) is this site.
  """
  use BdStarterWeb, :controller

  alias BdStarter.Forms
  alias BdStarter.Forms.QuizRuns

  @run_cookie "bd_quiz_run"

  def form(conn, %{"slug" => slug}) do
    title =
      try do
        Forms.schema!(slug).title
      rescue
        _ -> nil
      end

    render(conn, :form, slug: slug, page_title: if(title in [nil, ""], do: "Form", else: title))
  end

  def quiz(conn, params) do
    slug = params["slug"] || Forms.quiz_slug()

    if slug == Forms.sample_quiz(),
      do: page(conn, "sample", ""),
      else: page(conn, "practice", slug)
  end

  def invitation(conn, %{"token" => token}), do: page(conn, "invitation", token)

  # The run this page shows: a practice run or the sample comes back to the
  # one this browser started (the cookie); an invitation is read from BD each
  # visit. Either way the id goes to the LiveView, so its first render and its
  # connected mount share one run.
  defp page(conn, source, ref) do
    conn = fetch_cookies(conn)

    remembered =
      with false <- source == "invitation",
           {:ok, run} <- Ecto.UUID.cast(conn.cookies[@run_cookie] || ""),
           %{source: ^source, ref: ^ref} <- QuizRuns.get(run) do
        run
      else
        _ -> nil
      end

    run = remembered || Ecto.UUID.generate()

    conn =
      if source != "invitation" and remembered == nil,
        do:
          put_resp_cookie(conn, @run_cookie, run,
            max_age: QuizRuns.ttl_seconds(),
            http_only: true,
            same_site: "Lax"
          ),
        else: conn

    conn
    # A run's answers and clock: never from a cache.
    |> put_resp_header("cache-control", "no-store")
    |> render(:quiz,
      page_title: "Quiz",
      session: %{
        "source" => source,
        "ref" => ref,
        "run" => run,
        "session_token" => session_token(conn)
      }
    )
  end

  # The visitor's BD session, for an invitation that needs the invited account.
  defp session_token(conn) do
    case conn.cookies[Application.get_env(:bd_starter, :bd_session_cookie, "bd_session")] do
      token when is_binary(token) and token != "" -> token
      _ -> nil
    end
  end
end
