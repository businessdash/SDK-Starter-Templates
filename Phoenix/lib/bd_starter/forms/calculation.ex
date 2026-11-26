defmodule BdStarter.Forms.Calculation do
  @moduledoc """
  `calculation` fields and business functions: ports of forms-core's
  `calculation.ts` and `business-function.ts`.
  """

  alias BdStarter.Forms.{Dates, Formula, Js, Json}

  @doc "A form value as a formula input: blank is \"no value\", a list reads as its joined text."
  def formula_value(raw) do
    cond do
      Json.blank?(raw) -> nil
      is_list(raw) -> Js.string(raw)
      true -> raw
    end
  end

  @doc """
  Compute a calculation from the field's `calculationConfig`; `resolve` maps a
  field id to its value. Returns `%{ok:, value:, outputs:, error:}`.
  """
  def compute(config, resolve, functions_by_id \\ %{}, user_functions \\ %{}) do
    bindings = Json.list(config["inputMap"]) || []

    if config["mode"] == "function" do
      definition =
        if is_binary(config["functionId"]), do: Map.get(functions_by_id, config["functionId"])

      if definition == nil do
        %{ok: false, value: nil, outputs: nil, error: "Referenced function not found."}
      else
        raw = Map.new(bindings, fn b -> {b["variable"], resolve.(b["fieldId"])} end)
        run = run_function(definition, raw, user_functions)
        first = List.first(Json.list(definition["outputs"]) || [])
        key = Json.str(config["outputKey"]) || Json.str(Json.get(first, "key"))

        %{
          ok: run.ok,
          value: if(key != nil, do: Map.get(run.outputs, key)),
          outputs: run.outputs,
          error: if(run.ok, do: nil, else: Enum.join(run.issues, "; "))
        }
      end
    else
      formula = if is_binary(config["formula"]), do: Js.trim(config["formula"]), else: ""

      if formula == "" do
        %{ok: false, value: nil, outputs: nil, error: "No formula."}
      else
        vars =
          Map.new(bindings, fn b -> {b["variable"], formula_value(resolve.(b["fieldId"]))} end)

        case Formula.run(formula, vars, user_functions) do
          {:ok, value} -> %{ok: true, value: value, outputs: nil, error: nil}
          {:error, message} -> %{ok: false, value: nil, outputs: nil, error: message}
        end
      end
    end
  end

  @doc "Prefix + value + suffix, with fixed decimals for numbers."
  def format(nil, _), do: ""

  def format(value, display) do
    display = display || %{}
    decimals = display["decimals"]

    body =
      cond do
        Json.number?(value) and decimals != nil and Js.finite?(value) ->
          Js.to_fixed(value, Kernel.trunc(decimals))

        is_list(value) or Json.object?(value) ->
          Json.encode!(value)

        true ->
          Js.string(value)
      end

    (display["prefix"] || "") <> body <> (display["suffix"] || "")
  end

  defp iso_date?(s), do: Regex.match?(~r/^\d{4}-\d{2}-\d{2}([T ].*)?$/s, s)

  defp coerce(value, "any"), do: {:ok, value}

  defp coerce(value, "object"),
    do: if(Json.object?(value), do: {:ok, value}, else: {:error, "expected an object"})

  defp coerce(value, "number") do
    case Json.num(value) || Js.number(value) do
      :nan -> {:error, "not a number"}
      n -> {:ok, n}
    end
  end

  defp coerce(value, "boolean") do
    cond do
      is_boolean(value) -> {:ok, value}
      value == "true" or (Json.number?(value) and value == 1) -> {:ok, true}
      value == "false" or (Json.number?(value) and value == 0) -> {:ok, false}
      true -> {:error, "not a boolean"}
    end
  end

  defp coerce(value, "date") do
    s = Js.string(value)
    if iso_date?(s) and Dates.parse_instant(s) != nil, do: {:ok, s}, else: {:error, "not a date"}
  end

  defp coerce(value, _), do: {:ok, if(is_binary(value), do: value, else: Js.string(value))}

  defp matches?(_, "any"), do: true
  defp matches?(v, "number"), do: Json.number?(v) and v != :nan
  defp matches?(v, "text"), do: is_binary(v)
  defp matches?(v, "boolean"), do: is_boolean(v)
  defp matches?(v, "object"), do: Json.object?(v)
  defp matches?(v, "date"), do: is_binary(v) and iso_date?(v)
  defp matches?(_, _), do: false

  @doc """
  Run a business function: coerce and default its inputs, then evaluate each
  output in order (later outputs read earlier ones), falling back where an
  output fails or comes out the wrong type. Returns `%{ok:, outputs:, issues:}`.
  """
  def run_function(definition, raw, user_functions \\ %{}) do
    {vars, issues} =
      Enum.reduce(Json.list(definition["inputs"]) || [], {%{}, []}, fn input, {vars, issues} ->
        key = input["key"]
        value = Map.get(raw, key)

        cond do
          Json.blank?(value) and input["default"] != nil ->
            {Map.put(vars, key, input["default"]), issues}

          Json.blank?(value) and input["required"] == true ->
            {vars, issues ++ ["input/#{key}: required value is missing"]}

          Json.blank?(value) ->
            {vars, issues}

          true ->
            case coerce(value, to_string(input["type"])) do
              {:ok, v} -> {Map.put(vars, key, v), issues}
              {:error, why} -> {vars, issues ++ ["input/#{key}: #{why}"]}
            end
        end
      end)

    {_, outputs, issues} =
      Enum.reduce(Json.list(definition["outputs"]) || [], {vars, %{}, issues}, fn out,
                                                                                  {vars, outputs,
                                                                                   issues} ->
        key = out["key"]

        fallback = fn reason ->
          if out["fallback"] != nil,
            do:
              {Map.put(vars, key, out["fallback"]), Map.put(outputs, key, out["fallback"]),
               issues},
            else: {vars, outputs, issues ++ ["output/#{key}: #{reason}"]}
        end

        case Formula.run(to_string(out["formula"]), vars, user_functions) do
          {:error, message} ->
            fallback.(message)

          {:ok, value} ->
            if matches?(value, to_string(out["type"])),
              do: {Map.put(vars, key, value), Map.put(outputs, key, value), issues},
              else: fallback.("expected #{out["type"]}")
        end
      end)

    %{ok: issues == [], outputs: outputs, issues: issues}
  end
end
