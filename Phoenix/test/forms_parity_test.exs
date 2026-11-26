defmodule BdStarter.FormsParityTest do
  @moduledoc """
  Replays `forms-parity.json`: inputs run through the TypeScript forms-core by
  `sdk/scripts/gen-native-forms.ts`, with the answers TypeScript gave. Every
  case here must agree, or this starter's forms would tell a visitor something
  the web renderer and the server don't.
  """
  use ExUnit.Case, async: true

  import BdStarter.Parity

  alias BdStarter.Forms.{Calculation, Field, Formula, Js, Json, Rules, Units}

  @fixtures fixtures("forms-parity.json")

  defp cases(key), do: Map.fetch!(@fixtures, key)

  defp assert_none(failures) do
    assert Enum.take(failures, 40) == [], "#{length(failures)} mismatch(es)"
  end

  test "number to string" do
    failures =
      for c <- cases("numberStrings"),
          got <- [Js.string(untag(c["input"]))],
          got != c["output"],
          do: "String(#{c["output"]}) gave #{got}"

    assert_none(failures)
  end

  test "string to number" do
    failures =
      for c <- cases("numberParses"),
          got <- [Js.number(c["input"])],
          not same?(got, untag(c["output"])),
          do: "Number(#{inspect(c["input"])}) gave #{show(got)}"

    assert_none(failures)
  end

  test "to fixed" do
    failures =
      for c <- cases("toFixed"),
          got <- [Js.to_fixed(c["input"], Kernel.trunc(c["decimals"]))],
          got != c["output"],
          do: "(#{c["input"]}).toFixed(#{c["decimals"]}) gave #{got}, want #{c["output"]}"

    assert_none(failures)
  end

  test "formulas" do
    failures =
      Enum.flat_map(cases("formula"), fn c ->
        functions = Formula.user_functions(c["functions"] || %{})
        r = Formula.run(c["src"], c["vars"] || %{}, functions)
        want = c["result"]

        gave = fn ->
          case r,
            do: (
              {:ok, v} -> show(v)
              {:error, e} -> "error " <> e
            )
        end

        cond do
          want["ok"] == true ->
            case r do
              {:ok, v} ->
                if same?(v, untag(want["value"])),
                  do: [],
                  else: ["#{c["src"]} gave #{gave.()}, want #{show(untag(want["value"]))}"]

              _ ->
                ["#{c["src"]} gave #{gave.()}, want #{show(untag(want["value"]))}"]
            end

          r == {:error, want["error"]} ->
            []

          true ->
            ["#{c["src"]} gave #{gave.()}, want error #{want["error"]}"]
        end
      end)

    assert_none(failures)
  end

  test "conditions" do
    spec = %{
      "fieldId" => "s",
      "operator" => "s",
      "value" => "s",
      "match" => "s",
      "matchField" => "s",
      "clauses" => {:list, %{"operator" => "s!", "value" => "s"}}
    }

    failures =
      for c <- cases("conditions"),
          rule <- [if(Field.fits?(c["rule"], spec), do: c["rule"])],
          data <- [if(Map.has_key?(c, "value"), do: %{"a" => c["value"]}, else: %{})],
          got <- [Rules.eval_condition_on(rule, data)],
          got != c["result"],
          do:
            "#{Json.encode!(c["rule"])} on #{if Map.has_key?(c, "value"), do: Json.encode!(c["value"]), else: "missing"} gave #{got}"

    assert_none(failures)
  end

  test "validation" do
    failures =
      Enum.flat_map(cases("validation"), fn c ->
        field = Field.new(c["field"])
        value = c["value"]

        label =
          "#{field.type} #{if Map.has_key?(c, "value"), do: Json.encode!(value), else: "missing"}"

        empty = Rules.empty?(field, value)
        reason = Rules.validate_value(field, value)

        if(empty != c["empty"], do: ["isEmpty #{label}: want #{c["empty"]}"], else: []) ++
          if(reason != c["reason"],
            do: [
              "validate #{label} #{Json.encode!(c["field"])}: gave #{inspect(reason)}, want #{inspect(c["reason"])}"
            ],
            else: []
          )
      end)

    assert_none(failures)
  end

  test "trees" do
    failures =
      Enum.flat_map(cases("trees"), fn c ->
        fields = Field.list(c["fields"])
        data = c["data"]
        missing = Enum.map(Rules.find_missing_required(fields, data), & &1.id)
        seed = Rules.seed_initial_data(fields)
        payload = Rules.to_submission_payload(fields, data)

        if(missing != c["missing"],
          do: ["missing #{c["name"]}: gave #{inspect(missing)}, want #{inspect(c["missing"])}"],
          else: []
        ) ++
          if(not same?(seed, c["seed"]),
            do: ["seed #{c["name"]}: gave #{inspect(seed)}, want #{inspect(c["seed"])}"],
            else: []
          ) ++
          if(not same?(payload, c["payload"]),
            do: ["payload #{c["name"]}: gave #{inspect(payload)}, want #{inspect(c["payload"])}"],
            else: []
          )
      end)

    assert_none(failures)
  end

  test "units" do
    failures =
      Enum.flat_map(cases("units"), fn c ->
        category = Units.category(c["category"])
        base = Units.to_base(c["value"], c["unit"], category)
        back = if base == nil, do: nil, else: Units.from_base(base, c["unit"], category)
        formatted = Units.format(c["value"], c["unit"], category)

        if(not same?(base, c["base"]),
          do: ["base #{c["value"]} #{c["unit"]}: gave #{show(base)}"],
          else: []
        ) ++
          if(not same?(back, c["back"]),
            do: ["back #{c["value"]} #{c["unit"]}: gave #{show(back)}"],
            else: []
          ) ++
          if(formatted != c["formatted"],
            do: ["format #{c["value"]} #{c["unit"]}: gave #{formatted}, want #{c["formatted"]}"],
            else: []
          )
      end)

    assert_none(failures)
  end

  defp fn_def, do: @fixtures["fnDef"] |> Map.put("id", "fn1") |> Map.put("slug", "quote")

  test "calculations" do
    failures =
      Enum.flat_map(cases("calculations"), fn c ->
        config = if Field.fits?(c["config"], Field.calculation_spec()), do: c["config"], else: %{}
        values = c["values"]
        r = Calculation.compute(config, &Map.get(values, &1), %{"fn1" => fn_def()})
        want = c["result"]
        label = Json.encode!(c["config"])

        if(r.ok != want["ok"], do: ["ok #{label}"], else: []) ++
          if(not same?(r.value, want["value"]),
            do: ["value #{label}: gave #{show(r.value)}"],
            else: []
          ) ++
          if(r.error != want["error"],
            do: ["error #{label}: gave #{inspect(r.error)}, want #{inspect(want["error"])}"],
            else: []
          ) ++
          if(Map.has_key?(want, "outputs") and not same?(r.outputs, want["outputs"]),
            do: ["outputs #{label}: gave #{show(r.outputs)}"],
            else: []
          )
      end)

    assert_none(failures)
  end

  test "business functions" do
    failures =
      Enum.flat_map(cases("businessFunctions"), fn c ->
        r = Calculation.run_function(fn_def(), c["inputs"])
        want = c["result"]
        label = Json.encode!(c["inputs"])
        issues = Enum.map(want["issues"], fn i -> "#{i["scope"]}/#{i["key"]}: #{i["reason"]}" end)

        if(r.ok != want["ok"], do: ["ok #{label}"], else: []) ++
          if(not same?(r.outputs, want["outputs"]),
            do: ["outputs #{label}: gave #{inspect(r.outputs)}"],
            else: []
          ) ++
          if(r.issues != issues,
            do: ["issues #{label}: gave #{inspect(r.issues)}, want #{inspect(issues)}"],
            else: []
          )
      end)

    assert_none(failures)
  end

  test "calc format" do
    failures =
      for c <- cases("calcFormat"),
          display <- [if(Field.fits?(c["display"], Field.display_spec()), do: c["display"])],
          got <- [Calculation.format(c["value"], display)],
          got != c["output"],
          do:
            "#{inspect(c["value"])} #{Json.encode!(c["display"])}: gave #{got}, want #{c["output"]}"

    assert_none(failures)
  end
end
