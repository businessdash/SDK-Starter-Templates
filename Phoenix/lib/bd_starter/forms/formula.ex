defmodule BdStarter.Forms.Formula do
  @moduledoc """
  BD's formula language, as `calculation` fields and business functions use
  it: a port of forms-core's `formula.ts`.

  Values are numbers, strings, booleans and objects (`addr.city`). Errors are
  values too: a formula that divides by zero gives a result with a message,
  never an exception, and the message matches the TypeScript engine's, so the
  same formula reports the same problem everywhere.

  A result is `{:ok, value}` or `{:error, message}`.
  """

  alias BdStarter.Forms.{Dates, FormulaParser, Js, Json}
  require Js

  def run(src, vars, functions \\ %{}) do
    case parse(src) do
      {:ok, ast} -> evaluate(ast, vars, functions)
      error -> error
    end
  end

  def evaluate(ast, vars, functions \\ %{}) do
    {:ok, eval(ast, vars, functions, [])}
  rescue
    _ -> {:error, "Formula error."}
  catch
    {:formula_error, message} -> {:error, message}
  end

  @doc """
  Business functions as formula functions, keyed by upper-cased slug. Each
  evaluates its first output; one whose formula doesn't parse is left out.
  """
  def user_functions(defs) do
    Enum.reduce(defs, %{}, fn {name, definition}, acc ->
      first = List.first(Json.list(definition["outputs"]) || [])

      with true <- Json.object?(first) and is_binary(first["formula"]),
           {:ok, ast} <- parse(first["formula"]) do
        params = Enum.map(Json.list(definition["inputs"]) || [], fn input -> to_string(input["key"] || "") end)
        Map.put(acc, to_string(name), %{params: params, ast: ast})
      else
        _ -> acc
      end
    end)
  end

  defp err(message), do: throw({:formula_error, message})

  # ── Tokenizer ─────────────────────────────────────────────────────────────

  @multi_ops ["<=", ">=", "<>", "==", "!=", "&&", "||"]
  @single_ops ["+", "-", "*", "/", "%", "^", "&", "<", ">", "=", "!"]
  @punctuation %{"(" => :lparen, ")" => :rparen, "," => :comma, "." => :dot}

  def tokenize(src), do: src |> String.codepoints() |> tokens([])

  defp tokens([], acc), do: Enum.reverse(acc)
  defp tokens([c | rest], acc) when c in [" ", "\t", "\n", "\r"], do: tokens(rest, acc)

  defp tokens(["\"" | rest], acc) do
    {str, rest} = string_literal(rest, [])
    tokens(rest, [{:str, str} | acc])
  end

  defp tokens([c | rest] = all, acc) do
    cond do
      digit?(c) or (c == "." and digit?(List.first(rest))) ->
        {raw, rest} = number_literal(all)
        value = Js.parse_number(raw)
        if value == :nan, do: err("Invalid number \"#{raw}\".")
        tokens(rest, [{:num, value} | acc])

      ident_start?(c) ->
        {word, rest} = Enum.split_while(all, &ident_part?/1)
        tokens(rest, [{:ident, Enum.join(word)} | acc])

      Map.has_key?(@punctuation, c) ->
        tokens(rest, [{@punctuation[c], nil} | acc])

      rest != [] and (c <> hd(rest)) in @multi_ops ->
        tokens(tl(rest), [{:op, c <> hd(rest)} | acc])

      c in @single_ops ->
        tokens(rest, [{:op, c} | acc])

      true ->
        err("Unexpected character \"#{c}\".")
    end
  end

  defp string_literal([], _), do: err("Unterminated string literal.")
  defp string_literal(["\"" | rest], acc), do: {acc |> Enum.reverse() |> Enum.join(), rest}
  defp string_literal(["\\", c | rest], acc), do: string_literal(rest, [c | acc])
  defp string_literal([c | rest], acc), do: string_literal(rest, [c | acc])

  defp number_literal(chars) do
    {body, rest} = Enum.split_while(chars, &(digit?(&1) or &1 == "."))

    {exponent, rest} =
      case rest do
        [e, next | tail] when e in ["e", "E"] ->
          {sign, tail} = if next in ["+", "-"], do: {[next], tail}, else: {[], [next | tail]}
          {digits, tail} = Enum.split_while(tail, &digit?/1)
          {[e | sign] ++ digits, tail}

        _ ->
          {[], rest}
      end

    {Enum.join(body ++ exponent), rest}
  end

  defp digit?(c) when is_binary(c), do: byte_size(c) == 1 and c >= "0" and c <= "9"
  defp digit?(_), do: false

  defp ident_start?(c), do: byte_size(c) == 1 and (c =~ ~r/^[A-Za-z_]$/)
  defp ident_part?(c), do: byte_size(c) == 1 and (c =~ ~r/^[A-Za-z0-9_]$/)

  # ── Parser ────────────────────────────────────────────────────────────────

  def parse(src) do
    {:ok, src |> tokenize() |> FormulaParser.parse()}
  catch
    {:formula_error, message} -> {:error, message}
  end

  # ── Coercion ──────────────────────────────────────────────────────────────

  def to_num(v) when Js.is_num(v), do: Js.f(v)
  def to_num(true), do: 1.0
  def to_num(false), do: 0.0
  def to_num(nil), do: 0.0

  def to_num(v) when is_binary(v) do
    case Js.parse_number(v) do
      :nan -> err("\"#{v}\" is not a number.")
      n -> n
    end
  end

  def to_num(_), do: err("Cannot use an object as a number.")

  def to_bool(v) when is_boolean(v), do: v
  def to_bool(v) when Js.is_num(v), do: v != 0
  def to_bool(nil), do: false
  def to_bool(v) when is_binary(v), do: v != "" and Js.lower(v) != "false"
  def to_bool(_), do: err("Cannot use an object as a boolean.")

  def to_str(v) when is_binary(v), do: v
  def to_str(v) when is_list(v) or is_map(v), do: err("Cannot use an object as text.")
  def to_str(v), do: Js.string(v)

  defp date(v), do: Dates.parse(v) || err("Invalid date.")

  # Whole milliseconds, as `Date.getTime()`.
  defp ms(x), do: Float.round(x)

  defp months_between(s, e) do
    {ay, am, ad} = Dates.utc_parts(s)
    {by, bm, bd} = Dates.utc_parts(e)
    m = (by - ay) * 12 + (bm - am)
    (if(bd < ad, do: m - 1, else: m)) * 1.0
  end

  defp years_between(s, e) do
    {ay, am, ad} = Dates.utc_parts(s)
    {by, _, _} = Dates.utc_parts(e)
    y = by - ay
    (if(ms(e) < Dates.utc(by, am, ad), do: y - 1, else: y)) * 1.0
  end

  @file_types [
    {"image", ~w(png jpg jpeg gif webp svg avif heic)},
    {"video", ~w(mp4 mov webm mkv avi)},
    {"audio", ~w(mp3 wav m4a flac ogg aac)},
    {"pdf", ~w(pdf)},
    {"doc", ~w(doc docx txt rtf md pages)},
    {"spreadsheet", ~w(xls xlsx csv numbers)},
    {"archive", ~w(zip rar 7z tar gz)}
  ]

  def file_type(url) do
    path = url |> String.split(~r/[?#]/, parts: 2) |> hd() |> Js.trim()

    case :binary.matches(path, ".") do
      [] ->
        "other"

      matches ->
        {at, _} = List.last(matches)
        ext = Js.lower(binary_part(path, at + 1, byte_size(path) - at - 1))
        Enum.find_value(@file_types, "other", fn {type, exts} -> if ext in exts, do: type end)
    end
  end

  @doc "One left-to-right pass, longest find first, so a replacement is never re-matched."
  def substitute_all(text, pairs) do
    active =
      pairs
      |> Enum.with_index()
      |> Enum.reject(fn {{find, _}, _} -> find == "" end)
      |> Enum.map(fn {{find, replace}, i} -> {Js.to_utf16(find), Js.to_utf16(replace), i} end)
      |> Enum.sort_by(fn {find, _, i} -> {-byte_size(find), i} end)

    if active == [] do
      text
    else
      units = Js.to_utf16(text)
      units |> substitute(0, byte_size(units), active, []) |> IO.iodata_to_binary() |> Js.from_utf16()
    end
  end

  defp substitute(_units, i, len, _active, acc) when i >= len, do: Enum.reverse(acc)

  defp substitute(units, i, len, active, acc) do
    hit =
      Enum.find(active, fn {find, _, _} ->
        size = byte_size(find)
        i + size <= len and binary_part(units, i, size) == find
      end)

    case hit do
      {find, replace, _} -> substitute(units, i + byte_size(find), len, active, [replace | acc])
      nil -> substitute(units, i + 2, len, active, [binary_part(units, i, 2) | acc])
    end
  end

  @doc "NFKD, combining marks dropped, lower-cased, runs of anything else as one dash."
  def slugify(text) do
    text
    |> :unicode.characters_to_nfkd_binary()
    |> then(&Regex.replace(~r/[\x{300}-\x{36F}]/u, &1, ""))
    |> Js.lower()
    |> then(&Regex.replace(~r/[^a-z0-9]+/, &1, "-"))
    |> then(&Regex.replace(~r/^-+|-+$/, &1, ""))
  end

  defp haversine(lat1, lng1, lat2, lng2, miles) do
    if Enum.all?([lat1, lng1, lat2, lng2], &is_float/1) do
      rad = fn d -> d * :math.pi() / 180 end
      d_lat = rad.(lat2 - lat1)
      d_lng = rad.(lng2 - lng1)
      a = :math.pow(:math.sin(d_lat / 2), 2) + :math.cos(rad.(lat1)) * :math.cos(rad.(lat2)) * :math.pow(:math.sin(d_lng / 2), 2)
      km = 2 * 6371 * :math.asin(min(1.0, :math.sqrt(a)))
      if miles, do: km * 0.621371, else: km
    else
      :nan
    end
  end

  # ── Functions ─────────────────────────────────────────────────────────────

  @arity %{
    "SUM" => {1, nil},
    "PRODUCT" => {1, nil},
    "ABS" => {1, 1},
    "ROUND" => {1, 2},
    "ROUNDUP" => {1, 2},
    "ROUNDDOWN" => {1, 2},
    "CEILING" => {1, 1},
    "FLOOR" => {1, 1},
    "INT" => {1, 1},
    "MOD" => {2, 2},
    "POWER" => {2, 2},
    "SQRT" => {1, 1},
    "SIGN" => {1, 1},
    "EXP" => {1, 1},
    "LN" => {1, 1},
    "LOG10" => {1, 1},
    "AVERAGE" => {1, nil},
    "MIN" => {1, nil},
    "MAX" => {1, nil},
    "MEDIAN" => {1, nil},
    "COUNT" => {1, nil},
    "COUNTA" => {1, nil},
    "IF" => {2, 3},
    "AND" => {1, nil},
    "OR" => {1, nil},
    "NOT" => {1, 1},
    "XOR" => {1, nil},
    "TRUE" => {0, 0},
    "FALSE" => {0, 0},
    "IFS" => {2, nil},
    "CHOOSE" => {2, nil},
    "SWITCH" => {3, nil},
    "CONCATENATE" => {1, nil},
    "LEN" => {1, 1},
    "LOWER" => {1, 1},
    "UPPER" => {1, 1},
    "SUBSTITUTE" => {3, nil},
    "SLUGIFY" => {1, 1},
    "TRIM" => {1, 1},
    "LEFT" => {1, 2},
    "RIGHT" => {1, 2},
    "MID" => {3, 3},
    "FILETYPE" => {1, 1},
    "TODAY" => {0, 0},
    "YEAR" => {1, 1},
    "MONTH" => {1, 1},
    "DAY" => {1, 1},
    "DAYS" => {2, 2},
    "NOW" => {0, 0},
    "MINUTES" => {2, 2},
    "HOURS" => {2, 3},
    "WEEKS" => {2, 2},
    "MONTHS" => {2, 2},
    "YEARS" => {2, 2},
    "DATEDIFF" => {3, 3},
    "DISTANCE" => {4, 5}
  }

  defp nums(a), do: Enum.map(a, &to_num/1)
  defp arg(a, i, default), do: if(length(a) > i, do: to_num(Enum.at(a, i)), else: default)

  # ROUND and friends: how(x × 10^digits) / 10^digits.
  defp scaled(a, how) do
    f = Js.pow(10.0, arg(a, 1, 0.0))
    Js.divide(how.(Js.mul(to_num(hd(a)), f)), f)
  end

  defp builtin("SUM", a), do: Enum.reduce(nums(a), 0.0, &Js.add(&2, &1))
  defp builtin("PRODUCT", a), do: Enum.reduce(nums(a), 1.0, &Js.mul(&2, &1))
  defp builtin("ABS", [x]), do: Js.abs_num(to_num(x))
  defp builtin("ROUND", a), do: scaled(a, &Js.round/1)
  defp builtin("ROUNDUP", a), do: scaled(a, &Js.ceil/1)
  defp builtin("ROUNDDOWN", a), do: scaled(a, &Js.trunc/1)
  defp builtin("CEILING", [x]), do: Js.ceil(to_num(x))
  defp builtin("FLOOR", [x]), do: Js.floor(to_num(x))
  defp builtin("INT", [x]), do: Js.trunc(to_num(x))
  defp builtin("MOD", [x, y]), do: Js.remainder(to_num(x), to_num(y))
  defp builtin("POWER", [x, y]), do: Js.pow(to_num(x), to_num(y))
  defp builtin("SQRT", [x]), do: Js.sqrt(to_num(x))

  defp builtin("SIGN", [x]) do
    case to_num(x) do
      :nan -> :nan
      n -> cond do
        Js.gt(n, 0.0) -> 1.0
        Js.lt(n, 0.0) -> -1.0
        true -> n
      end
    end
  end

  defp builtin("EXP", [x]), do: exp(to_num(x))
  defp builtin("LN", [x]), do: log(to_num(x), &:math.log/1)
  defp builtin("LOG10", [x]), do: log(to_num(x), &:math.log10/1)
  defp builtin("AVERAGE", a), do: Js.divide(builtin("SUM", a), length(a) * 1.0)
  defp builtin("MIN", a), do: Js.min_of(nums(a))
  defp builtin("MAX", a), do: Js.max_of(nums(a))

  defp builtin("MEDIAN", a) do
    s = a |> nums() |> Enum.sort(&Js.le/2)
    m = div(length(s), 2)
    if rem(length(s), 2) == 1, do: Enum.at(s, m), else: Js.divide(Js.add(Enum.at(s, m - 1), Enum.at(s, m)), 2.0)
  end

  defp builtin("COUNT", a),
    do: Enum.count(a, fn x -> Json.number?(x) or (is_binary(x) and Js.trim(x) != "" and Js.parse_number(x) != :nan) end) * 1.0

  defp builtin("COUNTA", a), do: Enum.count(a, &(&1 != "" and &1 != nil)) * 1.0
  defp builtin("IF", [c, y | rest]), do: if(to_bool(c), do: y, else: List.first(rest, false))
  defp builtin("AND", a), do: Enum.all?(a, &to_bool/1)
  defp builtin("OR", a), do: Enum.any?(a, &to_bool/1)
  defp builtin("NOT", [x]), do: not to_bool(x)
  defp builtin("XOR", a), do: rem(Enum.count(a, &to_bool/1), 2) == 1
  defp builtin("TRUE", []), do: true
  defp builtin("FALSE", []), do: false

  defp builtin("IFS", a) do
    a
    |> Enum.chunk_every(2, 2, :discard)
    |> Enum.find_value(fn [c, v] -> if to_bool(c), do: {:hit, v} end)
    |> case do
      {:hit, v} -> v
      nil -> err("No IFS condition matched.")
    end
  end

  defp builtin("CHOOSE", a) do
    index = Js.trunc(to_num(hd(a)))
    unless Js.ge(index, 0.0) and Js.lt(index, length(a) * 1.0), do: err("CHOOSE index out of range.")
    Enum.at(a, Kernel.trunc(index))
  end

  defp builtin("SWITCH", [subject | cases]) do
    pairs = Enum.chunk_every(cases, 2)

    Enum.find_value(pairs, false, fn
      [v, result] -> if Json.equal?(v, subject), do: {:hit, result}
      [default] -> {:hit, default}
    end)
    |> case do
      {:hit, v} -> v
      other -> other
    end
  end

  defp builtin("CONCATENATE", a), do: Enum.map_join(a, "", &to_str/1)
  defp builtin("LEN", [x]), do: Js.length(to_str(x)) * 1.0
  defp builtin("LOWER", [x]), do: Js.lower(to_str(x))
  defp builtin("UPPER", [x]), do: Js.upper(to_str(x))

  defp builtin("SUBSTITUTE", [text | rest]) do
    text = to_str(text)

    if rem(length(rest), 2) != 0,
      do: err("SUBSTITUTE needs find/replace in pairs — it got an odd number of arguments after the text.")

    pairs = rest |> Enum.chunk_every(2) |> Enum.map(fn [f, r] -> {to_str(f), to_str(r)} end)
    substitute_all(text, pairs)
  end

  defp builtin("SLUGIFY", [x]), do: slugify(to_str(x))
  defp builtin("TRIM", [x]), do: Js.trim(to_str(x))
  defp builtin("LEFT", [x | _] = a), do: Js.slice(to_str(x), 0.0, arg(a, 1, 1.0))
  defp builtin("RIGHT", [x | _] = a), do: Js.slice(to_str(x), Js.neg(arg(a, 1, 1.0)))

  defp builtin("MID", [x, s, n]) do
    start = Js.sub(to_num(s), 1.0)
    Js.slice(to_str(x), start, Js.add(start, to_num(n)))
  end

  defp builtin("FILETYPE", [x]), do: file_type(to_str(x))
  defp builtin("TODAY", []), do: Date.utc_today() |> Date.to_iso8601()
  defp builtin("YEAR", [x]), do: elem(Dates.utc_parts(date(x)), 0) * 1.0
  defp builtin("MONTH", [x]), do: elem(Dates.utc_parts(date(x)), 1) * 1.0
  defp builtin("DAY", [x]), do: elem(Dates.utc_parts(date(x)), 2) * 1.0
  defp builtin("DAYS", [a, b]), do: Js.round((ms(date(a)) - ms(date(b))) / 86_400_000)
  defp builtin("NOW", []), do: Dates.iso_string(System.os_time(:microsecond) / 1000)
  defp builtin("MINUTES", [a, b]), do: Js.round((ms(date(b)) - ms(date(a))) / 60_000)

  defp builtin("HOURS", [a, b | _] = args) do
    f = Js.pow(10.0, arg(args, 2, 2.0))
    h = (ms(date(b)) - ms(date(a))) / 3_600_000
    Js.divide(Js.round(Js.mul(h, f)), f)
  end

  defp builtin("WEEKS", [a, b]), do: Js.trunc((ms(date(b)) - ms(date(a))) / 604_800_000)
  defp builtin("MONTHS", [a, b]), do: months_between(date(a), date(b))
  defp builtin("YEARS", [a, b]), do: years_between(date(a), date(b))

  defp builtin("DATEDIFF", [unit, a, b]) do
    unit = Js.lower(to_str(unit))
    s = date(a)
    e = date(b)
    d = ms(e) - ms(s)

    case unit do
      "minutes" -> Js.round(d / 60_000)
      "hours" -> Js.round(d / 3_600_000 * 100) / 100
      "days" -> Js.round(d / 86_400_000)
      "weeks" -> Js.trunc(d / 604_800_000)
      "months" -> months_between(s, e)
      "years" -> years_between(s, e)
      _ -> err("Unknown DATEDIFF unit \"#{unit}\".")
    end
  end

  defp builtin("DISTANCE", [a, b, c, d | rest]) do
    miles = rest != [] and Js.lower(to_str(hd(rest))) == "mi"
    haversine(to_num(a), to_num(b), to_num(c), to_num(d), miles)
  end

  defp exp(:nan), do: :nan
  defp exp(:infinity), do: :infinity
  defp exp(:neg_infinity), do: 0.0

  defp exp(x) do
    :math.exp(x)
  rescue
    ArithmeticError -> if x > 0, do: :infinity, else: 0.0
  end

  defp log(:nan, _), do: :nan
  defp log(:infinity, _), do: :infinity
  defp log(:neg_infinity, _), do: :nan

  defp log(x, fun) do
    cond do
      x < 0 -> :nan
      x == 0 -> :neg_infinity
      true -> fun.(x)
    end
  end

  # ── Evaluator ─────────────────────────────────────────────────────────────

  defp eval({kind, v}, _, _, _) when kind in [:num, :str, :bool], do: v

  defp eval({:var, name}, vars, _, _) do
    case Map.get(vars, name) do
      v when v in [nil, :undefined] -> err("Variable \"#{name}\" has no value.")
      v -> v
    end
  end

  defp eval({:member, node, key}, vars, fns, stack) do
    obj = eval(node, vars, fns, stack)
    unless Json.object?(obj), do: err("Cannot read field \"#{key}\" of a non-object value.")

    case Map.get(obj, key) do
      nil -> err("Field \"#{key}\" has no value.")
      v -> v
    end
  end

  defp eval({:unary, "NOT", node}, vars, fns, stack), do: not to_bool(eval(node, vars, fns, stack))

  defp eval({:unary, op, node}, vars, fns, stack) do
    x = to_num(eval(node, vars, fns, stack))
    if op == "-", do: Js.neg(x), else: x
  end

  defp eval({:binary, op, l, r}, vars, fns, stack), do: binary(op, l, r, vars, fns, stack)

  defp eval({:call, name, arg_nodes}, vars, fns, stack) do
    case Map.fetch(@arity, name) do
      {:ok, {min, max}} ->
        args = Enum.map(arg_nodes, &eval(&1, vars, fns, stack))
        if length(args) < min or (max != nil and length(args) > max), do: err("#{name} got the wrong number of arguments.")
        builtin(name, args)

      :error ->
        user = Map.get(fns, name) || err("Unknown function \"#{name}\".")
        if name in stack, do: err("Circular function reference: \"#{name}\".")

        if length(arg_nodes) != length(user.params),
          do: err("#{name} expects #{length(user.params)} argument(s).")

        args = Enum.map(arg_nodes, &eval(&1, vars, fns, stack))
        scope = user.params |> Enum.zip(args) |> Map.new()
        eval(user.ast, scope, fns, stack ++ [name])
    end
  end

  defp binary("AND", l, r, vars, fns, stack),
    do: to_bool(eval(l, vars, fns, stack)) and to_bool(eval(r, vars, fns, stack))

  defp binary("OR", l, r, vars, fns, stack),
    do: to_bool(eval(l, vars, fns, stack)) or to_bool(eval(r, vars, fns, stack))

  defp binary(op, ln, rn, vars, fns, stack) do
    l = eval(ln, vars, fns, stack)
    r = eval(rn, vars, fns, stack)

    case op do
      "+" -> Js.add(to_num(l), to_num(r))
      "-" -> Js.sub(to_num(l), to_num(r))
      "*" -> Js.mul(to_num(l), to_num(r))
      "/" -> with_divisor(r, &Js.divide(to_num(l), &1))
      "%" -> with_divisor(r, &Js.remainder(to_num(l), &1))
      "^" -> Js.pow(to_num(l), to_num(r))
      "&" -> to_str(l) <> to_str(r)
      o when o in ["=", "=="] -> loose_eq(l, r)
      o when o in ["<>", "!="] -> not loose_eq(l, r)
      "<" -> Js.lt(cmp(l, r), 0.0)
      ">" -> Js.gt(cmp(l, r), 0.0)
      "<=" -> Js.le(cmp(l, r), 0.0)
      ">=" -> Js.ge(cmp(l, r), 0.0)
      _ -> err("Unknown operator \"#{op}\".")
    end
  end

  defp with_divisor(r, fun) do
    d = to_num(r)
    if d == 0, do: err("Division by zero."), else: fun.(d)
  end

  defp loose_eq(l, r) do
    numeric =
      if Json.number?(l) or Json.number?(r) do
        a = Js.number(l)
        b = Js.number(r)
        if a != :nan and b != :nan, do: {:ok, Js.num_eq(a, b)}
      end

    case numeric do
      {:ok, eq} -> eq
      nil -> to_str(l) == to_str(r)
    end
  end

  defp cmp(l, r) do
    if Json.number?(l) or Json.number?(r) do
      Js.sub(to_num(l), to_num(r))
    else
      # UTF-16 code-unit order, as JavaScript compares strings.
      a = Js.to_utf16_big_endian(to_str(l))
      b = Js.to_utf16_big_endian(to_str(r))

      cond do
        a < b -> -1.0
        a > b -> 1.0
        true -> 0.0
      end
    end
  end
end
