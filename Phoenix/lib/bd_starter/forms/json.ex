defmodule BdStarter.Forms.Json do
  @moduledoc """
  Form values as JSON, the shape the forms engine reads them in.

  A form answer is not one Elixir type: a text field holds a string, a
  checkbox group a list, an address an object, a rating a number. So values
  stay JSON: an object is a map with string keys, a list is a list, a number
  is a float (or `:nan` / `:infinity` / `:neg_infinity`, see `Js`), null is
  `nil`.
  """

  alias BdStarter.Forms.Js
  require Js

  @doc "Decode JSON text: whole numbers as floats."
  def decode!(text), do: text |> Jason.decode!() |> normalize()

  @doc "Integers become floats, all the way down."
  def normalize(v) when is_integer(v), do: v * 1.0
  def normalize(v) when is_list(v), do: Enum.map(v, &normalize/1)
  def normalize(v) when is_map(v) and not is_struct(v), do: Map.new(v, fn {k, x} -> {to_string(k), normalize(x)} end)
  def normalize(v), do: v

  @doc """
  JSON text, the way JavaScript's `JSON.stringify` writes it: whole numbers
  without a fraction, NaN and ±Infinity as null.
  """
  def encode!(v), do: Jason.encode!(wire(v))

  @doc "What Jason should see."
  def wire(v) when v in [:nan, :infinity, :neg_infinity, :undefined], do: nil

  def wire(v) when is_float(v) do
    if Float.floor(v) == v and abs(v) < 9_007_199_254_740_992.0, do: Kernel.trunc(v), else: v
  end

  def wire(v) when is_list(v), do: Enum.map(v, &wire/1)

  def wire(v) when is_map(v) and not is_struct(v),
    do: v |> Enum.reject(fn {_, x} -> x == :undefined end) |> Map.new(fn {k, x} -> {to_string(k), wire(x)} end)

  def wire(v), do: v

  # ── Reading ───────────────────────────────────────────────────────────────

  def number?(v), do: Js.is_num(v)
  def list?(v), do: is_list(v)
  def object?(v), do: is_map(v) and not is_struct(v)

  @doc "A member of an object, or nil when it's missing or the value isn't an object."
  def get(obj, key) when is_map(obj) and not is_struct(obj), do: Map.get(obj, key)
  def get(_, _), do: nil

  @doc "The object has the member (even when it's null)."
  def has?(obj, key) when is_map(obj) and not is_struct(obj), do: Map.has_key?(obj, key)
  def has?(_, _), do: false

  def str(v) when is_binary(v), do: v
  def str(_), do: nil

  def num(v) when is_integer(v), do: v * 1.0
  def num(v) when is_float(v) or v in [:nan, :infinity, :neg_infinity], do: v
  def num(_), do: nil

  def bool(v) when is_boolean(v), do: v
  def bool(_), do: nil

  def list(v) when is_list(v), do: v
  def list(_), do: nil

  def obj(v) when is_map(v) and not is_struct(v), do: v
  def obj(_), do: nil

  @doc "The strings of a list, skipping anything else."
  def strings(v) when is_list(v), do: Enum.filter(v, &is_binary/1)
  def strings(_), do: []

  @doc "What JavaScript forms treat as \"no answer\": missing, null, and \"\"."
  def blank?(v), do: v in [nil, "", :undefined]

  @doc "JSON equality: numbers by value (NaN never), objects by members, lists in order."
  def equal?(a, b) do
    cond do
      Js.is_num(a) and Js.is_num(b) ->
        Js.num_eq(a, b)

      is_list(a) and is_list(b) ->
        length(a) == length(b) and Enum.zip(a, b) |> Enum.all?(fn {x, y} -> equal?(x, y) end)

      object?(a) and object?(b) ->
        map_size(a) == map_size(b) and
          Enum.all?(a, fn {k, x} -> Map.has_key?(b, k) and equal?(x, Map.fetch!(b, k)) end)

      true ->
        a === b
    end
  end

  @doc "JavaScript truthiness."
  def truthy?(v) when v in [nil, :undefined, false, :nan, ""], do: false
  def truthy?(v) when is_float(v) or is_integer(v), do: v != 0
  def truthy?(_), do: true
end
