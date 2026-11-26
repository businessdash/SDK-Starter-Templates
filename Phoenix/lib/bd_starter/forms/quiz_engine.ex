defmodule BdStarter.Forms.QuizEngine do
  @moduledoc """
  Quizzes: the forms engine taking a graded assessment. A port of forms-core's
  `quiz.ts` (by way of the Swift SDK's `BdQuizEngine`).

  Everything here is pure: a `QuizState` in, a new one out, and `screen/3`
  turns it into exactly what a page shows, texts included. `QuizController`
  adds BD's calls and the clock.

  A step that needs BD comes back as `{:lock, state, field_id, answer}` or
  `{:submit, state, answers}`; one that doesn't as `{:none, state}`.
  """

  alias BdStarter.Forms.{
    Dates,
    Js,
    Json,
    QuizArrange,
    QuizConfig,
    QuizScoring,
    QuizState,
    QuizWords,
    Rules
  }

  @doc "Epoch ms from BD's number or ISO 8601 instant."
  def timestamp(value) do
    cond do
      Json.number?(value) ->
        if Js.finite?(value), do: Js.f(value)

      is_binary(value) and
          Regex.match?(
            ~r/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\z/,
            value
          ) ->
        case Dates.parse_instant(value) do
          nil -> nil
          ms -> Float.round(ms * 1.0)
        end

      true ->
        nil
    end
  end

  @doc """
  Where a run starts: at the first question not yet locked, with what BD
  kept (answers, verdicts, the clock). `initial` takes `:answers, :results,
  :completion, :started_at, :deadline_at, :server_now, :dont_know`.
  """
  def initial_state(config, initial, now) do
    results = Map.get(initial, :results, [])
    locked = Enum.map(results, & &1["fieldId"])
    count = length(config.questions)
    first_open = Enum.find_index(config.questions, &(&1.id not in locked))
    all_locked = count > 0 and first_open == nil
    server_now = Map.get(initial, :server_now)

    %QuizState{
      index: if(all_locked, do: count - 1, else: first_open || 0),
      answers: Map.get(initial, :answers, %{}),
      dont_know: Map.get(initial, :dont_know, []),
      results: results,
      revealed: config.feedback_mode == "immediate" and all_locked,
      completion: Map.get(initial, :completion),
      started_at: timestamp(Map.get(initial, :started_at)),
      deadline_at: timestamp(Map.get(initial, :deadline_at)),
      clock_offset: if(server_now != nil, do: server_now - now, else: 0.0)
    }
  end

  @doc "BD's clock: this server's, corrected by the offset BD reported."
  def clock(state, now), do: now + state.clock_offset

  defp busy?(state), do: state.pending != nil or state.completion != nil

  defp locked?(config, state, field_id),
    do: config.feedback_mode == "immediate" and QuizState.result(state, field_id) != nil

  defp empty_answer(field), do: if(QuizArrange.multi_select?(field), do: [], else: "")

  def set_answer(config, state, field_id, value) do
    if busy?(state) or locked?(config, state, field_id) or
         QuizConfig.question(config, field_id) == nil do
      state
    else
      %{
        state
        | answers: Map.put(state.answers, field_id, value),
          dont_know: Enum.reject(state.dont_know, &(&1 == field_id)),
          field_errors: Map.delete(state.field_errors, field_id),
          error: nil
      }
    end
  end

  def offers_dont_know?(config, field),
    do: config.allow_dont_know and QuizArrange.multiple_choice?(field) and not field.required

  def choose_dont_know(config, state, field_id) do
    field = QuizConfig.question(config, field_id)

    if field == nil or not offers_dont_know?(config, field) or busy?(state) or
         locked?(config, state, field_id) do
      state
    else
      %{
        state
        | answers: Map.put(state.answers, field_id, empty_answer(field)),
          dont_know: Enum.reject(state.dont_know, &(&1 == field_id)) ++ [field_id],
          field_errors: Map.delete(state.field_errors, field_id),
          error: nil
      }
    end
  end

  @doc "field id → message, for each required question without an answer."
  def missing(config, state, fields) do
    for field <- fields,
        field.required and Rules.empty?(field, Map.get(state.answers, field.id)),
        into: %{} do
      label = if field.label == "", do: "This question", else: field.label
      {field.id, QuizWords.fill(config.words.required, label: label)}
    end
  end

  @doc "The primary button: check (or lock) the answer, move on, or submit."
  def advance(config, state, now) do
    count = length(config.questions)

    cond do
      busy?(state) or (config.timer_enabled and state.started_at == nil) ->
        {:none, state}

      state.index < 0 or state.index >= count ->
        {:none, state}

      true ->
        question = Enum.at(config.questions, state.index)
        last = state.index >= count - 1

        if config.feedback_mode == "immediate",
          do: advance_immediate(config, state, now, question, last),
          else: advance_end(config, state, question, last)
    end
  end

  defp advance_immediate(config, state, now, question, last) do
    cond do
      state.revealed and last ->
        resumed = end_reveal_pause(state, now)
        {:submit, %{resumed | pending: "submit", error: nil}, state.answers}

      state.revealed ->
        resumed = end_reveal_pause(state, now)
        {:none, %{resumed | index: state.index + 1, revealed: false}}

      true ->
        case missing(config, state, [question]) do
          errors when errors != %{} ->
            {:none, %{state | field_errors: errors}}

          _ ->
            next = %{state | pending: "lock", error: nil, field_errors: %{}}
            answer = Map.get(state.answers, question.id)

            {:lock, next, question.id,
             if(answer == nil, do: empty_answer(question), else: answer)}
        end
    end
  end

  defp advance_end(config, state, question, last) do
    checking = if config.layout == "all", do: config.questions, else: [question]

    case missing(config, state, checking) do
      errors when errors != %{} ->
        {:none, %{state | field_errors: errors}}

      _ ->
        next = %{state | field_errors: %{}, error: nil}

        if config.layout == "single" and not last,
          do: {:none, %{next | index: state.index + 1}},
          else: {:submit, %{next | pending: "submit"}, state.answers}
    end
  end

  def back(config, state) do
    if busy?(state) or config.feedback_mode != "end" or config.layout != "single" or
         state.index <= 0,
       do: state,
       else: %{state | index: state.index - 1, field_errors: %{}, error: nil}
  end

  @doc "`info`: `%{started_at:, deadline_at:, server_now:}`."
  def started(state, info, now) do
    %{
      state
      | pending: nil,
        error: nil,
        clock_offset: info.server_now - now,
        started_at: timestamp(info.started_at),
        deadline_at: timestamp(Map.get(info, :deadline_at))
    }
  end

  @doc "A start with no BD to ask: the clock starts now."
  def local_start(config, now) do
    %{
      started_at: now,
      deadline_at:
        if(config.time_limit_minutes != nil, do: now + config.time_limit_minutes * 60_000.0),
      server_now: now
    }
  end

  def locked(config, state, field_id, answer, result, now) do
    %{
      state
      | pending: nil,
        error: nil,
        answers: Map.put(state.answers, field_id, answer),
        results: Enum.reject(state.results, &(&1["fieldId"] == field_id)) ++ [result],
        revealed: true,
        reveal_started_at: if(config.local, do: clock(state, now), else: state.reveal_started_at)
    }
  end

  @doc "A local run's clock stops while a verdict shows: count the pause."
  def end_reveal_pause(%QuizState{reveal_started_at: nil} = state, _now), do: state

  def end_reveal_pause(state, now) do
    %{
      state
      | paused_ms: state.paused_ms + max(0.0, clock(state, now) - state.reveal_started_at),
        reveal_started_at: nil
    }
  end

  def completed(state, completion),
    do: %{state | pending: nil, error: nil, completion: completion}

  def failed(state, message), do: %{state | pending: nil, error: message}

  @doc "`{timed out, duration in seconds}`."
  def local_timing(state, now) do
    clock = clock(state, now)

    {
      state.deadline_at != nil and clock >= state.deadline_at + state.paused_ms,
      if(state.started_at != nil,
        do: max(0.0, Float.floor((clock - state.started_at) / 1000 + 0.5))
      )
    }
  end

  @doc "Grade here: a quiz that carries its answer keys (the sample)."
  def local_completion(config, state, answers, now) do
    {timed_out, duration} = local_timing(state, now)

    config.questions
    |> QuizScoring.score(answers, config.passing_score)
    |> Map.put("timedOut", timed_out)
    |> Map.put("durationSeconds", duration)
  end

  def local_result(config, field_id, answer) do
    case QuizConfig.question(config, field_id) do
      nil ->
        nil

      field ->
        [field]
        |> QuizScoring.score(%{field_id => answer}, config.passing_score)
        |> Map.get("results")
        |> List.first()
    end
  end

  defp reveal_pause_now(config, state, now) do
    if not config.local or state.reveal_started_at == nil,
      do: 0.0,
      else: max(0.0, clock(state, now) - state.reveal_started_at)
  end

  @doc "The deadline, pushed out by a local run's pauses."
  def effective_deadline(_config, %QuizState{deadline_at: nil}, _now), do: nil

  def effective_deadline(config, state, now) do
    if config.local,
      do: state.deadline_at + state.paused_ms + reveal_pause_now(config, state, now),
      else: state.deadline_at
  end

  def deadline_passed?(config, state, now) do
    deadline = effective_deadline(config, state, now)

    deadline != nil and clock(state, now) >= deadline and state.completion == nil and
      state.pending == nil and
      not state.time_up
  end

  def time_up(state), do: %{state | time_up: true, pending: "submit", error: nil}

  # ── Display helpers ───────────────────────────────────────────────────────

  @doc "75 → \"1:15\"; 3725 → \"1:02:05\"."
  def duration_label(total_seconds) do
    seconds = max(0, Kernel.trunc(Float.floor(total_seconds * 1.0)))
    hours = div(seconds, 3600)
    minutes = div(rem(seconds, 3600), 60)
    rest = rem(seconds, 60)
    pad = fn n -> String.pad_leading(Integer.to_string(n), 2, "0") end
    if hours > 0, do: "#{hours}:#{pad.(minutes)}:#{pad.(rest)}", else: "#{minutes}:#{pad.(rest)}"
  end

  @answer_part_order ~w(prefix first middle last suffix nicknames full short line1 line2 city state zip country value unit url start end)

  @doc "An answer as a sentence: \"Paris\", \"7, 11\", \"Yes\", or \"No answer\"."
  def answer_text(value, words \\ %QuizWords{})

  def answer_text([], words), do: words.no_answer

  def answer_text(value, words) when is_list(value),
    do: Enum.map_join(value, ", ", &answer_text(&1, words))

  def answer_text(value, words) when value in [nil, ""], do: words.no_answer
  def answer_text(true, words), do: words.yes
  def answer_text(false, words), do: words.no

  def answer_text(value, words) when is_map(value) do
    known = Enum.filter(@answer_part_order, &Map.has_key?(value, &1))
    rest = value |> Map.keys() |> Enum.reject(&(&1 in @answer_part_order)) |> Enum.sort()

    parts =
      Enum.flat_map(known ++ rest, fn key ->
        v = value[key]

        cond do
          is_binary(v) and Js.trim(v) != "" -> [v]
          Json.number?(v) -> [Js.string(v)]
          true -> []
        end
      end)

    if parts == [], do: words.no_answer, else: Enum.join(parts, ", ")
  end

  def answer_text(value, words) do
    text = value |> Js.string() |> Js.strip_tags() |> Js.trim()
    if text == "", do: words.no_answer, else: text
  end

  @doc "A percentage as a whole number, rounded as JavaScript rounds."
  def percent(value), do: Kernel.trunc(Float.floor(value + 0.5))

  # ── The screen ────────────────────────────────────────────────────────────

  defp badge(w, result, dont_know) do
    if dont_know and result["status"] != "correct" do
      %{label: w.dont_know, tone: "unsure"}
    else
      case result["status"] do
        "correct" -> %{label: w.correct, tone: "correct"}
        "partially_correct" -> %{label: w.partially_correct, tone: "partial"}
        "pending_ai" -> %{label: w.pending_ai, tone: "pending"}
        "unscored" -> %{label: w.unscored, tone: "unscored"}
        _ -> %{label: w.incorrect, tone: "incorrect"}
      end
    end
  end

  @doc "The verdict card for one question."
  def feedback(w, result, dont_know \\ false) do
    answer = result["answer"]
    unanswered = answer in [nil, "", []]
    rationale = result["rationale"]

    picked =
      for o <- Json.list(Json.get(rationale, "selectedOptions")) || [],
          is_binary(o["explanation"]),
          do: %{option: o["option"], explanation: o["explanation"]}

    others =
      for o <- Json.list(Json.get(rationale, "optionExplanations")) || [],
          o["accepted"] != true and is_binary(o["explanation"]),
          do: %{option: o["option"], explanation: o["explanation"]}

    accuracy = Json.num(result["accuracyPercent"])
    accepted = Json.strings(result["correctAnswers"])

    %{
      field_id: result["fieldId"],
      label: result["label"],
      badge: badge(w, result, dont_know),
      accuracy: if(accuracy != nil, do: QuizWords.fill(w.accurate, percent: percent(accuracy))),
      answer_label: w.your_answer,
      answer: if(dont_know and unanswered, do: w.dont_know, else: answer_text(answer, w)),
      accepted_label: w.accepted_answer,
      accepted: if(accepted != [], do: Enum.join(accepted, " · ")),
      why_label: if(unanswered, do: w.why_accepted, else: w.why),
      why: Json.str(Json.get(rationale, "explanation")),
      selected: if(length(picked) > 1, do: picked, else: []),
      others: if(others != [], do: %{label: w.why_others, items: others})
    }
  end

  def timer(config, state, now) do
    if not config.timer_enabled or state.started_at == nil do
      nil
    else
      clock = clock(state, now)
      deadline = effective_deadline(config, state, now)

      {seconds, progress} =
        if deadline != nil do
          seconds = max(0, Kernel.trunc(Float.ceil((deadline - clock) / 1000)))
          # Against the time allowed, not the stretched deadline: a local
          # run's pauses push the deadline out, and the bar holds still.
          allowed = (state.deadline_at || state.started_at) - state.started_at

          {seconds,
           if(allowed > 0,
             do: ((deadline - clock) / allowed * 100) |> min(100.0) |> max(0.0),
             else: 0.0
           )}
        else
          {max(0, Kernel.trunc(Float.floor((clock - state.started_at) / 1000))), nil}
        end

      %{
        label:
          if(deadline != nil, do: config.words.time_remaining, else: config.words.elapsed_time),
        value: duration_label(seconds),
        seconds: seconds,
        countdown: deadline != nil,
        warning: deadline != nil and seconds <= 60,
        paused: config.local and deadline != nil and state.revealed,
        paused_label: config.words.paused,
        progress: progress
      }
    end
  end

  defp choices(field, value, result) do
    picked = Enum.map(if(is_list(value), do: value, else: [value]), &Js.string/1)
    scored = result != nil and Json.strings(result["correctAnswers"]) != []

    field
    |> QuizScoring.option_labels()
    |> Enum.with_index()
    |> Enum.map(fn {label, index} ->
      selected = label in picked

      state =
        cond do
          result == nil and selected -> "selected"
          result == nil -> "idle"
          scored and QuizScoring.accepted_label?(result, label) -> "correct"
          selected and scored -> "incorrect"
          selected -> "selected"
          true -> "dimmed"
        end

      %{letter: QuizArrange.choice_letter(index), label: label, selected: selected, state: state}
    end)
  end

  defp question(config, state, field, index) do
    value = Map.get(state.answers, field.id)
    result = if config.feedback_mode == "immediate", do: QuizState.result(state, field.id)
    chosen = field.id in state.dont_know

    %{
      field: field,
      number: index + 1,
      label: field.label,
      value: value,
      error: Map.get(state.field_errors, field.id),
      locked: result != nil or busy?(state),
      choices: if(QuizArrange.multiple_choice?(field), do: choices(field, value, result)),
      multiple: QuizArrange.multi_select?(field),
      dont_know:
        if offers_dont_know?(config, field) do
          %{
            label: config.words.dont_know,
            selected: chosen,
            state:
              cond do
                result != nil and chosen -> "incorrect"
                result != nil -> "dimmed"
                chosen -> "selected"
                true -> "idle"
              end
          }
        end
    }
  end

  defp answered(config, state) do
    Enum.count(config.questions, fn q ->
      not Rules.empty?(q, Map.get(state.answers, q.id)) or q.id in state.dont_know
    end)
  end

  defp results_message(w, percent) do
    cond do
      percent >= 90 -> w.message_excellent
      percent >= 75 -> w.message_solid
      percent >= 50 -> w.message_getting_there
      true -> w.message_keep_going
    end
  end

  defp done(config, state, completion) do
    w = config.words

    cond do
      not config.show_score ->
        %{
          kind: "submitted",
          eyebrow: w.submitted_eyebrow,
          title: w.submitted_title,
          body: w.submitted_body
        }

      config.results_locked ->
        %{kind: "locked", eyebrow: w.locked_eyebrow, title: w.locked_title, body: w.locked_body}

      true ->
        results = Json.list(completion["results"]) || []

        score =
          percent(
            Json.num(completion["scorePercent"]) ||
              Json.num(completion["provisionalScorePercent"]) || 0.0
          )

        scorable = Enum.filter(results, &((Json.num(&1["pointsPossible"]) || 0.0) > 0))
        correct = Enum.count(scorable, &(&1["status"] == "correct"))
        pending = completion["status"] == "pending_ai_review"
        timed_out = completion["timedOut"] == true
        duration = Json.num(completion["durationSeconds"])

        timing =
          if timed_out or duration != nil do
            label = if timed_out, do: w.time_limit_reached, else: w.completed

            if duration != nil,
              do: QuizWords.fill(w.in_duration, label: label, duration: duration_label(duration)),
              else: label
          end

        passed = Json.bool(completion["passed"])

        items =
          results
          |> Enum.with_index()
          |> Enum.map(fn {result, index} ->
            card = feedback(w, result, result["fieldId"] in state.dont_know)
            %{number: index + 1, label: result["label"], tone: card.badge.tone, feedback: card}
          end)

        %{
          kind: "results",
          eyebrow: w.results_eyebrow,
          score: "#{score}%",
          tally:
            if(scorable != [],
              do: QuizWords.fill(w.tally, correct: correct, total: length(scorable))
            ),
          summary:
            cond do
              pending -> w.provisional
              passed == true -> w.passed
              true -> w.not_passed
            end,
          message: if(not pending, do: results_message(w, score)),
          timing: timing,
          passed: passed,
          items: items
        }
    end
  end

  defp action(id, label, enabled, primary, href \\ nil),
    do: %{id: id, label: label, enabled: enabled, primary: primary, href: href}

  @doc """
  Exactly what the quiz shows now: `phase` (empty, ready, question, all,
  feedback, done) and the parts that phase draws, texts included.
  """
  def screen(config, state, now) do
    w = config.words

    view = %{
      phase: "empty",
      empty: nil,
      ready: nil,
      timer: nil,
      progress: nil,
      notice: nil,
      questions: [],
      feedback: nil,
      done: nil,
      actions: [],
      error: state.error,
      busy: state.pending != nil
    }

    count = length(config.questions)

    cond do
      state.completion != nil ->
        done = done(config, state, state.completion)
        locked = done.kind == "locked"

        actions =
          if(locked and config.sign_in_href != nil,
            do: [action("signIn", w.locked_action, true, true, config.sign_in_href)],
            else: []
          ) ++
            if(config.can_restart, do: [action("retake", w.retake, true, not locked)], else: [])

        %{view | phase: "done", done: done, actions: actions}

      count == 0 ->
        %{view | empty: w.empty}

      config.timer_enabled and state.started_at == nil ->
        body =
          case config.time_limit_minutes do
            nil -> w.ready_elapsed
            1 -> w.ready_limit_one
            minutes -> QuizWords.fill(w.ready_limit_many, minutes: minutes)
          end

        %{
          view
          | phase: "ready",
            ready: %{
              icon: if(config.time_limit_minutes != nil, do: "hourglass", else: "clock"),
              title: w.ready_title,
              body: body
            },
            actions: [
              action(
                "start",
                if(state.pending == "start", do: w.starting, else: w.start),
                state.pending == nil,
                true
              )
            ]
        }

      true ->
        running_screen(config, state, now, %{view | timer: timer(config, state, now)}, count)
    end
  end

  defp running_screen(config, state, _now, view, count) do
    w = config.words
    idle = state.pending == nil

    submit =
      action(
        "submit",
        if(state.pending == "submit", do: w.submitting, else: w.submit),
        idle,
        true
      )

    cond do
      config.feedback_mode == "end" and config.layout == "all" ->
        done = answered(config, state)

        %{
          view
          | phase: "all",
            progress: %{
              position: QuizWords.fill(w.answered_of, answered: done, total: count),
              note: nil,
              percent: done / count * 100
            },
            notice: if(config.show_score, do: w.end_notice, else: w.end_notice_hidden),
            questions:
              config.questions
              |> Enum.with_index()
              |> Enum.map(fn {q, i} -> question(config, state, q, i) end),
            actions: [submit]
        }

      true ->
        index = state.index |> max(0) |> min(count - 1)
        field = Enum.at(config.questions, index)
        last = state.index >= count - 1
        position = QuizWords.fill(w.question_of, number: state.index + 1, total: count)

        if config.feedback_mode == "immediate" do
          result = QuizState.result(state, field.id)
          showing = state.revealed and result != nil

          percent =
            max(
              if(state.revealed, do: length(state.results), else: state.index) / count * 100,
              4.0
            )

          finish_label =
            if config.show_score and not config.results_locked, do: w.see_results, else: w.finish

          actions =
            if showing do
              label =
                cond do
                  state.pending == "submit" -> w.submitting
                  last -> finish_label
                  true -> w.next_question
                end

              [action(if(last, do: "finish", else: "next"), label, idle, true)]
            else
              label =
                cond do
                  state.pending == "lock" -> w.checking
                  config.local -> w.check_answer
                  true -> w.lock_answer
                end

              [action("lock", label, idle, true)]
            end

          %{
            view
            | phase: if(showing, do: "feedback", else: "question"),
              progress: %{position: position, note: w.locks_when_checked, percent: percent},
              questions: [question(config, state, field, state.index)],
              feedback: if(showing, do: feedback(w, result, field.id in state.dont_know)),
              actions: actions
          }
        else
          actions =
            if(state.index > 0, do: [action("back", w.back, idle, false)], else: []) ++
              [if(last, do: submit, else: action("next", w.next, idle, true))]

          %{
            view
            | phase: "question",
              progress: %{
                position: position,
                note: nil,
                percent: max(state.index / count * 100, 4.0)
              },
              notice: if(config.show_score, do: w.end_notice, else: w.end_notice_hidden),
              questions: [question(config, state, field, state.index)],
              actions: actions
          }
        end
    end
  end
end
