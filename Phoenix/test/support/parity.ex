defmodule BdStarter.Parity do
  @moduledoc """
  Reading the parity fixtures `sdk/scripts/gen-native-forms.ts` writes: the
  TypeScript engine's answers to the same inputs this port is given.
  """

  alias BdStarter.Forms.{Js, Json}

  def fixtures(name), do: Path.join([__DIR__, "..", "fixtures", name]) |> File.read!() |> Json.decode!()

  @doc "Undo the generator's `{\"$number\": \"NaN\"}` tagging."
  def untag(%{"$number" => "NaN"}), do: :nan
  def untag(%{"$number" => "Infinity"}), do: :infinity
  def untag(%{"$number" => "-Infinity"}), do: :neg_infinity
  def untag(v) when is_map(v), do: Map.new(v, fn {k, x} -> {k, untag(x)} end)
  def untag(v) when is_list(v), do: Enum.map(v, &untag/1)
  def untag(v), do: v

  @doc "JSON equality with float tolerance (libm can differ in the last ulp); missing equals nil."
  def same?(a, b, tolerance \\ 1.0e-12) do
    cond do
      Json.number?(a) and Json.number?(b) ->
        x = Js.f(a)
        y = Js.f(b)

        cond do
          x == :nan or y == :nan -> x == y
          is_atom(x) or is_atom(y) -> x == y
          true -> x == y or abs(x - y) <= tolerance * max(abs(x), abs(y))
        end

      is_list(a) and is_list(b) ->
        length(a) == length(b) and Enum.all?(Enum.zip(a, b), fn {x, y} -> same?(x, y, tolerance) end)

      is_map(a) and is_map(b) and not is_struct(a) and not is_struct(b) ->
        keys = Enum.uniq(Map.keys(a) ++ Map.keys(b))
        Enum.all?(keys, fn k -> same?(Map.get(a, k), Map.get(b, k), tolerance) end)

      true ->
        a === b
    end
  end

  def show(v) when v in [:nan, :infinity, :neg_infinity], do: Js.number_string(v)
  def show(v), do: inspect(v, limit: 50)
end
