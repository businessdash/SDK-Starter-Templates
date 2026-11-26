defmodule BdStarter.Reviews do
  @moduledoc """
  The business reviews' rules: the rating over every review and its stars
  breakdown, what each platform is called, which links are safe to open, and
  what a written review must be. The same rules as `reviews.ts` in the other
  BD starters (priv/static/shop/reviews.js here, for the writer element).
  """

  @page_size 10
  @max_length 5000
  @platforms %{"google" => "Google", "yelp" => "Yelp", "housecall_pro" => "Housecall Pro"}
  @sources ["google", "yelp", "housecall_pro", "other"]

  def page_size, do: @page_size

  @doc "The longest review BD takes."
  def max_length, do: @max_length

  def sent, do: "Thanks! Your review shows once it's approved."

  @doc """
  The average, the count and the breakdown (5 stars down to 1, each with its
  share of all reviews) from the marketing bundle's `reviews`; empty stars
  count 0.
  """
  def summarize(totals, fallback_total \\ 0) do
    totals = if is_map(totals), do: totals, else: %{}

    by_stars =
      totals
      |> Map.get("counts")
      |> List.wrap()
      |> Enum.reduce(%{}, fn
        %{"rating" => stars, "count" => count}, acc
        when is_integer(stars) and stars in 1..5 and is_integer(count) and count > 0 ->
          Map.update(acc, stars, count, &(&1 + count))

        _, acc ->
          acc
      end)

    counted = by_stars |> Map.values() |> Enum.sum()

    total =
      case totals["totalCount"] do
        n when is_integer(n) -> n
        _ -> if counted > 0, do: counted, else: fallback_total
      end

    %{
      average: if(is_number(totals["rating"]), do: totals["rating"] / 1, else: nil),
      total: total,
      histogram:
        for stars <- 5..1//-1 do
          count = Map.get(by_stars, stars, 0)
          %{stars: stars, count: count, share: if(counted > 0, do: count / counted, else: 0.0)}
        end
    }
  end

  @doc ~s("Google", "Yelp", "Housecall Pro"; nil for a review added in the dashboard.)
  def platform_name(source) when is_binary(source), do: Map.get(@platforms, source)
  def platform_name(_), do: nil

  @doc ~s(A filter chip's name: the platform, or "Other".)
  def source_label(source), do: platform_name(source) || "Other"

  @doc "A `source` query value BD accepts, or nil."
  def source_param(value) when value in @sources, do: value
  def source_param(_), do: nil

  @doc "The platforms among some reviews, in the order first seen."
  def sources_in(reviews) do
    reviews
    |> List.wrap()
    |> Enum.map(&source_param(&1["source"]))
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  @doc "The review on its own site; web links on named platforms only."
  def link(%{"source" => source} = review) do
    if platform_name(source), do: web_url(review["reviewUrl"]), else: nil
  end

  def link(_), do: nil

  @doc "An http(s) address, or nil."
  def web_url(url) when is_binary(url) and url != "" do
    case URI.parse(url) do
      %URI{scheme: scheme, host: host}
      when scheme in ["http", "https"] and is_binary(host) and host != "" ->
        url

      _ ->
        nil
    end
  end

  def web_url(_), do: nil

  def reviewer_name(review) do
    case review["reviewerName"] do
      name when is_binary(name) ->
        case String.trim(name) do
          "" -> "Anonymous"
          trimmed -> trimmed
        end

      _ ->
        "Anonymous"
    end
  end

  @doc "The first letter of the name, for an avatar with no photo."
  def initial(review), do: review |> reviewer_name() |> String.first() |> String.upcase()

  @doc ~s("★★★★☆", rounded to whole stars.)
  def stars(rating) when is_number(rating) do
    full = rating |> round() |> max(0) |> min(5)
    String.duplicate("★", full) <> String.duplicate("☆", 5 - full)
  end

  def stars(_), do: stars(0)

  @doc ~s("Nov 20, 2026", or "" for a date that isn't one.)
  def date(iso) when is_binary(iso) do
    case DateTime.from_iso8601(iso) do
      {:ok, dt, _} -> Calendar.strftime(dt, "%b %-d, %Y")
      _ -> ""
    end
  end

  def date(_), do: ""

  @doc "A written review, checked: `{:ok, fields BD takes}` or `{:error, why}`."
  def check(input) when is_map(input) do
    body = if is_binary(input["body"]), do: String.trim(input["body"]), else: ""

    title =
      if is_binary(input["title"]),
        do: input["title"] |> String.trim() |> String.slice(0, 200),
        else: ""

    cond do
      not (is_integer(input["rating"]) and input["rating"] in 1..5) ->
        {:error, "Choose a rating from 1 to 5 stars."}

      body == "" ->
        {:error, "Write a few words about your experience."}

      String.length(body) > @max_length ->
        {:error, "Reviews are up to 5,000 characters."}

      title == "" ->
        {:ok, %{rating: input["rating"], body: body}}

      true ->
        {:ok, %{rating: input["rating"], title: title, body: body}}
    end
  end

  def check(_), do: check(%{})
end
