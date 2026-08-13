defmodule BiabStarter.Biab.Resources.Marketing do
  @moduledoc """
  Schema-driven marketing content.

  `biab.config.ts` declares the SHAPE (`npm run sync-schema` pushes it), the
  dashboard fills in the CONTENT, and `page_bundle/3` reads it back. Every
  section should render a local fallback when the bundle is missing.
  """

  alias BiabStarter.Biab.Client

  def page_bundle(client, page_key \\ "home", locale \\ nil),
    do: Client.get(client, Client.site_path(client, "marketing/bundle"), pageKey: page_key, locale: locale)

  def published_schema(client),
    do: Client.get(client, Client.site_path(client, "marketing/published-schema"))

  def locales(client), do: Client.get(client, Client.site_path(client, "marketing/locales"))
  def branding(client), do: Client.get(client, Client.site_path(client, "branding"))
end
