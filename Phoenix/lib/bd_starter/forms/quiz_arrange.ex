defmodule BdStarter.Forms.QuizArrange do
  @moduledoc """
  Which fields are questions, and their order: as written, or a seeded
  shuffle that's the same for the same seed on every platform (FNV-1a and
  mulberry32, as forms-core uses).
  """

  import Bitwise

  alias BdStarter.Forms.{Field, Json, QuizScoring}

  @m 0xFFFFFFFF
  @multiple_choice_types ~w(radio checkbox multi_select choice_cards)

  def multiple_choice?(field),
    do: field.type in @multiple_choice_types and QuizScoring.option_labels(field) != []

  def multi_select?(field) do
    field.type in ["checkbox", "multi_select"] or
      (field.type == "choice_cards" and Field.config(field, "choiceConfig", "mode") == "multi")
  end

  @doc "A, B, … Z, then 27, 28, …"
  def choice_letter(index) when index < 26, do: <<65 + index>>
  def choice_letter(index), do: Integer.to_string(index + 1)

  @doc "The questions: the listed ids, or every field with an answer key."
  def question_fields(fields, ids) do
    Enum.flat_map(fields, fn field ->
      id = Json.str(field.raw["id"]) || ""
      wanted = if ids != nil, do: id in ids, else: Json.truthy?(field.raw["quizAnswerKey"])
      own = if id != "" and wanted, do: [field], else: []
      own ++ if(field.children != nil, do: question_fields(field.children, ids), else: [])
    end)
  end

  @doc "32-bit FNV-1a over the UTF-8 bytes."
  def seed_hash(text) do
    for <<byte <- text>>, reduce: 0x811C9DC5 do
      hash -> band(bxor(hash, byte) * 0x01000193, @m)
    end
  end

  defp mul32(a, b), do: band(a * b, @m)

  @doc "A Fisher–Yates shuffle of 0..<count, driven by mulberry32."
  def seeded_order(count, _seed) when count <= 0, do: []

  def seeded_order(count, seed) do
    start = {List.to_tuple(Enum.to_list(0..(count - 1))), seed_hash(seed)}

    {order, _} =
      Enum.reduce((count - 1)..1//-1, start, fn i, {order, state} ->
        state = band(state + 0x6D2B79F5, @m)
        t = mul32(bxor(state, state >>> 15), bor(state, 1))
        t = band(bxor(t, band(t + mul32(bxor(t, t >>> 7), bor(t, 61)), @m)), @m)
        r = band(bxor(t, t >>> 14), @m)
        j = (r * (i + 1)) >>> 32
        a = elem(order, i)
        b = elem(order, j)
        {order |> put_elem(i, b) |> put_elem(j, a), state}
      end)

    Tuple.to_list(order)
  end

  defp reorder(items, order) when length(items) == length(order) do
    indexed = List.to_tuple(items)
    Enum.map(order, &elem(indexed, &1))
  end

  defp reorder(items, _), do: items

  @doc "A multiple-choice question with its choices (and their ids) in the seed's order."
  def shuffled_choices(field, seed) do
    if not multiple_choice?(field) or field.raw["quizKeepChoiceOrder"] == true do
      field
    else
      order = seeded_order(length(QuizScoring.option_labels(field)), "#{seed}:#{field.id}")
      raw = field.raw
      config = raw["choiceConfig"]

      raw =
        cond do
          field.type == "choice_cards" and Json.object?(config) and is_list(config["options"]) ->
            Map.put(
              raw,
              "choiceConfig",
              Map.put(config, "options", reorder(config["options"], order))
            )

          is_list(raw["options"]) ->
            Map.put(raw, "options", reorder(raw["options"], order))

          true ->
            raw
        end

      raw =
        if is_list(raw["quizOptionIds"]),
          do: Map.put(raw, "quizOptionIds", reorder(raw["quizOptionIds"], order)),
          else: raw

      Field.new(raw)
    end
  end

  def random_seed, do: Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)

  @doc "The questions in the order this run asks them."
  def questions(options, seed, local) do
    questions = question_fields(options.fields, options.question_field_ids)

    questions =
      if options.shuffle_questions do
        indexed = List.to_tuple(questions)
        Enum.map(seeded_order(length(questions), "#{seed}:questions"), &elem(indexed, &1))
      else
        questions
      end

    questions =
      if local and options.question_limit != nil and options.question_limit > 0,
        do: Enum.take(questions, options.question_limit),
        else: questions

    if options.shuffle_choices,
      do: Enum.map(questions, &shuffled_choices(&1, seed)),
      else: questions
  end
end
