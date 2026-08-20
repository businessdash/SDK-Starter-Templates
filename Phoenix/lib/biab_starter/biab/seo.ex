defmodule BiabStarter.Biab.Seo do
  @moduledoc """
  Render the org's per-page SEO into head tags.

  The marketing page bundle carries a `seo` object for the page you asked for:
  title, description, canonical, noIndex, Open Graph, Twitter card, keywords,
  JSON-LD and hreflang. Reading four of those and forgetting the rest is the
  normal failure, and the two people forget are `noIndex` and `canonicalUrl` —
  exactly the two where being wrong is expensive and silent.

  Rules that matter, matching the TypeScript `seo-core`:

    * Open Graph falls back to the page's own title/description. A missing
      `og:title` renders a shared link as a bare URL.
    * A RELATIVE canonical is dropped rather than emitted — crawlers resolve it
      against whatever URL they fetched, so on a parameterised URL it points
      somewhere nobody intended. A missing canonical is recoverable; a wrong
      one consolidates ranking onto the wrong page.
    * `robots` is always emitted, both ways. Absence means "index", so relying
      on absence to express noindex is catastrophic.
    * Values are escaped — SEO text is org-authored.
  """

  @doc """
  Head tags for a page bundle's `seo` map.

  Returns `[{:title, attrs, text} | {:meta, attrs, nil} | ...]` so a template
  can render them however it likes; `render/2` produces the HTML directly.
  """
  def head_tags(seo, base_url \\ nil)
  def head_tags(nil, _base_url), do: []

  def head_tags(seo, base_url) when is_map(seo) do
    title = text(seo["seoTitle"])
    description = text(seo["seoDescription"])
    canonical = absolute(seo["canonicalUrl"], base_url)
    no_index = seo["noIndex"] == true

    og_title = text(seo["ogTitle"]) || title
    og_description = text(seo["ogDescription"]) || description
    og_image = absolute(seo["ogImageUrl"], base_url)

    []
    |> maybe(title, fn v -> {:title, [], v} end)
    |> maybe(description, &meta("name", "description", &1))
    |> keywords(seo["keywords"])
    |> then(&[meta("name", "robots", if(no_index, do: "noindex, nofollow", else: "index, follow")) | &1])
    |> maybe(og_title, &meta("property", "og:title", &1))
    |> maybe(og_description, &meta("property", "og:description", &1))
    |> maybe(og_image, &meta("property", "og:image", &1))
    |> maybe(canonical, &meta("property", "og:url", &1))
    |> then(&[meta("property", "og:type", "website") | &1])
    |> then(&[meta("name", "twitter:card", text(seo["twitterCard"]) || "summary_large_image") | &1])
    |> maybe(og_title, &meta("name", "twitter:title", &1))
    |> maybe(og_description, &meta("name", "twitter:description", &1))
    |> maybe(og_image, &meta("name", "twitter:image", &1))
    |> maybe(canonical, fn v -> {:link, [{"rel", "canonical"}, {"href", v}], nil} end)
    |> hreflang(seo["hreflang"], base_url)
    |> json_ld(seo["jsonldNodes"])
    |> Enum.reverse()
  end

  @doc "Ready-to-render HTML for a layout."
  def render(seo, base_url \\ nil) do
    seo
    |> head_tags(base_url)
    |> Enum.map_join("\n", &render_tag/1)
  end

  defp render_tag({:title, _attrs, value}), do: "<title>#{escape(value)}</title>"

  defp render_tag({:script, attrs, payload}) do
    # `<` is what closes the script early; escaping the whole payload would
    # corrupt the JSON instead.
    safe = String.replace(payload, "<", "\\u003c")
    "<script #{attrs_to_string(attrs)}>#{safe}</script>"
  end

  defp render_tag({tag, attrs, _}), do: "<#{tag} #{attrs_to_string(attrs)}>"

  defp attrs_to_string(attrs),
    do: Enum.map_join(attrs, " ", fn {k, v} -> ~s(#{k}="#{escape(v)}") end)

  defp meta(key, name, content),
    do: {:meta, [{key, name}, {"content", content}], nil}

  defp maybe(acc, nil, _fun), do: acc
  defp maybe(acc, value, fun), do: [fun.(value) | acc]

  defp keywords(acc, list) when is_list(list) and list != [],
    do: [meta("name", "keywords", Enum.join(list, ", ")) | acc]

  defp keywords(acc, _), do: acc

  defp hreflang(acc, map, base_url) when is_map(map) do
    Enum.reduce(map, acc, fn {lang, href}, inner ->
      case absolute(href, base_url) do
        nil -> inner
        url -> [{:link, [{"rel", "alternate"}, {"hreflang", lang}, {"href", url}], nil} | inner]
      end
    end)
  end

  defp hreflang(acc, _, _), do: acc

  defp json_ld(acc, nodes) when is_list(nodes) do
    Enum.reduce(nodes, acc, fn node, inner ->
      [{:script, [{"type", "application/ld+json"}], Jason.encode!(node)} | inner]
    end)
  end

  defp json_ld(acc, _), do: acc

  defp text(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp text(_), do: nil

  defp absolute(url, base_url) do
    case text(url) do
      nil ->
        nil

      value ->
        cond do
          Regex.match?(~r{^([a-z][a-z0-9+.-]*:|//)}i, value) -> value
          is_nil(base_url) or String.trim(to_string(base_url)) == "" -> nil
          true -> String.trim_trailing(base_url, "/") <> ensure_slash(value)
        end
    end
  end

  defp ensure_slash("/" <> _ = value), do: value
  defp ensure_slash(value), do: "/" <> value

  defp escape(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("\"", "&quot;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
  end
end
