defmodule BdStarterWeb.PostHtmlTest do
  @moduledoc """
  Replays `post-html-parity.json`: post HTML, and what the TypeScript
  `safePostHtml` the JavaScript starters ship gives back. Every case must
  agree, or a post would render one way here and another there, and a case
  that one sanitizer lets through could be a script on this site.
  """
  use ExUnit.Case, async: true

  import BdStarter.Parity

  alias BdStarterWeb.PostHtml

  test "safe/1 rebuilds post HTML as TypeScript does" do
    failures =
      for c <- fixtures("post-html-parity.json")["cases"],
          got <- [PostHtml.safe(c["input"])],
          got != c["output"],
          do: "#{inspect(c["input"])}\n  gave #{inspect(got)}\n  want #{inspect(c["output"])}"

    assert failures == []
  end

  test "reading time and dates" do
    assert PostHtml.reading_minutes("<p>" <> String.duplicate("word ", 700) <> "</p>") == 3
    assert PostHtml.reading_minutes("") == 1
    assert PostHtml.date("2026-11-18T15:00:00.000Z") == "November 18, 2026"
    assert PostHtml.date("2026-11-18") == "November 18, 2026"
    assert PostHtml.date("not a date") == ""
    assert PostHtml.date(nil) == ""
  end
end
