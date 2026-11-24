defmodule BdStarter.QuizParityTest do
  @moduledoc """
  Replays `quiz-parity.json`: quizzes run through the TypeScript forms-core
  by `sdk/scripts/quiz-parity.ts`, with every screen and state TypeScript
  produced. This starter's quiz must show a taker exactly what the web quiz shows.
  """
  use ExUnit.Case, async: true

  import BdStarter.Parity, only: [fixtures: 1]

  alias BdStarter.Forms.{Field, Js, Json, QuizArrange, QuizConfig, QuizEngine, QuizOptions, QuizPage, QuizScoring, QuizState, QuizWords}

  @fixtures fixtures("quiz-parity.json")

  defp cases(key), do: Map.fetch!(@fixtures, key)

  defp camel(atom) do
    [first | rest] = atom |> Atom.to_string() |> String.split("_")
    first <> Enum.map_join(rest, "", &String.capitalize/1)
  end

  # Engine output as JSON: snake_case keys as camelCase, a question's field as its id.
  defp json(%Field{id: id}), do: id
  defp json(%QuizState{} = s), do: json(QuizState.to_json(s))
  defp json(v) when is_map(v), do: Map.new(v, fn {k, x} -> {if(is_atom(k), do: camel(k), else: k), json(x)} end)
  defp json(v) when is_list(v), do: Enum.map(v, &json/1)
  defp json(v) when is_integer(v), do: v * 1.0
  defp json(v), do: v

  # The path of the first difference, or nil. A missing key equals nil, numbers within 1e-9.
  defp diff(a, b, path \\ "$")
  defp diff(nil, nil, _), do: nil

  defp diff(a, b, path) do
    cond do
      Json.number?(a) and Json.number?(b) ->
        x = Js.f(a)
        y = Js.f(b)
        if x == y or abs(x - y) <= 1.0e-9 * max(abs(x), abs(y)), do: nil, else: "#{path}: #{x} ≠ #{y}"

      is_list(a) and is_list(b) ->
        if length(a) != length(b) do
          "#{path}: #{length(a)} items ≠ #{length(b)}"
        else
          a |> Enum.zip(b) |> Enum.with_index() |> Enum.find_value(fn {{x, y}, i} -> diff(x, y, "#{path}[#{i}]") end)
        end

      is_map(a) and is_map(b) ->
        (Map.keys(a) ++ Map.keys(b))
        |> Enum.uniq()
        |> Enum.sort()
        |> Enum.find_value(fn k -> diff(Map.get(a, k), Map.get(b, k), "#{path}.#{k}") end)

      a === b ->
        nil

      true ->
        "#{path}: #{inspect(a)} ≠ #{inspect(b)}"
    end
  end

  test "diff catches differences" do
    assert diff(%{"a" => 1.0}, %{"a" => 2.0})
    assert diff(%{"a" => 1.0}, %{})
    assert diff([1.0, 2.0], [1.0])
    assert diff(%{"a" => %{"b" => true}}, %{"a" => %{"b" => false}})
    refute diff(%{"a" => nil}, %{})
  end

  test "words match" do
    mine = %QuizWords{} |> Map.from_struct() |> Map.new(fn {k, v} -> {camel(k), v} end)
    assert mine == @fixtures["words"]
  end

  test "seed hash" do
    for c <- cases("seedHash"), do: assert(QuizArrange.seed_hash(c["text"]) == Kernel.trunc(c["hash"]), "hash(#{c["text"]})")
  end

  test "seeded order" do
    for c <- cases("seededOrder") do
      want = Enum.map(c["order"], &Kernel.trunc/1)
      assert QuizArrange.seeded_order(Kernel.trunc(c["count"]), c["seed"]) == want, "order(#{c["count"]}, #{c["seed"]})"
    end
  end

  test "durations" do
    for c <- cases("durations"), do: assert(QuizEngine.duration_label(c["seconds"]) == c["label"], "duration(#{c["seconds"]})")
  end

  test "answer text" do
    for c <- cases("answerText"), do: assert(QuizEngine.answer_text(c["value"]) == c["text"], "answerText(#{inspect(c["value"])})")
  end

  test "scoring" do
    failures =
      for c <- cases("scoring"),
          score <- [QuizScoring.score(Field.list(c["fields"]), c["answers"] || %{}, c["passingScore"])],
          d <- [diff(json(score), c["score"])],
          d != nil,
          do: "scoring “#{c["name"]}”: #{d}"

    assert failures == []
  end

  test "pages" do
    failures =
      for c <- cases("pages"),
          page =
            (if Map.has_key?(c, "practice") do
               QuizPage.practice(c["practice"])
             else
               links = c["links"] || %{}
               QuizPage.invitation(Json.obj(c["invitation"]), %QuizWords{}, Json.str(links["signInHref"]), Json.str(links["switchAccountHref"]))
             end),
          d <- [diff(json(page), c["page"])],
          d != nil,
          do: "page “#{c["name"]}”: #{d}"

    assert failures == []
  end

  defp initial(nil), do: %{}

  defp initial(o) do
    [
      {:answers, if(Map.has_key?(o, "answers") and o["answers"] != nil, do: Json.obj(o["answers"]) || %{})},
      {:results, if(is_list(o["results"]), do: Enum.map(o["results"], &QuizScoring.read_result/1))},
      {:completion, if(Json.object?(o["completion"]), do: QuizScoring.read_completion(o["completion"]))},
      {:server_now, if(Json.number?(o["serverNow"]), do: o["serverNow"])},
      {:dont_know, if(is_list(o["dontKnow"]), do: Json.strings(o["dontKnow"]))}
    ]
    |> Enum.reject(fn {_, v} -> v == nil end)
    |> Map.new()
    |> then(fn m -> if Map.has_key?(o, "startedAt"), do: Map.put(m, :started_at, o["startedAt"]), else: m end)
    |> then(fn m -> if Map.has_key?(o, "deadlineAt"), do: Map.put(m, :deadline_at, o["deadlineAt"]), else: m end)
  end

  defp start_info(o), do: %{started_at: o["startedAt"], deadline_at: o["deadlineAt"], server_now: o["serverNow"]}

  defp step(config, state, e, at) do
    case e["do"] do
      "answer" ->
        QuizEngine.set_answer(config, state, e["fieldId"], e["value"])

      "dontKnow" ->
        QuizEngine.choose_dont_know(config, state, e["fieldId"])

      "back" ->
        QuizEngine.back(config, state)

      "start" ->
        info = if Json.object?(e["info"]), do: start_info(e["info"]), else: QuizEngine.local_start(config, at)
        QuizEngine.started(state, info, at)

      "fail" ->
        QuizEngine.failed(state, e["message"])

      "view" ->
        state

      "advance" ->
        case QuizEngine.advance(config, state, at) do
          {:lock, state, field_id, answer} ->
            result =
              if Json.object?(e["result"]),
                do: QuizScoring.read_result(e["result"]),
                else: QuizEngine.local_result(config, field_id, answer)

            if result != nil,
              do: QuizEngine.locked(config, state, field_id, answer, result, at),
              else: QuizEngine.failed(state, config.words.unscorable)

          {:submit, state, answers} ->
            completion =
              if Json.object?(e["completion"]),
                do: QuizScoring.read_completion(e["completion"]),
                else: QuizEngine.local_completion(config, state, answers, at)

            QuizEngine.completed(state, completion)

          {:none, state} ->
            state
        end

      "tick" ->
        if QuizEngine.deadline_passed?(config, state, at) do
          answers = state.answers
          state = QuizEngine.time_up(state)

          completion =
            if Json.object?(e["completion"]),
              do: QuizScoring.read_completion(e["completion"]),
              else: QuizEngine.local_completion(config, state, answers, at)

          QuizEngine.completed(state, completion)
        else
          state
        end

      other ->
        raise "unknown event #{other}"
    end
  end

  test "runs" do
    failures =
      Enum.flat_map(cases("runs"), fn run ->
        config = QuizConfig.new(QuizOptions.from_json(run["options"]), run["seed"])
        start = run["start"]
        state = QuizEngine.initial_state(config, initial(run["initial"]), start)

        check = fn i, state, at ->
          cond do
            d = diff(json(QuizEngine.screen(config, state, at)), Enum.at(run["views"], i)) -> "run “#{run["name"]}”, view #{i}: #{d}"
            d = diff(json(state), Enum.at(run["states"], i)) -> "run “#{run["name"]}”, state #{i}: #{d}"
            true -> nil
          end
        end

        case check.(0, state, start) do
          nil ->
            run["events"]
            |> Enum.with_index()
            |> Enum.reduce_while({state, []}, fn {e, i}, {state, _} ->
              state = step(config, state, e, e["at"])

              case check.(i + 1, state, e["at"]) do
                nil -> {:cont, {state, []}}
                failure -> {:halt, {state, [failure]}}
              end
            end)
            |> elem(1)

          failure ->
            [failure]
        end
      end)

    assert failures == []
    assert length(cases("runs")) == 9
    assert Js.string([1.0, 2.0]) == "1,2"
  end
end
