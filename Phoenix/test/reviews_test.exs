defmodule BdStarter.ReviewsTest do
  @moduledoc "The reviews' rules, which must agree with reviews.ts in the other BD starters."
  use ExUnit.Case, async: true

  alias BdStarter.Reviews

  test "the summary breaks the rating down by stars" do
    summary =
      Reviews.summarize(%{
        "rating" => 4.1,
        "totalCount" => 14,
        "counts" => [
          %{"rating" => 5, "count" => 8},
          %{"rating" => 4, "count" => 3},
          %{"rating" => 2, "count" => 1},
          %{"rating" => 1, "count" => 2},
          %{"rating" => 9, "count" => 5}
        ]
      })

    assert summary.average == 4.1
    assert summary.total == 14
    assert Enum.map(summary.histogram, & &1.stars) == [5, 4, 3, 2, 1]
    assert Enum.map(summary.histogram, & &1.count) == [8, 3, 0, 1, 2]
    assert_in_delta hd(summary.histogram).share, 8 / 14, 1.0e-9
  end

  test "with no bundle there is no average" do
    summary = Reviews.summarize(nil, 3)
    assert summary.average == nil
    assert summary.total == 3
    assert hd(summary.histogram).share == 0.0
  end

  test "links open only on named platforms and the web" do
    assert Reviews.link(%{"source" => "google", "reviewUrl" => "https://maps.google.com/?r=1"}) ==
             "https://maps.google.com/?r=1"

    assert Reviews.link(%{"source" => "yelp", "reviewUrl" => "javascript:alert(1)"}) == nil
    assert Reviews.link(%{"source" => "other", "reviewUrl" => "https://example.com/r"}) == nil
    assert Reviews.web_url("//example.com/x.jpg") == nil
    assert Reviews.platform_name("other") == nil
    assert Reviews.source_label("other") == "Other"
    assert Reviews.source_param("tripadvisor") == nil

    assert Reviews.sources_in([%{"source" => "google"}, %{"source" => "other"}, %{"source" => "google"}]) ==
             ["google", "other"]
  end

  test "names, stars and dates" do
    assert Reviews.reviewer_name(%{"reviewerName" => "  "}) == "Anonymous"
    assert Reviews.initial(%{"reviewerName" => "élodie"}) == "É"
    assert Reviews.stars(4.1) == "★★★★☆"
    assert Reviews.stars(nil) == "☆☆☆☆☆"
    assert Reviews.date("2026-11-20T15:00:00Z") == "Nov 20, 2026"
    assert Reviews.date("not a date") == ""
  end

  test "a written review is checked" do
    assert Reviews.check(%{"rating" => 6, "body" => "Good"}) == {:error, "Choose a rating from 1 to 5 stars."}
    assert Reviews.check(%{"rating" => 4.5, "body" => "Good"}) == {:error, "Choose a rating from 1 to 5 stars."}
    assert Reviews.check(%{"rating" => 4, "body" => "   "}) == {:error, "Write a few words about your experience."}

    assert Reviews.check(%{"rating" => 4, "body" => String.duplicate("a", 5001)}) ==
             {:error, "Reviews are up to 5,000 characters."}

    assert Reviews.check(%{"rating" => 4, "title" => " ", "body" => " Good fitting. "}) ==
             {:ok, %{rating: 4, body: "Good fitting."}}

    {:ok, review} = Reviews.check(%{"rating" => 5, "title" => String.duplicate("t", 300), "body" => "x"})
    assert String.length(review.title) == 200
  end
end
