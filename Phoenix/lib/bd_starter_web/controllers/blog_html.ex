defmodule BdStarterWeb.BlogHTML do
  @moduledoc false
  use BdStarterWeb, :html

  alias BdStarterWeb.PostHtml

  embed_templates "blog_html/*"

  @doc "This list with one filter changed and the paging reset."
  def filter_href(category, tag, key, value) do
    next =
      %{"category" => category, "tag" => tag}
      |> Map.put(key, value)
      |> Enum.reject(fn {_k, v} -> v in [nil, ""] end)
      |> Enum.sort()

    if next == [], do: ~p"/blog", else: ~p"/blog?#{next}"
  end

  def older_href(category, cursor) do
    ~p"/blog?#{Enum.reject([category: category, cursor: cursor], fn {_k, v} -> is_nil(v) end)}"
  end

  def post_date(iso), do: PostHtml.date(iso)
  def minutes(text), do: PostHtml.reading_minutes(text)

  @doc "Only web, mail, same-site and in-page links; anything else goes nowhere."
  def cta_href(href) when is_binary(href) do
    href = String.trim(href)
    if Regex.match?(~r/^(https?:|mailto:|\/|#)/i, href), do: href, else: "#"
  end

  def cta_href(_), do: "#"
end
