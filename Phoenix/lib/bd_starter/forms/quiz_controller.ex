defmodule BdStarter.Forms.QuizController do
  @moduledoc """
  A quiz run: the engine (`QuizEngine`) plus BD's calls and the clock. A port
  of the Swift SDK's `BdQuizController`. It lives in a LiveView's assigns:
  every function takes the run and gives back the next one, and the view's
  once-a-second tick calls `tick/1`, which submits a timed quiz at zero.
  """

  alias BdStarter.Forms.{FormsError, Json, QuizArrange, QuizConfig, QuizEngine}

  defstruct [:config, :state, :seed, :now, :last_draft, :local, :options, :backend, :clock]

  @doc """
  `opts`: `:backend` (a `QuizBackend`), `:initial` (see
  `QuizEngine.initial_state/3`), `:seed`, `:state`, `:last_draft`, `:clock`
  (fn -> epoch ms).
  """
  def new(options, opts \\ []) do
    backend = opts[:backend]
    local = if options.local == nil, do: backend == nil, else: options.local
    can_restart = if options.can_restart == nil, do: local, else: options.can_restart
    resolved = %{options | local: local, can_restart: can_restart}
    clock = opts[:clock] || fn -> System.os_time(:microsecond) / 1000 end
    now = clock.()
    seed = opts[:seed] || options.seed || QuizArrange.random_seed()
    config = QuizConfig.new(resolved, seed)
    state = opts[:state] || QuizEngine.initial_state(config, opts[:initial] || %{}, now)

    %__MODULE__{
      config: config,
      state: state,
      seed: seed,
      now: now,
      last_draft: opts[:last_draft] || state.answers,
      local: local,
      options: resolved,
      backend: backend,
      clock: clock
    }
  end

  def screen(q), do: QuizEngine.screen(q.config, q.state, q.now)

  # ── Taking the quiz ───────────────────────────────────────────────────────

  def set_answer(q, field_id, value),
    do: q |> set(QuizEngine.set_answer(q.config, q.state, field_id, value)) |> save_draft()

  def choose_dont_know(q, field_id),
    do: q |> set(QuizEngine.choose_dont_know(q.config, q.state, field_id)) |> save_draft()

  @doc "One of the screen's actions: start, lock, next, back, submit, finish, retake."
  def perform(q, action) do
    case action do
      "start" -> start(q)
      a when a in ["lock", "next", "submit", "finish"] -> advance(q)
      "back" -> set(q, QuizEngine.back(q.config, q.state))
      "retake" -> restart(q)
      _ -> q
    end
  end

  def start(q) do
    if q.state.started_at != nil or q.state.pending != nil do
      q
    else
      try do
        info =
          if q.backend != nil and q.backend.start != nil,
            do: q.backend.start.(),
            else: QuizEngine.local_start(q.config, q.clock.())

        set(q, QuizEngine.started(q.state, info, q.clock.()))
      rescue
        e -> set(q, QuizEngine.failed(q.state, message(e, q.config.words.start_failed)))
      end
    end
  end

  def advance(q) do
    case QuizEngine.advance(q.config, q.state, q.clock.()) do
      {:lock, state, field_id, answer} ->
        q |> set(state) |> lock(field_id, answer)

      {:submit, state, answers} ->
        q |> set(state) |> submit(answers, q.config.words.submit_failed)

      {:none, state} ->
        set(q, state)
    end
  end

  @doc "Take a local quiz again: a fresh seed, so a shuffled quiz comes out in a new order."
  def restart(%__MODULE__{local: false} = q), do: q

  def restart(q) do
    seed = QuizArrange.random_seed()
    config = QuizConfig.new(q.options, seed)
    now = q.clock.()

    %{
      q
      | seed: seed,
        config: config,
        now: now,
        state: QuizEngine.initial_state(config, %{}, now),
        last_draft: %{}
    }
  end

  @doc "The clock, re-read: at zero the quiz submits what it has."
  def tick(q) do
    q = %{q | now: q.clock.()}

    if not QuizEngine.deadline_passed?(q.config, q.state, q.now) do
      q
    else
      answers = q.state.answers
      q = set(q, QuizEngine.time_up(q.state))

      # The submission carries the answers anyway; the draft is a backstop.
      if q.config.feedback_mode == "end" and q.backend != nil and q.backend.save_draft != nil do
        try do
          q.backend.save_draft.(answers)
        rescue
          _ -> :ok
        end
      end

      submit(q, answers, q.config.words.timed_submit_failed)
    end
  end

  @doc "Whether the page should keep re-reading the clock."
  def clock_running?(q),
    do: q.config.timer_enabled and q.state.started_at != nil and q.state.completion == nil

  # ── Internals ─────────────────────────────────────────────────────────────

  defp set(q, next), do: %{q | now: q.clock.(), state: next}

  # An end-of-quiz invitation keeps a draft on BD as answers change.
  defp save_draft(q) do
    answers = q.state.answers

    cond do
      q.backend == nil or q.backend.save_draft == nil or q.config.feedback_mode != "end" ->
        q

      q.config.timer_enabled and q.state.started_at == nil ->
        q

      Json.equal?(answers, q.last_draft) ->
        q

      true ->
        q = %{q | last_draft: answers}

        try do
          q.backend.save_draft.(answers)
          q
        rescue
          e -> set(q, %{q.state | error: message(e, q.config.words.draft_failed)})
        end
    end
  end

  defp submit(q, answers, failure) do
    completion =
      if q.backend != nil do
        completion = q.backend.submit.(answers, Enum.map(q.config.questions, & &1.id))

        # Graded by BD but timed here (a practice run): add the timing.
        if q.config.local do
          {timed_out, duration} = QuizEngine.local_timing(q.state, q.clock.())

          completion
          |> Map.update("timedOut", timed_out, &if(&1 == nil, do: timed_out, else: &1))
          |> Map.update("durationSeconds", duration, &if(&1 == nil, do: duration, else: &1))
        else
          completion
        end
      else
        QuizEngine.local_completion(q.config, q.state, answers, q.clock.())
      end

    set(q, QuizEngine.completed(q.state, completion))
  rescue
    e -> set(q, QuizEngine.failed(q.state, message(e, failure)))
  end

  defp lock(q, field_id, answer) do
    result =
      cond do
        q.backend == nil -> QuizEngine.local_result(q.config, field_id, answer)
        q.backend.lock_answer == nil -> raise FormsError, message: q.config.words.unscorable
        true -> q.backend.lock_answer.(field_id, answer)
      end

    if not Json.object?(result), do: raise(FormsError, message: q.config.words.unscorable)
    set(q, QuizEngine.locked(q.config, q.state, field_id, answer, result, q.clock.()))
  rescue
    e -> set(q, QuizEngine.failed(q.state, message(e, q.config.words.lock_failed)))
  end

  defp message(%FormsError{message: m}, _fallback) when m not in [nil, ""], do: m
  defp message(_, fallback), do: fallback
end
