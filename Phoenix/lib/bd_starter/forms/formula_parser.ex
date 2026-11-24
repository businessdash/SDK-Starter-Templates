defmodule BdStarter.Forms.FormulaParser do
  @moduledoc """
  Recursive descent over a formula's tokens, precedence lowest first.

  Tokens are `{kind, value}`; nodes are `{:num, n}`, `{:str, s}`,
  `{:bool, b}`, `{:var, name}`, `{:member, node, key}`,
  `{:unary, op, node}`, `{:binary, op, left, right}`, `{:call, NAME, args}`.
  A syntax error throws `{:formula_error, message}`.
  """

  def parse(tokens) do
    {node, rest} = or_expr(tokens)
    if rest != [], do: fail("Unexpected trailing input.")
    node
  end

  defp fail(message), do: throw({:formula_error, message})

  defp op?([{:op, op} | _], want), do: op == want
  defp op?(_, _), do: false

  defp kind?([{kind, _} | _], want), do: kind == want
  defp kind?(_, _), do: false

  defp ident?([{:ident, word} | _], want), do: String.upcase(word, :ascii) == want
  defp ident?(_, _), do: false

  defp eat([{kind, value} | rest], kind), do: {value, rest}
  defp eat(_, kind), do: fail("Expected #{kind}.")

  defp or_expr(tokens) do
    {left, rest} = and_expr(tokens)
    or_loop(left, rest)
  end

  defp or_loop(left, [_ | after_op] = tokens) do
    if op?(tokens, "||") or ident?(tokens, "OR") do
      {right, rest} = and_expr(after_op)
      or_loop({:binary, "OR", left, right}, rest)
    else
      {left, tokens}
    end
  end

  defp or_loop(left, []), do: {left, []}

  defp and_expr(tokens) do
    {left, rest} = not_expr(tokens)
    and_loop(left, rest)
  end

  defp and_loop(left, [_ | after_op] = tokens) do
    if op?(tokens, "&&") or ident?(tokens, "AND") do
      {right, rest} = not_expr(after_op)
      and_loop({:binary, "AND", left, right}, rest)
    else
      {left, tokens}
    end
  end

  defp and_loop(left, []), do: {left, []}

  defp not_expr([_ | after_op] = tokens) do
    if op?(tokens, "!") or ident?(tokens, "NOT") do
      {inner, rest} = not_expr(after_op)
      {{:unary, "NOT", inner}, rest}
    else
      comparison(tokens)
    end
  end

  defp not_expr([]), do: comparison([])

  @comparisons ["=", "==", "<>", "!=", "<", ">", "<=", ">="]

  defp comparison(tokens) do
    {left, rest} = concat(tokens)
    comparison_loop(left, rest)
  end

  defp comparison_loop(left, [{:op, op} | after_op]) when op in @comparisons do
    {right, rest} = concat(after_op)
    comparison_loop({:binary, op, left, right}, rest)
  end

  defp comparison_loop(left, tokens), do: {left, tokens}

  defp concat(tokens) do
    {left, rest} = add(tokens)
    concat_loop(left, rest)
  end

  defp concat_loop(left, [{:op, "&"} | after_op]) do
    {right, rest} = add(after_op)
    concat_loop({:binary, "&", left, right}, rest)
  end

  defp concat_loop(left, tokens), do: {left, tokens}

  defp add(tokens) do
    {left, rest} = mul(tokens)
    add_loop(left, rest)
  end

  defp add_loop(left, [{:op, op} | after_op]) when op in ["+", "-"] do
    {right, rest} = mul(after_op)
    add_loop({:binary, op, left, right}, rest)
  end

  defp add_loop(left, tokens), do: {left, tokens}

  defp mul(tokens) do
    {left, rest} = unary(tokens)
    mul_loop(left, rest)
  end

  defp mul_loop(left, [{:op, op} | after_op]) when op in ["*", "/", "%"] do
    {right, rest} = unary(after_op)
    mul_loop({:binary, op, left, right}, rest)
  end

  defp mul_loop(left, tokens), do: {left, tokens}

  defp unary([{:op, op} | rest]) when op in ["-", "+"] do
    {inner, rest} = unary(rest)
    {{:unary, op, inner}, rest}
  end

  defp unary(tokens), do: power(tokens)

  defp power(tokens) do
    {base, rest} = primary(tokens)

    case rest do
      [{:op, "^"} | after_op] ->
        {exponent, rest} = unary(after_op)
        {{:binary, "^", base, exponent}, rest}

      _ ->
        {base, rest}
    end
  end

  defp primary(tokens) do
    {node, rest} = atom(tokens)
    member_loop(node, rest)
  end

  defp member_loop(node, [{:dot, _} | rest]) do
    {key, rest} = eat(rest, :ident)
    member_loop({:member, node, key}, rest)
  end

  defp member_loop(node, tokens), do: {node, tokens}

  defp atom([]), do: fail("Unexpected end of formula.")
  defp atom([{:num, n} | rest]), do: {{:num, n}, rest}
  defp atom([{:str, s} | rest]), do: {{:str, s}, rest}

  defp atom([{:lparen, _} | rest]) do
    {inner, rest} = or_expr(rest)
    {_, rest} = eat(rest, :rparen)
    {inner, rest}
  end

  defp atom([{:ident, word} | rest]) do
    upper = String.upcase(word, :ascii)

    cond do
      upper == "TRUE" ->
        {{:bool, true}, rest}

      upper == "FALSE" ->
        {{:bool, false}, rest}

      kind?(rest, :lparen) ->
        [_ | rest] = rest
        {args, rest} = if kind?(rest, :rparen), do: {[], rest}, else: args(rest, [])
        {_, rest} = eat(rest, :rparen)
        {{:call, upper, args}, rest}

      true ->
        {{:var, word}, rest}
    end
  end

  defp atom(_), do: fail("Unexpected token.")

  defp args(tokens, acc) do
    {arg, rest} = or_expr(tokens)

    case rest do
      [{:comma, _} | rest] -> args(rest, [arg | acc])
      _ -> {Enum.reverse([arg | acc]), rest}
    end
  end
end
