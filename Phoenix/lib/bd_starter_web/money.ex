defmodule BdStarterWeb.Money do
  @moduledoc """
  Currency formatting.

  Two functions on purpose, because the API is not uniform and guessing wrong
  is a 100× error in either direction:

    * `cents/2` — product prices, subscription prices, checkout totals. These
      are **integer cents**, the platform-wide convention for stored money. It
      exists so no total picks up a floating-point rounding error on the way
      to Stripe.
    * `amount/2` — cart `unitPrice` / `subtotal`, which arrive already decimal.

  Before rendering a money field this starter doesn't already show, check
  which shape it is.
  """

  # Bodiless heads: defaults can only be declared once when a function has
  # several clauses.
  def cents(value, currency \\ "USD")
  def cents(nil, _currency), do: ""
  def cents(value, currency) when is_number(value), do: format(value / 100, currency)

  def cents(value, currency) when is_binary(value) do
    case Float.parse(value) do
      {n, _} -> format(n / 100, currency)
      :error -> ""
    end
  end

  def cents(_value, _currency), do: ""

  def amount(value, currency \\ "USD")
  def amount(nil, _currency), do: ""
  def amount(value, currency) when is_number(value), do: format(value * 1.0, currency)

  def amount(value, currency) when is_binary(value) do
    case Float.parse(value) do
      {n, _} -> format(n, currency)
      :error -> ""
    end
  end

  def amount(_value, _currency), do: ""

  defp format(value, "USD"), do: "$" <> :erlang.float_to_binary(value * 1.0, decimals: 2)

  defp format(value, currency),
    do: currency <> " " <> :erlang.float_to_binary(value * 1.0, decimals: 2)
end
