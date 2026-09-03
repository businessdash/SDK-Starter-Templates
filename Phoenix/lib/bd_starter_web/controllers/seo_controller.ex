defmodule BdStarterWeb.SeoController do
  use BdStarterWeb, :controller

  @moduledoc """
  SEO / AEO files, proxied from BD.

  Two different upstreams, which is easy to get wrong:

    * `sitemap.xml` / `robots.txt` are SITE-SCOPED PACKAGE routes and need the
      bearer key — `/api/package/v1/sites/{siteId}/…`
    * `llms.txt` is a PUBLIC feed route with no auth at all —
      `/api/public/ai-feed/{siteId}/llms.txt`

  Everything degrades to a valid empty document rather than a 500: a crawler
  may read a 5xx robots.txt as "disallow everything", which is a worse outcome
  than serving a permissive one.
  """

  def sitemap(conn, _params) do
    empty = ~s(<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>)

    conn
    |> put_resp_content_type("application/xml")
    |> send_resp(200, relay_package("sitemap.xml", empty))
  end

  def robots(conn, _params) do
    fallback = "User-agent: *\nAllow: /\nSitemap: #{origin()}/sitemap.xml\n"

    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, relay_package("robots.txt", fallback))
  end

  @doc """
  The org-curated llms.txt. Its companion PRODUCT FEED needs no route here —
  it is already public at `{host}/api/public/ai-feed/{siteId}/products`, in an
  OpenAI merchant-feed shape you submit to feed programs as-is.
  """
  def llms_txt(conn, _params) do
    fallback = "# llms.txt is not configured for this site.\n"

    body =
      case site_id() do
        nil ->
          fallback

        site_id ->
          fetch(
            "#{host()}/api/public/ai-feed/#{URI.encode(site_id, &URI.char_unreserved?/1)}/llms.txt",
            [],
            fallback
          )
      end

    conn |> put_resp_content_type("text/plain") |> send_resp(200, body)
  end

  defp relay_package(suffix, fallback) do
    with site_id when is_binary(site_id) <- site_id(),
         key when is_binary(key) <- api_key() do
      url =
        "#{host()}/api/package/v1/sites/#{URI.encode(site_id, &URI.char_unreserved?/1)}/#{suffix}"

      fetch(url, [auth: {:bearer, key}, headers: [{"origin", origin()}]], fallback)
    else
      _ -> fallback
    end
  end

  defp fetch(url, opts, fallback) do
    case Req.get(Keyword.merge([url: url, receive_timeout: 10_000], opts)) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        if is_binary(body), do: body, else: fallback

      _ ->
        fallback
    end
  rescue
    _ -> fallback
  end

  defp host, do: String.trim_trailing(Application.get_env(:bd_starter, :bd_host, ""), "/")
  defp origin, do: String.trim_trailing(Application.get_env(:bd_starter, :bd_site_origin, ""), "/")
  defp site_id, do: Application.get_env(:bd_starter, :bd_site_id)
  defp api_key, do: Application.get_env(:bd_starter, :bd_api_key)
end
