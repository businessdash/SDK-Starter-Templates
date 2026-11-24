defmodule BdStarter.Forms.Js do
  @moduledoc """
  The JavaScript coercions and arithmetic BD's form rules are written in terms of.

  Conditions compare `String(value)`, numeric operators use `Number(x)`, a
  calculation's display uses `toFixed`. Matching the server means matching
  these exactly, odd corners included (`String([1,2])` is "1,2", `Number("")`
  is 0, `(0.25).toFixed(1)` is "0.3").

  A number is a float, or one of `:nan`, `:infinity` and `:neg_infinity` —
  the BEAM's floats have no NaN or ±Infinity, and form maths needs all three
  (`Number("abc")`, `1 / 0`). `:undefined` is JavaScript's undefined; `nil`
  is null.
  """

  import Kernel, except: [trunc: 1, round: 1, floor: 1, ceil: 1, length: 1]
  import Bitwise, only: [<<<: 2]

  alias BdStarter.Forms.Re

  @whitespace "\\x{9}-\\x{D}\\x{20}\\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}"

  @doc "The characters `String.prototype.trim` removes, as a regex class body."
  def whitespace, do: @whitespace

  defguard is_num(x) when is_float(x) or is_integer(x) or x in [:nan, :infinity, :neg_infinity]

  # ── Coercions ─────────────────────────────────────────────────────────────

  @doc "`String(value)`."
  def string(nil), do: ""
  def string(:undefined), do: ""
  def string(true), do: "true"
  def string(false), do: "false"
  def string(v) when is_num(v), do: number_string(v)
  def string(v) when is_binary(v), do: v

  def string(v) when is_list(v),
    do: Enum.map_join(v, ",", fn item -> if item in [nil, :undefined], do: "", else: string(item) end)

  def string(_), do: "[object Object]"

  @doc "`Number(value)`."
  def number(:undefined), do: :nan
  def number(nil), do: 0.0
  def number(true), do: 1.0
  def number(false), do: 0.0
  def number(v) when is_integer(v), do: v * 1.0
  def number(v) when is_num(v), do: v
  def number(v) when is_binary(v), do: parse_number(v)
  def number(v) when is_list(v), do: parse_number(string(v))
  def number(_), do: :nan

  @doc "`Number(string)`: hex/binary/octal literals, Infinity, whitespace, and \"\" → 0."
  def parse_number(raw) do
    s = trim(raw)

    cond do
      s == "" ->
        0.0

      s in ["Infinity", "+Infinity"] ->
        :infinity

      s == "-Infinity" ->
        :neg_infinity

      m = Regex.run(~r/^0([xXbBoO])(.*)\z/s, s) ->
        [_, kind, digits] = m
        radix = %{"x" => 16, "b" => 2, "o" => 8}[String.downcase(kind)]
        radix_value(digits, radix)

      Regex.match?(~r/^[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)\z/, s) ->
        decimal(s)

      true ->
        :nan
    end
  end

  defp radix_value("", _), do: :nan

  defp radix_value(digits, radix) do
    digits
    |> String.to_charlist()
    |> Enum.reduce_while(0.0, fn char, acc ->
      digit =
        cond do
          char in ?0..?9 -> char - ?0
          char in ?a..?f -> char - ?a + 10
          char in ?A..?F -> char - ?A + 10
          true -> 99
        end

      if digit >= radix, do: {:halt, :nan}, else: {:cont, add(mul(acc, radix * 1.0), digit * 1.0)}
    end)
  end

  # A syntactically valid decimal, read as the nearest float.
  defp decimal(s) do
    {sign, body} =
      case s do
        "-" <> rest -> {-1.0, rest}
        "+" <> rest -> {1.0, rest}
        rest -> {1.0, rest}
      end

    [mantissa | exp] = String.split(String.downcase(body), "e")

    {int, frac} =
      case String.split(mantissa, ".") do
        [i, f] -> {i, f}
        [i] -> {i, ""}
      end

    text = "#{if int == "", do: "0", else: int}.#{if frac == "", do: "0", else: frac}e#{List.first(exp) || "0"}"

    try do
      sign * :erlang.binary_to_float(text)
    rescue
      ArgumentError ->
        # Only an exponent past the float range gets here.
        if all_zero?(int <> frac), do: sign * 0.0, else: if(sign > 0, do: :infinity, else: :neg_infinity)
    end
  end

  defp all_zero?(digits), do: String.trim(digits, "0") == ""

  # ── Numbers as text ───────────────────────────────────────────────────────

  @doc "Number::toString: the shortest digits that read back, laid out the JS way."
  def number_string(:nan), do: "NaN"
  def number_string(:infinity), do: "Infinity"
  def number_string(:neg_infinity), do: "-Infinity"
  def number_string(n) when is_integer(n), do: number_string(n * 1.0)
  def number_string(n) when n == 0, do: "0"
  def number_string(n) when n < 0, do: "-" <> number_string(-n)

  def number_string(n) do
    {digits, point} = shortest_digits(n)
    k = byte_size(digits)

    cond do
      k <= point and point <= 21 ->
        digits <> String.duplicate("0", point - k)

      point > 0 and point <= 21 ->
        binary_part(digits, 0, point) <> "." <> binary_part(digits, point, k - point)

      point > -6 and point <= 0 ->
        "0." <> String.duplicate("0", -point) <> digits

      true ->
        e = point - 1
        mantissa = if k == 1, do: digits, else: binary_part(digits, 0, 1) <> "." <> binary_part(digits, 1, k - 1)
        mantissa <> "e" <> if(e < 0, do: "-", else: "+") <> Integer.to_string(abs(e))
    end
  end

  # The fewest significant digits that read back as `x`, and where the point
  # goes: `x` is 0.d1d2…dk × 10^point.
  defp shortest_digits(x) do
    s = :erlang.float_to_binary(x, [:short])

    {mantissa, exp} =
      case String.split(s, "e") do
        [m, e] -> {m, String.to_integer(e)}
        [m] -> {m, 0}
      end

    {int, frac} =
      case String.split(mantissa, ".") do
        [i, f] -> {i, f}
        [i] -> {i, ""}
      end

    all = int <> frac
    lead = String.trim_leading(all, "0")
    point = byte_size(int) + exp - (byte_size(all) - byte_size(lead))
    digits = String.trim_trailing(lead, "0")
    {if(digits == "", do: "0", else: digits), point}
  end

  @doc "`Number.prototype.toFixed`: the exact binary value, a tie rounded up."
  def to_fixed(n, decimals) do
    places = decimals |> max(0) |> min(100)

    cond do
      n == :nan -> "NaN"
      n in [:infinity, :neg_infinity] -> number_string(n)
      abs(n) >= 1.0e21 -> number_string(n)
      true -> fixed(n * 1.0, places)
    end
  end

  defp fixed(n, places) do
    # -0.0001 keeps its sign ("-0.00"); negative zero doesn't.
    sign = if n < 0, do: "-", else: ""
    {mantissa, exp} = decompose(abs(n))
    scale = Integer.pow(10, places)

    q =
      if exp >= 0 do
        mantissa * Integer.pow(2, exp) * scale
      else
        num = mantissa * scale
        den = Integer.pow(2, -exp)
        q = div(num, den)
        if 2 * rem(num, den) >= den, do: q + 1, else: q
      end

    digits = Integer.to_string(q)

    if places == 0 do
      sign <> digits
    else
      padded = String.pad_leading(digits, places + 1, "0")
      cut = byte_size(padded) - places
      sign <> binary_part(padded, 0, cut) <> "." <> binary_part(padded, cut, places)
    end
  end

  # x = mantissa × 2^exp, exactly.
  defp decompose(x) do
    <<_sign::1, e::11, f::52>> = <<x::float>>
    if e == 0, do: {f, -1074}, else: {f + (1 <<< 52), e - 1075}
  end

  # ── Arithmetic over floats, NaN and ±Infinity ─────────────────────────────

  def finite?(x), do: is_float(x) or is_integer(x)
  def nan?(x), do: x == :nan

  @doc "A whole JS number as a float (integers come in from literals)."
  def f(x) when is_integer(x), do: x * 1.0
  def f(x), do: x

  def neg(:nan), do: :nan
  def neg(:infinity), do: :neg_infinity
  def neg(:neg_infinity), do: :infinity
  def neg(x), do: -f(x)

  def add(a, b) do
    a = f(a)
    b = f(b)

    cond do
      a == :nan or b == :nan -> :nan
      {a, b} in [{:infinity, :neg_infinity}, {:neg_infinity, :infinity}] -> :nan
      a in [:infinity, :neg_infinity] -> a
      b in [:infinity, :neg_infinity] -> b
      true -> overflowing(fn -> a + b end, sign(a))
    end
  end

  def sub(a, b), do: add(a, neg(b))

  def mul(a, b) do
    a = f(a)
    b = f(b)

    cond do
      a == :nan or b == :nan -> :nan
      (infinite?(a) and b == 0) or (infinite?(b) and a == 0) -> :nan
      infinite?(a) or infinite?(b) -> signed_infinity(sign(a) * sign(b))
      true -> overflowing(fn -> a * b end, sign(a) * sign(b))
    end
  end

  def divide(a, b) do
    a = f(a)
    b = f(b)

    cond do
      a == :nan or b == :nan -> :nan
      infinite?(a) and infinite?(b) -> :nan
      infinite?(a) -> signed_infinity(sign(a) * sign(b))
      infinite?(b) -> if sign(a) * sign(b) < 0, do: -0.0, else: 0.0
      b == 0 and a == 0 -> :nan
      b == 0 -> signed_infinity(sign(a) * sign(b))
      true -> overflowing(fn -> a / b end, sign(a) * sign(b))
    end
  end

  @doc "JS `%`: truncated, the dividend's sign."
  def remainder(a, b) do
    a = f(a)
    b = f(b)

    cond do
      a == :nan or b == :nan or infinite?(a) or b == 0 -> :nan
      infinite?(b) -> a
      a == 0 -> a
      true -> :math.fmod(a, b)
    end
  end

  @doc "`Math.pow` / `**`."
  def pow(a, b) do
    a = f(a)
    b = f(b)

    cond do
      b == :nan -> :nan
      b == 0 -> 1.0
      a == :nan -> :nan
      b == :infinity -> pow_inf(a, :pos)
      b == :neg_infinity -> pow_inf(a, :neg)
      a == :infinity -> if b > 0, do: :infinity, else: 0.0
      a == :neg_infinity -> if b > 0, do: if(odd_integer?(b), do: :neg_infinity, else: :infinity), else: if(odd_integer?(b), do: -0.0, else: 0.0)
      a == 0 and b > 0 -> if odd_integer?(b), do: a, else: 0.0
      a == 0 -> if odd_integer?(b) and sign(a) < 0, do: :neg_infinity, else: :infinity
      a < 0 and not integer?(b) -> :nan
      true -> pow_finite(a, b)
    end
  end

  defp pow_inf(a, dir) do
    m = abs(a)

    cond do
      m == 1 -> :nan
      (m > 1 and dir == :pos) or (m < 1 and dir == :neg) -> :infinity
      true -> 0.0
    end
  end

  defp pow_finite(a, b) do
    :math.pow(a, b)
  rescue
    ArithmeticError ->
      grows = abs(a) > 1 == b > 0

      cond do
        not grows -> 0.0
        a < 0 and odd_integer?(b) -> :neg_infinity
        true -> :infinity
      end
  end

  defp overflowing(fun, s) do
    fun.()
  rescue
    ArithmeticError -> signed_infinity(s)
  end

  defp signed_infinity(s) when s < 0, do: :neg_infinity
  defp signed_infinity(_), do: :infinity

  defp infinite?(x), do: x in [:infinity, :neg_infinity]

  @doc "−1 or 1, by the sign bit (so −0.0 is negative)."
  def sign(:infinity), do: 1
  def sign(:neg_infinity), do: -1

  def sign(x) do
    <<s::1, _::63>> = <<f(x)::float>>
    if s == 1, do: -1, else: 1
  end

  def integer?(x) when is_float(x), do: Float.floor(x) == x
  def integer?(x) when is_integer(x), do: true
  def integer?(_), do: false

  defp odd_integer?(x), do: integer?(x) and abs(:math.fmod(f(x), 2.0)) == 1.0

  @doc "`a < b` and friends: false whenever NaN is involved."
  def compare(a, b) do
    a = f(a)
    b = f(b)

    cond do
      a == :nan or b == :nan -> :unordered
      a == b -> :eq
      a == :neg_infinity or b == :infinity -> :lt
      a == :infinity or b == :neg_infinity -> :gt
      a == b -> :eq
      a < b -> :lt
      a > b -> :gt
      true -> :eq
    end
  end

  def lt(a, b), do: compare(a, b) == :lt
  def gt(a, b), do: compare(a, b) == :gt
  def le(a, b), do: compare(a, b) in [:lt, :eq]
  def ge(a, b), do: compare(a, b) in [:gt, :eq]

  @doc "`===` on numbers: NaN is never equal, −0 equals 0."
  def num_eq(a, b), do: compare(a, b) == :eq

  def floor(x) when is_float(x), do: Float.floor(x)
  def floor(x) when is_integer(x), do: x * 1.0
  def floor(x), do: x

  def ceil(x) when is_float(x), do: Float.ceil(x)
  def ceil(x) when is_integer(x), do: x * 1.0
  def ceil(x), do: x

  def abs_num(:neg_infinity), do: :infinity
  def abs_num(x) when is_atom(x), do: x
  def abs_num(x), do: abs(f(x))

  @doc "`Math.round`: a half rounds toward +∞."
  def round(x) when is_atom(x), do: x

  def round(x) do
    x = f(x)
    fl = Float.floor(x)
    if x - fl >= 0.5, do: fl + 1, else: fl
  end

  @doc "Toward zero, as `Math.trunc`."
  def trunc(x) when is_atom(x), do: x
  def trunc(x), do: if(f(x) < 0, do: Float.ceil(f(x)), else: Float.floor(f(x)))

  @doc "`Math.max` / `Math.min` over a list (NaN wins; empty gives ∓Infinity)."
  def max_of([]), do: :neg_infinity
  def max_of(xs), do: if(Enum.member?(xs, :nan), do: :nan, else: Enum.reduce(xs, fn x, acc -> if gt(x, acc), do: f(x), else: acc end) |> f())

  def min_of([]), do: :infinity
  def min_of(xs), do: if(Enum.member?(xs, :nan), do: :nan, else: Enum.reduce(xs, fn x, acc -> if lt(x, acc), do: f(x), else: acc end) |> f())

  @doc "`Math.sqrt`."
  def sqrt(:nan), do: :nan
  def sqrt(:infinity), do: :infinity
  def sqrt(:neg_infinity), do: :nan
  def sqrt(x), do: if(f(x) < 0, do: :nan, else: :math.sqrt(f(x)))

  @doc "`Number.isFinite`."
  def finite_number?(x), do: is_float(x) or is_integer(x)

  # ── Strings ───────────────────────────────────────────────────────────────

  @doc "`String.prototype.trim`."
  def trim(s), do: Regex.replace(Re.get("^[" <> @whitespace <> "]+|[" <> @whitespace <> "]+$", "u"), s, "")

  def whitespace?(char), do: Regex.match?(Re.get("^[" <> @whitespace <> "]\\z", "u"), char)

  @doc "`String.prototype.toLowerCase` (final sigma and İ included)."
  def lower(s), do: String.downcase(s, :greek)

  @doc "`String.prototype.toUpperCase` (ß → SS included)."
  def upper(s), do: String.upcase(s)

  @doc "`.length`: UTF-16 code units."
  def length(s), do: div(byte_size(to_utf16(s)), 2)

  @doc "`String.prototype.slice` over UTF-16 code units."
  def slice(s, start, finish \\ nil) do
    units = to_utf16(s)
    len = div(byte_size(units), 2)

    clamp = fn v ->
      cond do
        v == :nan -> 0
        v == :infinity -> len
        v == :neg_infinity -> 0
        true -> t = Kernel.trunc(trunc(v)); if t < 0, do: max(len + t, 0), else: min(t, len)
      end
    end

    from = clamp.(start)
    to = if finish == nil, do: len, else: clamp.(finish)
    if from >= to, do: "", else: from_utf16(binary_part(units, from * 2, (to - from) * 2))
  end

  def to_utf16(s), do: :unicode.characters_to_binary(s, :utf8, {:utf16, :little})

  @doc "UTF-16 big-endian: byte order is code-unit order, how JavaScript compares strings."
  def to_utf16_big_endian(s), do: :unicode.characters_to_binary(s, :utf8, {:utf16, :big})

  def from_utf16(units) do
    case :unicode.characters_to_binary(units, {:utf16, :little}, :utf8) do
      s when is_binary(s) -> s
      # A lone surrogate half: keep what converts.
      {_, good, _} -> good
    end
  end

  @doc "JavaScript's `<` on strings: by UTF-16 code unit."
  def string_lt(a, b), do: to_utf16_big_endian(a) < to_utf16_big_endian(b)

  @doc "Tags stripped as `/<[^>]*>/g` → \" \"."
  def strip_tags(s), do: Regex.replace(~r/<[^>]*>/, s, " ")

  @doc "`{name}` → value; unknown names stay as written."
  def fill(template, values) do
    Regex.replace(~r/\{([a-zA-Z]+)\}/, template, fn whole, name ->
      case Map.fetch(values, name) do
        {:ok, v} -> to_string(v)
        :error -> whole
      end
    end)
  end

  @doc "A value's text for a page: a string as is, a number as JS prints it, else \"\"."
  def text(v) when is_binary(v), do: v
  def text(v) when is_num(v), do: number_string(v)
  def text(_), do: ""
end
