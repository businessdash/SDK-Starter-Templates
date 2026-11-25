defmodule BdStarter.ShopTest do
  @moduledoc """
  Replays `shop-parity.json`: products, and what the product page rules every
  BD starter shares (`shop.ts`) give back. The page is drawn here as it opens
  and `<bd-product-form>` takes over in the browser with the TypeScript, so
  the two must agree, or the price or photos would jump once it loads.
  """
  use ExUnit.Case, async: true

  import BdStarter.Parity, only: [same?: 2]

  alias BdStarter.Shop

  # Read as the API's JSON is: integers stay integers.
  @cases Path.join([__DIR__, "fixtures", "shop-parity.json"]) |> File.read!() |> Jason.decode!() |> Map.fetch!("cases")

  test "the product rules agree with TypeScript" do
    refute Enum.empty?(@cases)

    failures =
      Enum.flat_map(@cases, fn c ->
        view = Shop.product_view(c["input"])
        name = inspect(c["input"]["id"])

        checks =
          [
            {"product_view #{name}", view, c["view"]},
            {"default_variant #{name}", (Shop.default_variant(view) || %{id: nil}).id, c["defaultVariant"]},
            {"all_option_groups #{name}", Shop.all_option_groups(view), c["allOptionGroups"]},
            {"photo_sets #{name}", Shop.photo_sets(view), c["photoSets"]},
            {"gallery_for unknown #{name}", Shop.gallery_for(view, "nope"), c["unknownVariant"]["gallery"]},
            {"price_for unknown #{name}", Shop.price_for(view, "nope"), c["unknownVariant"]["price"]}
          ] ++
            Enum.flat_map(c["variants"], fn v ->
              at = "#{name} variant #{v["id"]}"

              [
                {"gallery_for #{at}", Shop.gallery_for(view, v["id"]), v["gallery"]},
                {"option_groups_for #{at}", Shop.option_groups_for(view, v["id"]), v["groups"]}
              ] ++
                Enum.flat_map(v["prices"], fn row ->
                  with_chosen = "#{at} chosen #{inspect(row["chosen"])}"

                  [
                    {"price_for #{with_chosen}", Shop.price_for(view, v["id"], row["chosen"]), row["price"]},
                    {"product_summary #{with_chosen}", Shop.product_summary(view, v["id"], row["chosen"]), row["summary"]}
                  ]
                end)
            end)

        for {label, got, want} <- checks, not same?(json(got), want) do
          "#{label}\n  gave #{inspect(json(got))}\n  want #{inspect(want)}"
        end
      end)

    assert failures == [], Enum.join(failures, "\n")
  end

  test "review dates" do
    assert Shop.review_date("2026-03-04T12:00:00.000Z") == "Mar 4, 2026"
    assert Shop.review_date("not a date") == ""
    assert Shop.review_date(nil) == ""
  end

  # The value as JSON with the TypeScript's names: snake_case keys become camelCase.
  defp json(value), do: value |> Jason.encode!() |> Jason.decode!() |> camel()

  defp camel(map) when is_map(map),
    do: Map.new(map, fn {k, v} -> {Regex.replace(~r/_([a-z])/, k, fn _, c -> String.upcase(c) end), camel(v)} end)

  defp camel(list) when is_list(list), do: Enum.map(list, &camel/1)
  defp camel(v), do: v
end
