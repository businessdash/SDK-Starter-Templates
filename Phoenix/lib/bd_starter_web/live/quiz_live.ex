defmodule BdStarterWeb.QuizLive do
  @moduledoc """
  A BusinessDash quiz, drawn on this server (see `BdStarterWeb.FormPageController`).

  The quiz BD's hosted /quiz-invite page shows (one question at a time with
  lettered choices, "I don't know" when the quiz offers it, the verdict and
  why after each answer or all at the end, a timer, the results), run by the
  same engine as every BD starter (`BdStarter.Forms.QuizEngine`, a port of
  forms-core's quiz). This view draws its screen with the SDK's `bd-quiz__*`
  classes; the grading, the clock and the wording are the engine's.

      sample        the bundled sample: graded here, never sent anywhere
      practice      a practice quiz from BD ("Practice on your site"): BD grades, this server times
      invitation    an invitation: BD starts the clock, keeps the answers, grades and records

  A run is kept for three hours (`QuizRuns`). A practice run or the sample
  picks up where this browser left off (the `bd_quiz_run` cookie); an
  invitation is read from BD on each page load, since BD keeps its answers
  and its clock. A running clock ticks once a second here, and a timed quiz
  submits at zero, even if the taker has stopped clicking.
  """
  use BdStarterWeb, :live_view

  require Logger

  alias BdStarter.Forms

  alias BdStarter.Forms.{
    Field,
    FormsError,
    Js,
    Json,
    QuizController,
    QuizOptions,
    QuizPage,
    QuizRuns,
    QuizScoring,
    QuizWords,
    Quizzes
  }

  @sources ~w(sample practice invitation)

  # "I don't know" on a single-answer question: a choice in the same group.
  @dont_know "~dont-know"

  @impl true
  def mount(_params, session, socket) do
    source = if session["source"] in @sources, do: session["source"], else: "sample"
    ref = session["ref"] || ""

    socket =
      assign(socket,
        source: source,
        ref: ref,
        run: session["run"],
        session_token: session["session_token"],
        page: %{header: nil, gate: nil},
        status: nil,
        q: nil
      )

    socket =
      case QuizRuns.get(socket.assigns.run) do
        %{source: ^source, ref: ^ref} = record -> assign(socket, page: record.page, q: record.q)
        _ -> start(socket)
      end

    if connected?(socket), do: schedule_tick()
    {:ok, socket, layout: false}
  end

  @doc "Where this quiz's page is: Try again, and Sign in coming back here."
  def page_path("practice", ref), do: "/quiz/" <> URI.encode(ref, &URI.char_unreserved?/1)

  def page_path("invitation", ref),
    do: "/quiz-invite/" <> URI.encode(ref, &URI.char_unreserved?/1)

  def page_path(_, _), do: "/quiz/" <> Forms.sample_quiz()

  defp sign_in_href(socket),
    do:
      "/my-account?next=" <>
        URI.encode_www_form(page_path(socket.assigns.source, socket.assigns.ref))

  # ── Loading ───────────────────────────────────────────────────────────────

  defp invalid(words),
    do: %{header: nil, gate: %{kind: "invalid", title: nil, body: words.invalid, action: nil}}

  # Read the quiz from BD (or the sample) and start a run, unless a gate is all there is.
  defp start(socket) do
    %{source: source, ref: ref} = socket.assigns
    words = %QuizWords{}

    quizzes =
      if source == "sample", do: nil, else: Quizzes.from_config(socket.assigns.session_token)

    if source != "sample" and quizzes == nil do
      assign(socket, page: invalid(words))
    else
      try do
        data =
          case source do
            "practice" -> Quizzes.practice(quizzes, ref)
            "invitation" -> Quizzes.invitation(quizzes, ref)
            _ -> sample_data()
          end

        page =
          case source do
            "invitation" ->
              QuizPage.invitation(data, words, sign_in_href(socket), "/api/bd-auth/sign-out")

            _ ->
              QuizPage.practice(data, words)
          end

        if page.gate != nil do
          assign(socket, page: page)
        else
          {options, initial} = options(socket, data)
          q = QuizController.new(options, backend: backend(socket, quizzes), initial: initial)
          save(assign(socket, page: page, q: q))
        end
      rescue
        e in FormsError ->
          if e.status == 404 do
            assign(socket,
              page:
                if(source == "invitation",
                  do: QuizPage.invitation(nil, words),
                  else: invalid(words)
                )
            )
          else
            Logger.warning("[bd] quiz #{source} #{ref}: #{Exception.message(e)}")
            assign(socket, status: "We couldn't load this quiz.")
          end

        e ->
          Logger.error(
            "[bd] quiz #{source} #{ref}: " <> Exception.format(:error, e, __STACKTRACE__)
          )

          assign(socket, status: "We couldn't load this quiz.")
      end
    end
  end

  # The sample: answer keys and all, graded on this server.
  defp sample_data do
    file =
      :bd_starter
      |> Application.app_dir("priv/forms/demo-quiz.json")
      |> File.read!()
      |> Json.decode!()

    %{
      "name" => "Sample quiz",
      "description" =>
        "Bundled with the starter and graded on this server. Set BD_QUIZ and your BD keys to take one of your practice quizzes.",
      "estimatedMinutes" => 2.0,
      "timeLimitMinutes" => 5.0,
      "fields" => file["fields"] || []
    }
  end

  # The run's options and where it starts.
  defp options(socket, data) do
    case socket.assigns.source do
      "practice" ->
        {QuizOptions.from_practice(data), %{}}

      "invitation" ->
        {QuizOptions.from_invitation(data, sign_in_href(socket)), initial(data)}

      _ ->
        {%QuizOptions{
           fields: Field.list(data["fields"]),
           feedback_mode: "immediate",
           time_limit_minutes: 5.0,
           allow_dont_know: true
         }, %{}}
    end
  end

  # What BD kept of an invitation: locked answers and verdicts, the clock, a finished attempt.
  defp initial(invitation) do
    %{
      answers: Json.obj(invitation["lockedAnswers"]) || %{},
      results: Enum.map(Json.list(invitation["lockedResults"]) || [], &QuizScoring.read_result/1),
      started_at: Json.str(invitation["startedAt"]),
      deadline_at: Json.str(invitation["deadlineAt"])
    }
    |> then(
      &if(Json.object?(invitation["attempt"]),
        do: Map.put(&1, :completion, QuizScoring.read_completion(invitation["attempt"])),
        else: &1
      )
    )
    |> then(
      &if(Json.number?(invitation["serverNow"]),
        do: Map.put(&1, :server_now, invitation["serverNow"]),
        else: &1
      )
    )
  end

  defp backend(socket, quizzes) do
    case socket.assigns.source do
      "practice" -> Quizzes.practice_backend(quizzes, socket.assigns.ref)
      "invitation" -> Quizzes.invitation_backend(quizzes, socket.assigns.ref)
      _ -> nil
    end
  end

  # Keep the run as this event left it (answers, verdicts, the clock).
  defp save(%{assigns: %{run: run, q: q}} = socket) when is_binary(run) and q != nil do
    QuizRuns.put(run, %{
      source: socket.assigns.source,
      ref: socket.assigns.ref,
      page: socket.assigns.page,
      q: q
    })

    socket
  end

  defp save(socket), do: socket

  # ── What the page asks for ────────────────────────────────────────────────

  @impl true
  def handle_event("answer", params, %{assigns: %{q: q}} = socket) when q != nil do
    {:noreply, socket |> assign(q: apply_answers(q, params)) |> save()}
  end

  # A button: one of the screen's actions, or the primary one (Enter in a box).
  def handle_event("act", params, %{assigns: %{q: q}} = socket) when q != nil do
    q = apply_answers(q, params)
    wanted = params["action"] || "primary"

    action =
      q
      |> QuizController.screen()
      |> Map.fetch!(:actions)
      |> Enum.find(fn a ->
        a.enabled and a.href == nil and
          if(wanted == "primary", do: a.primary, else: a.id == wanted)
      end)

    q = if action, do: QuizController.perform(q, action.id), else: q
    {:noreply, socket |> assign(q: q) |> save()}
  end

  def handle_event(_event, _params, socket), do: {:noreply, socket}

  # The clock, once a second while it runs: at zero the quiz submits.
  @impl true
  def handle_info(:tick, %{assigns: %{q: q}} = socket) when q != nil do
    schedule_tick()

    if QuizController.clock_running?(q) do
      {:noreply, socket |> assign(q: QuizController.tick(q)) |> save()}
    else
      {:noreply, socket}
    end
  end

  def handle_info(:tick, socket) do
    schedule_tick()
    {:noreply, socket}
  end

  defp schedule_tick, do: Process.send_after(self(), :tick, 1000)

  # Each answer the page showed (and didn't lock) → the run, when it changed.
  defp apply_answers(q, params) do
    answers = if is_map(params["answers"]), do: params["answers"], else: %{}
    dk = if is_map(params["dk"]), do: params["dk"], else: %{}

    q
    |> QuizController.screen()
    |> Map.fetch!(:questions)
    |> Enum.reject(& &1.locked)
    |> Enum.filter(&Map.has_key?(answers, &1.field.id))
    |> Enum.reduce(q, fn question, q ->
      id = question.field.id
      raw = answers[id]
      was_dont_know = id in q.state.dont_know
      current = Map.get(q.state.answers, id)

      cond do
        question.choices != nil and question.multiple ->
          picked =
            if is_list(raw),
              do: raw |> Enum.filter(&is_binary/1) |> Enum.reject(&(&1 == "")),
              else: []

          dont_know = dk[id] == "true"
          before = Enum.map(Json.list(current) || [], &Js.string/1)

          cond do
            dont_know and not was_dont_know ->
              QuizController.choose_dont_know(q, id)

            was_dont_know and (picked != [] or not dont_know) ->
              QuizController.set_answer(q, id, picked)

            not was_dont_know and sorted(picked) != sorted(before) ->
              QuizController.set_answer(q, id, picked)

            true ->
              q
          end

        question.choices != nil ->
          picked = if is_binary(raw), do: raw, else: ""

          cond do
            picked == @dont_know ->
              if was_dont_know, do: q, else: QuizController.choose_dont_know(q, id)

            picked != "" and (was_dont_know or picked != current) ->
              QuizController.set_answer(q, id, picked)

            true ->
              q
          end

        true ->
          typed = if is_binary(raw), do: raw, else: ""

          if typed != if(current == nil, do: "", else: Js.string(current)),
            do: QuizController.set_answer(q, id, typed),
            else: q
      end
    end)
  end

  defp sorted(list), do: list |> Enum.uniq() |> Enum.sort()

  # ── The page ──────────────────────────────────────────────────────────────

  @impl true
  def render(assigns) do
    assigns =
      assign(assigns,
        screen: if(assigns.q, do: QuizController.screen(assigns.q)),
        header: assigns.page.header,
        gate: assigns.page.gate,
        dont_know_value: @dont_know,
        dom_run: Regex.replace(~r/[^\w-]/, assigns.run || "quiz", "-")
      )

    ~H"""
    <div class="bd-quiz-host">
      <%= if @screen == nil do %>
        <div class="bd-quiz">
          <.header header={@header} />
          <div :if={@status} class="bd-quiz__status">
            <p>{@status}</p>
            <div class="bd-quiz__actions">
              <a class="bd-quiz__button" href={page_path(@source, @ref)}>Try again</a>
            </div>
          </div>
          <div :if={!@status and @gate} class="bd-quiz__gate" data-kind={@gate.kind}>
            <h3 :if={@gate.title}>{@gate.title}</h3>
            <p>{@gate.body}</p>
            <div :if={@gate.action && @gate.action.href} class="bd-quiz__actions">
              <a class="bd-quiz__button bd-quiz__button--primary" href={@gate.action.href}>{@gate.action.label ||
                "Continue"}</a>
            </div>
          </div>
        </div>
      <% else %>
        <form
          class="bd-quiz"
          id={"bd-quiz-#{@dom_run}"}
          data-phase={@screen.phase}
          aria-busy={if @screen.busy, do: "true"}
          novalidate
          phx-change="answer"
          phx-submit="act"
        >
          <.header header={@header} />
          <%= case @screen.phase do %>
            <% "empty" -> %>
              <p class="bd-quiz__status">{@screen.empty || ""}</p>
            <% "ready" -> %>
              <div class="bd-quiz__ready" data-icon={@screen.ready.icon}>
                <h3>{@screen.ready.title}</h3>
                <p>{@screen.ready.body}</p>
                <.actions actions={@screen.actions} />
                <p :if={@screen.error} class="bd-quiz__error" role="alert">{@screen.error}</p>
              </div>
            <% "done" -> %>
              <.done done={@screen.done} actions={@screen.actions} />
            <% _ -> %>
              <div
                :if={@screen.timer}
                class="bd-quiz__timer"
                id={"bd-quiz-timer-#{@dom_run}"}
                data-warning={@screen.timer.warning}
                data-paused={@screen.timer.paused}
                role="timer"
              >
                <span class="bd-quiz__timer-label">{@screen.timer.label}<span
                  :if={@screen.timer.paused}
                  class="bd-quiz__paused"
                >{@screen.timer.paused_label}</span></span>
                <span class="bd-quiz__timer-value">{@screen.timer.value}</span>
                <span
                  :if={@screen.timer.progress}
                  class="bd-quiz__timer-bar"
                  style={"width:#{tenths(@screen.timer.progress)}%"}
                ></span>
              </div>
              <div :if={@screen.progress} class="bd-quiz__progress">
                <div class="bd-quiz__progress-row">
                  <span>{@screen.progress.position}</span><span :if={@screen.progress.note}>{@screen.progress.note}</span>
                </div>
                <div class="bd-quiz__progress-bar" aria-hidden="true">
                  <span style={"width:#{tenths(@screen.progress.percent)}%"}></span>
                </div>
              </div>
              <p :if={@screen.notice} class="bd-quiz__notice">{@screen.notice}</p>
              <.question
                :for={q <- @screen.questions}
                q={q}
                phase={@screen.phase}
                dont_know_value={@dont_know_value}
              />
              <.feedback :if={@screen.feedback} f={@screen.feedback} />
              <p :if={@screen.error} class="bd-quiz__error" role="alert">{@screen.error}</p>
              <.actions actions={@screen.actions} />
          <% end %>
        </form>
      <% end %>
    </div>
    """
  end

  defp tenths(percent), do: Js.number_string(Float.round(percent * 10) / 10)

  attr :header, :map, default: nil

  defp header(assigns) do
    ~H"""
    <header :if={@header} class="bd-quiz__header">
      <p class="bd-quiz__eyebrow">{@header.eyebrow}</p>
      <h2 class="bd-quiz__title">{@header.title}</h2>
      <p :if={@header.description} class="bd-quiz__description">{@header.description}</p>
      <ul :if={@header.facts != []} class="bd-quiz__facts">
        <li :for={fact <- @header.facts}>{fact}</li>
      </ul>
    </header>
    """
  end

  # The screen's buttons. The primary one submits the form, so Enter in a box presses it.
  attr :actions, :list, required: true

  defp actions(assigns) do
    ~H"""
    <div :if={@actions != []} class="bd-quiz__actions">
      <%= for action <- @actions do %>
        <a
          :if={action.href}
          class={["bd-quiz__button", action.primary && "bd-quiz__button--primary"]}
          href={action.href}
          data-quiz-action={action.id}
        >{action.label}</a>
        <button
          :if={!action.href and action.primary}
          class="bd-quiz__button bd-quiz__button--primary"
          type="submit"
          disabled={!action.enabled}
          data-quiz-action={action.id}
        >{action.label}</button>
        <button
          :if={!action.href and !action.primary}
          class="bd-quiz__button"
          type="button"
          phx-click="act"
          phx-value-action={action.id}
          disabled={!action.enabled}
          data-quiz-action={action.id}
        >{action.label}</button>
      <% end %>
    </div>
    """
  end

  attr :done, :map, required: true
  attr :actions, :list, required: true

  defp done(%{done: %{kind: "results"}} = assigns) do
    ~H"""
    <section class="bd-quiz__results" data-passed={@done.passed == true}>
      <p class="bd-quiz__eyebrow">{@done.eyebrow}</p>
      <p class="bd-quiz__score">{@done.score}</p>
      <p :if={@done.tally} class="bd-quiz__tally">{@done.tally}</p>
      <p class="bd-quiz__summary">{@done.summary}</p>
      <p :if={@done.message} class="bd-quiz__message">{@done.message}</p>
      <p :if={@done.timing} class="bd-quiz__timing">{@done.timing}</p>
    </section>
    <ol class="bd-quiz__review">
      <li :for={item <- @done.items} data-tone={item.tone}>
        <details class="bd-quiz__review-item">
          <summary class="bd-quiz__review-label">
            <span class="bd-quiz__number">{item.number}.</span>{item.label}<span
              class="bd-quiz__badge"
              data-tone={item.feedback.badge.tone}
            >{item.feedback.badge.label}</span>
          </summary>
          <.feedback f={item.feedback} />
        </details>
      </li>
    </ol>
    <.actions actions={@actions} />
    """
  end

  defp done(assigns) do
    ~H"""
    <div class="bd-quiz__done" data-kind={@done.kind}>
      <p class="bd-quiz__eyebrow">{@done.eyebrow}</p>
      <h3>{@done.title}</h3>
      <p>{@done.body}</p>
      <.actions actions={@actions} />
    </div>
    """
  end

  # A verdict: the badge, the answer given and the one accepted, and why.
  attr :f, :map, required: true

  defp feedback(assigns) do
    ~H"""
    <div class="bd-quiz__feedback" data-field-id={@f.field_id} role="status">
      <div class="bd-quiz__feedback-row">
        <span class="bd-quiz__badge" data-tone={@f.badge.tone}>{@f.badge.label}</span><span
          :if={@f.accuracy}
          class="bd-quiz__accuracy"
        >{@f.accuracy}</span>
      </div>
      <div class="bd-quiz__answers">
        <div class="bd-quiz__answer">
          <p class="bd-quiz__small">{@f.answer_label}</p><p>{@f.answer}</p>
        </div>
        <div :if={@f.accepted} class="bd-quiz__answer bd-quiz__answer--accepted">
          <p class="bd-quiz__small">{@f.accepted_label}</p><p>{@f.accepted}</p>
        </div>
      </div>
      <div :if={@f.why} class="bd-quiz__why">
        <p class="bd-quiz__small">{@f.why_label}</p><p>{@f.why}</p>
      </div>
      <ul :if={@f.selected != []} class="bd-quiz__explained">
        <li :for={note <- @f.selected}>
          <strong>{note.option}</strong><span>{note.explanation}</span>
        </li>
      </ul>
      <details :if={@f.others} class="bd-quiz__others">
        <summary>{@f.others.label}</summary>
        <ul class="bd-quiz__explained">
          <li :for={note <- @f.others.items}>
            <strong>{note.option}</strong><span>{note.explanation}</span>
          </li>
        </ul>
      </details>
    </div>
    """
  end

  # One question: its choices (lettered, with "I don't know" when offered) or a box.
  attr :q, :map, required: true
  attr :phase, :string, required: true
  attr :dont_know_value, :string, required: true

  defp question(assigns) do
    field = assigns.q.field
    base = "bd-quiz-" <> Regex.replace(~r/[^\p{L}\p{N}_-]/u, field.id, "-")

    assigns =
      assign(assigns,
        field: field,
        base: base,
        label_id: "#{base}-label",
        error_id: "#{base}-error",
        name: "answers[#{field.id}]",
        invalid: if(assigns.q.error, do: "true"),
        described_by: if(assigns.q.error, do: "#{base}-error"),
        type:
          %{
            "email" => "email",
            "url" => "url",
            "phone" => "tel",
            "tel" => "tel",
            "number" => "number",
            "date" => "date",
            "time" => "time"
          }[field.type] || "text",
        placeholder: Field.str(field, "placeholder"),
        value: if(assigns.q.value == nil, do: "", else: Js.string(assigns.q.value))
      )

    ~H"""
    <fieldset class="bd-quiz__question" data-field-id={@field.id} data-bd-type={@field.type}>
      <legend class="bd-quiz__label" id={@label_id}>
        <span :if={@phase == "all"} class="bd-quiz__number">{@q.number}.</span>{@q.label}
      </legend>
      <%= if @q.choices do %>
        <div
          class="bd-quiz__choices"
          role={if @q.multiple, do: "group", else: "radiogroup"}
          aria-labelledby={@label_id}
          aria-invalid={@invalid}
          aria-describedby={@described_by}
        >
          <input :if={@q.multiple} type="hidden" name={@name <> "[]"} value="" />
          <label
            :for={choice <- @q.choices}
            class="bd-quiz__choice"
            data-state={choice.state}
            data-locked={@q.locked}
          >
            <input
              class="bd-visually-hidden"
              type={if @q.multiple, do: "checkbox", else: "radio"}
              name={if @q.multiple, do: @name <> "[]", else: @name}
              value={choice.label}
              checked={choice.selected}
              disabled={@q.locked}
            /><span class="bd-quiz__letter" aria-hidden="true">{choice.letter}</span><span class="bd-quiz__choice-label">{choice.label}</span>
          </label>
          <label
            :if={@q.dont_know}
            class="bd-quiz__choice bd-quiz__choice--dont-know"
            data-state={@q.dont_know.state}
            data-locked={@q.locked}
          >
            <%= if @q.multiple do %>
              <input type="hidden" name={"dk[#{@field.id}]"} value="false" />
              <input
                class="bd-visually-hidden"
                type="checkbox"
                name={"dk[#{@field.id}]"}
                value="true"
                checked={@q.dont_know.selected}
                disabled={@q.locked}
              />
            <% else %>
              <input
                class="bd-visually-hidden"
                type="radio"
                name={@name}
                value={@dont_know_value}
                checked={@q.dont_know.selected}
                disabled={@q.locked}
              />
            <% end %>
            <span class="bd-quiz__letter" aria-hidden="true">?</span><span class="bd-quiz__choice-label">{@q.dont_know.label}</span>
          </label>
        </div>
      <% else %>
        <%= case @field.type do %>
          <% t when t in ["textarea", "long_text"] -> %>
            <textarea
              class="bd-quiz__input"
              id={@base}
              name={@name}
              aria-labelledby={@label_id}
              aria-invalid={@invalid}
              aria-describedby={@described_by}
              disabled={@q.locked}
              phx-debounce="blur"
            >{@value}</textarea>
          <% "select" -> %>
            <select
              class="bd-quiz__input"
              id={@base}
              name={@name}
              aria-labelledby={@label_id}
              aria-invalid={@invalid}
              aria-describedby={@described_by}
              disabled={@q.locked}
            >
              <option value="">
                {if (@placeholder || "") != "", do: @placeholder, else: "Choose…"}
              </option>
              <option
                :for={option <- Field.options(@field) || []}
                value={option}
                selected={option == @value}
              >
                {option}
              </option>
            </select>
          <% _ -> %>
            <input
              class="bd-quiz__input"
              id={@base}
              name={@name}
              type={@type}
              value={@value}
              placeholder={if (@placeholder || "") != "", do: @placeholder}
              aria-labelledby={@label_id}
              aria-invalid={@invalid}
              aria-describedby={@described_by}
              disabled={@q.locked}
              phx-debounce="blur"
            />
        <% end %>
      <% end %>
      <p :if={@q.error} class="bd-quiz__field-error" id={@error_id} role="alert">{@q.error}</p>
    </fieldset>
    """
  end
end
