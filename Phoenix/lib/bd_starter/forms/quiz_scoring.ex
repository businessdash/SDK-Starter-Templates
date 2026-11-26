defmodule BdStarter.Forms.QuizScoring do
  @moduledoc """
  Quiz grading: answer keys, accepted answers, thresholds, rationale and the
  score BD records for an attempt. A port of forms-core's `quiz-scoring.ts`
  (by way of the Swift SDK); `QuizParityTest` replays the TypeScript answers.

  It grades LOCAL quizzes, ones whose fields carry their answer keys (the
  bundled sample). An invited or practice quiz from BD arrives without keys,
  and BD grades every answer.

  A question's result is a JSON map, as BD sends one: `fieldId, label,
  answer, status, pointsPossible, pointsEarned, accuracyPercent, passingGrade,
  correctThreshold, partiallyCorrectThreshold, passed, correctAnswers,
  rationale, reason`.
  """

  alias BdStarter.Forms.{Field, Js, Json, Re}

  @default_passing_grade 80.0
  @default_correct_threshold 85.0
  @default_partial_threshold 50.0
  @statuses ~w(correct partially_correct incorrect pending_ai unscored)

  @non_question_types ~w(title subtitle separator flex_row input_group multi_populator condition_block or_condition image richtext body_text bullet_list table calculation credit_card)

  def default_passing_grade, do: @default_passing_grade

  # ── Reading BD's results ──────────────────────────────────────────────────

  @doc "A result from BD, with an unknown status read as incorrect."
  def read_result(raw) do
    result = Json.obj(raw) || %{}
    if result["status"] in @statuses, do: result, else: Map.put(result, "status", "incorrect")
  end

  @doc "An attempt's completion from BD: its results read as above."
  def read_completion(raw) do
    completion = Json.obj(raw) || %{}

    completion
    |> Map.put("status", Json.str(completion["status"]) || "scored")
    |> Map.put("results", Enum.map(Json.list(completion["results"]) || [], &read_result/1))
  end

  # ── Answer keys ───────────────────────────────────────────────────────────

  defp accepted(json) do
    %{
      has_text: Json.has?(json, "text"),
      text: Json.str(Json.get(json, "text")),
      option_id: Json.str(Json.get(json, "option_id")),
      validate_with_ai: Json.get(json, "validate_with_ai") == true
    }
  end

  defp choice_id(%{option_id: id}) when id not in [nil, ""], do: id
  defp choice_id(_), do: nil

  @doc "The field's answer key, or nil for a question nobody grades."
  def answer_key(field) do
    o = field.raw["quizAnswerKey"]

    if not Json.truthy?(o) do
      nil
    else
      rationale = Json.obj(Json.get(o, "rationale"))
      answer = Json.get(o, "answer")

      additional =
        Enum.map(Json.list(Json.get(o, "additional_accepted_answers")) || [], &accepted/1)

      first = if Json.truthy?(answer), do: accepted(answer)

      %{
        accepted: if(first != nil, do: [first | additional], else: additional),
        no_wrong_answer: Json.truthy?(Json.get(o, "no_wrong_answer")),
        why_right: Json.str(Json.get(rationale, "why_right")),
        why_wrong: Json.str(Json.get(rationale, "why_wrong")),
        why_wrong_by_option_id:
          (Json.obj(Json.get(rationale, "why_wrong_by_option_id")) || %{})
          |> Enum.filter(fn {_, v} -> is_binary(v) end)
          |> Map.new(),
        reason: Json.str(Json.get(o, "reason")),
        points: Json.num(Json.get(o, "points")),
        passing_grade: Json.num(Json.get(o, "passing_grade")),
        correct_threshold: Json.num(Json.get(o, "correct_threshold")),
        partial_threshold: Json.num(Json.get(o, "partially_correct_threshold"))
      }
    end
  end

  def option_ids(field) do
    Enum.map(Json.list(field.raw["quizOptionIds"]) || [], fn id ->
      if is_binary(id), do: id, else: Js.string(id)
    end)
  end

  # ── Text ──────────────────────────────────────────────────────────────────

  def blank?(value) do
    cond do
      value in [nil, :undefined] -> true
      is_list(value) -> value == []
      is_binary(value) -> value == "" or Js.trim(Js.strip_tags(value)) == ""
      true -> false
    end
  end

  @doc "Tags dropped, whitespace collapsed, lower-cased: how answers compare."
  def normalized_text(value) do
    text = value |> Js.string() |> Js.strip_tags() |> Js.trim()
    Js.lower(Regex.replace(Re.get("[" <> Js.whitespace() <> "]+", "u"), text, " "))
  end

  def option_labels(%Field{type: "choice_cards"} = field),
    do: Enum.map(Field.cards(field), & &1["label"])

  def option_labels(field), do: Field.options(field) || []

  defp clean_rationale(nil), do: nil

  defp clean_rationale(value) do
    cleaned = Js.trim(value)

    cond do
      cleaned == "" -> nil
      Js.length(cleaned) <= 2000 -> cleaned
      true -> Js.slice(cleaned, 0, 2000)
    end
  end

  defp accepted_label(_field, %{has_text: true, text: text}), do: clean_rationale(text)
  defp accepted_label(_field, %{option_id: nil}), do: nil

  defp accepted_label(field, %{option_id: option_id}) do
    labels = option_labels(field)

    case Enum.find_index(option_ids(field), &(&1 == option_id)) do
      i when i != nil and i < length(labels) -> clean_rationale(Enum.at(labels, i))
      _ -> clean_rationale(option_id)
    end
  end

  @doc "What counts as right, for showing."
  def correct_answers(field) do
    case answer_key(field) do
      nil -> []
      %{no_wrong_answer: true} -> ["Any non-empty response"]
      key -> key.accepted |> Enum.map(&accepted_label(field, &1)) |> Enum.reject(&is_nil/1)
    end
  end

  # [{option id, label}] of each choice picked.
  defp selected_options(field, value) do
    labels = option_labels(field)
    ids = option_ids(field)

    Enum.flat_map(if(is_list(value), do: value, else: [value]), fn selected ->
      normalized = normalized_text(selected)

      hit =
        labels
        |> Enum.with_index()
        |> Enum.find(fn {label, i} ->
          normalized_text(label) == normalized or normalized_text(Enum.at(ids, i)) == normalized
        end)

      case hit do
        {label, i} ->
          option_id = Enum.at(ids, i) || ""
          if option_id != "" and label != "", do: [{option_id, label}], else: []

        nil ->
          []
      end
    end)
  end

  defp result_rationale(field, key, value, outcome) do
    why_right = clean_rationale(key.why_right || key.reason)
    why_wrong = clean_rationale(key.why_wrong)
    accepted = key.accepted |> Enum.map(&choice_id/1) |> Enum.reject(&is_nil/1)

    explain = fn option_id, accepted? ->
      clean_rationale(
        if accepted?,
          do: why_right,
          else: Map.get(key.why_wrong_by_option_id, option_id) || why_wrong
      )
    end

    note = fn id, option, accepted?, explanation ->
      %{
        "optionId" => id,
        "option" => option,
        "accepted" => accepted?,
        "explanation" => explanation
      }
    end

    selections =
      Enum.map(selected_options(field, value), fn {id, label} ->
        accepted? = id in accepted
        note.(id, label, accepted?, explain.(id, accepted?))
      end)

    selected_explanation = if length(selections) == 1, do: hd(selections)["explanation"]
    ids = option_ids(field)

    option_explanations =
      field
      |> option_labels()
      |> Enum.with_index()
      |> Enum.flat_map(fn {option, index} ->
        option_id = Enum.at(ids, index) || ""

        if option_id == "" do
          []
        else
          accepted? = option_id in accepted
          explanation = explain.(option_id, accepted?)
          if explanation != nil, do: [note.(option_id, option, accepted?, explanation)], else: []
        end
      end)

    explanation =
      if blank?(value) or outcome == "correct",
        do: why_right,
        else: selected_explanation || why_wrong

    any_selected = Enum.any?(selections, &(&1["explanation"] != nil))

    if explanation == nil and not any_selected and option_explanations == [] do
      nil
    else
      %{
        "outcome" => outcome,
        "explanation" => explanation,
        "selectedOptions" => if(selections == [], do: nil, else: selections),
        "optionExplanations" => if(option_explanations == [], do: nil, else: option_explanations)
      }
    end
  end

  defp matches?(field, accepted, value) do
    case choice_id(accepted) do
      nil ->
        normalized_text(value) == normalized_text(accepted.text)

      option_id ->
        labels = option_labels(field)
        index = Enum.find_index(option_ids(field), &(&1 == option_id))
        want_label = normalized_text(if index != nil, do: Enum.at(labels, index))
        want_id = normalized_text(option_id)

        hit = fn item ->
          got = normalized_text(item)
          got == want_label or got == want_id
        end

        if is_list(value), do: Enum.any?(value, hit), else: hit.(value)
    end
  end

  @doc "The label is one of the result's accepted answers."
  def accepted_label?(result, label) do
    wanted = normalized_text(label)
    Enum.any?(Json.list(result["correctAnswers"]) || [], &(normalized_text(&1) == wanted))
  end

  defp condition_matches?(field, data) do
    rule = Field.rule(field)
    field_id = Json.str(rule && rule["fieldId"])

    if field_id in [nil, ""] do
      true
    else
      current = Map.get(data, field_id, :undefined)

      clauses =
        case Json.list(rule["clauses"]) || [] do
          [] -> [{Json.str(rule["operator"]) || "eq", Json.str(rule["value"]) || ""}]
          listed -> Enum.map(listed, fn c -> {c["operator"], Json.str(c["value"]) || ""} end)
        end

      Enum.all?(clauses, fn {op, value} ->
        case op do
          "eq" -> Js.string(current) == value
          "neq" -> Js.string(current) != value
          "contains" -> String.contains?(normalized_text(current), normalized_text(value))
          "gt" -> Js.gt(Js.number(current), Js.number(value))
          "lt" -> Js.lt(Js.number(current), Js.number(value))
          "is_empty" -> blank?(current)
          "is_not_empty" -> not blank?(current)
          _ -> true
        end
      end)
    end
  end

  defp safe_points(v) when is_float(v), do: v |> max(0.0) |> min(1000.0)
  defp safe_points(_), do: 1.0

  defp safe_percent(v, _fallback) when is_float(v), do: v |> max(0.0) |> min(100.0)
  defp safe_percent(_, fallback), do: fallback

  # ── Grading ───────────────────────────────────────────────────────────────

  defp grade(field, value, result_id) do
    label = if field.label == "", do: "Untitled question", else: field.label

    case answer_key(field) do
      nil ->
        %{
          "fieldId" => result_id,
          "label" => label,
          "answer" => value,
          "status" => "unscored",
          "pointsPossible" => 0.0,
          "pointsEarned" => 0.0
        }

      key ->
        points = safe_points(key.points)
        correct_threshold = safe_percent(key.correct_threshold, @default_correct_threshold)
        passing_grade = safe_percent(key.passing_grade, @default_passing_grade)

        partial_threshold =
          min(correct_threshold, safe_percent(key.partial_threshold, @default_partial_threshold))

        correct =
          if key.no_wrong_answer,
            do: not blank?(value),
            else: Enum.any?(key.accepted, &matches?(field, &1, value))

        pending_ai =
          not correct and not blank?(value) and
            Enum.any?(key.accepted, &(&1.has_text and &1.validate_with_ai))

        accuracy = if pending_ai, do: nil, else: if(correct, do: 100.0, else: 0.0)

        status =
          cond do
            accuracy == nil -> "pending_ai"
            accuracy >= correct_threshold -> "correct"
            accuracy >= partial_threshold -> "partially_correct"
            true -> "incorrect"
          end

        correct_answers = correct_answers(field)
        reason = if key.reason == nil, do: nil, else: Js.trim(key.reason)

        %{
          "fieldId" => result_id,
          "label" => label,
          "answer" => value,
          "status" => status,
          "pointsPossible" => points,
          "pointsEarned" => if(accuracy == nil, do: 0.0, else: points * (accuracy / 100)),
          "accuracyPercent" => accuracy,
          "passingGrade" => passing_grade,
          "correctThreshold" => correct_threshold,
          "partiallyCorrectThreshold" => partial_threshold,
          "passed" => if(accuracy == nil, do: nil, else: accuracy >= passing_grade),
          "correctAnswers" => if(correct_answers == [], do: nil, else: correct_answers),
          "rationale" =>
            if(status == "pending_ai", do: nil, else: result_rationale(field, key, value, status)),
          "reason" => if(reason == "", do: nil, else: reason)
        }
    end
  end

  defp walk(nodes, scope, prefix) do
    Enum.flat_map(nodes, fn field ->
      case field.type do
        "condition_block" ->
          if condition_matches?(field, scope),
            do: walk(field.children || [], scope, prefix),
            else: []

        t when t in ["input_group", "flex_row", "or_condition"] ->
          walk(field.children || [], scope, prefix)

        "multi_populator" ->
          (Json.list(Map.get(scope, field.id)) || [])
          |> Enum.with_index()
          |> Enum.flat_map(fn {instance, index} ->
            if Json.object?(instance),
              do: walk(field.children || [], instance, "#{prefix}#{field.id}[#{index}]."),
              else: []
          end)

        t when t in @non_question_types ->
          []

        _ ->
          [grade(field, Map.get(scope, field.id), prefix <> field.id)]
      end
    end)
  end

  @doc """
  Grade an attempt: `status, results, pointsEarned, pointsPossible,
  scorePercent, provisionalScorePercent, passed` (a JSON map).
  """
  def score(fields, answers, passing_score) do
    results = walk(fields, answers, "")
    scorable = Enum.filter(results, &(&1["pointsPossible"] > 0))
    possible = Enum.reduce(scorable, 0.0, &(&1["pointsPossible"] + &2))
    earned = Enum.reduce(scorable, 0.0, &(&1["pointsEarned"] + &2))
    provisional = if possible == 0, do: 0.0, else: earned / possible * 100
    pending = Enum.any?(scorable, &(&1["status"] == "pending_ai"))
    percent = if pending, do: nil, else: provisional

    %{
      "status" => if(pending, do: "pending_ai_review", else: "scored"),
      "results" => results,
      "pointsEarned" => earned,
      "pointsPossible" => possible,
      "scorePercent" => percent,
      "provisionalScorePercent" => provisional,
      "passed" => if(percent == nil, do: nil, else: percent >= passing_score)
    }
  end
end
