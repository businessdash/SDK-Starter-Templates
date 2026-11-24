defmodule BdStarter.Forms.Units do
  @moduledoc """
  Measurement conversion: the same table and arithmetic as forms-core's
  `units.ts` (the table itself is generated from it, in `FormsData`).

  A category is `%{key:, label:, base_unit:, affine:, units: [{symbol, factor}, …]}`.
  """

  alias BdStarter.Forms.{Field, FormsData, Js, Json}

  def category(key), do: Enum.find(FormsData.unit_categories(), &(&1.key == key))

  @doc "The field's category, or length when it names none (or an unknown one)."
  def category_of(%Field{} = field),
    do: category(Json.str(Field.config(field, "unitConfig", "category"))) || category("length")

  def symbols(category), do: Enum.map(category.units, &elem(&1, 0))

  def contains?(category, unit), do: unit in symbols(category)

  defp factor(category, unit) do
    case List.keyfind(category.units, unit, 0) do
      {_, f} -> f * 1.0
      nil -> nil
    end
  end

  def to_base(value, unit, category) do
    cond do
      factor(category, unit) == nil -> nil
      category.affine -> affine_to_base(value, unit)
      true -> Js.mul(value, factor(category, unit))
    end
  end

  defp affine_to_base(v, "°C"), do: v
  defp affine_to_base(v, "°F"), do: Js.mul(Js.sub(v, 32.0), 5.0 / 9.0)
  defp affine_to_base(v, "K"), do: Js.sub(v, 273.15)
  defp affine_to_base(_, _), do: nil

  def from_base(base, unit, category) do
    cond do
      factor(category, unit) == nil -> nil
      category.affine -> affine_from_base(base, unit)
      true -> Js.divide(base, factor(category, unit))
    end
  end

  defp affine_from_base(b, "°C"), do: b
  defp affine_from_base(b, "°F"), do: Js.add(Js.mul(b, 9.0 / 5.0), 32.0)
  defp affine_from_base(b, "K"), do: Js.add(b, 273.15)
  defp affine_from_base(_, _), do: nil

  @doc "A friendly restatement, 1500 m → \"1.5 km\": the largest unit the value reaches, to 4 places."
  def format(nil, _, _), do: ""
  def format(:nan, _, _), do: ""

  def format(value, unit, category) do
    tidy = fn n -> n |> Js.to_fixed(4) |> Js.parse_number() |> Js.number_string() end
    base = if category.affine or not contains?(category, unit), do: nil, else: to_base(value, unit, category)

    if base == nil do
      tidy.(value) <> " " <> unit
    else
      ordered = Enum.sort_by(category.units, fn {_, f} -> f end, :desc)
      {last, _} = List.last(ordered)
      magnitude = Js.abs_num(base)

      case Enum.find(ordered, fn {symbol, f} -> Js.ge(magnitude, f * 1.0) or symbol == last end) do
        {symbol, f} -> tidy.(Js.divide(base, f * 1.0)) <> " " <> symbol
        nil -> tidy.(value) <> " " <> unit
      end
    end
  end
end
