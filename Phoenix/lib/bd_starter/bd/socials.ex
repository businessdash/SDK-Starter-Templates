defmodule BdStarter.Bd.Socials do
  @moduledoc """
  Turn a company profile's `socials` map into a render-ready list of links.

  There is no endpoint for this. Social handles arrive on the branding /
  page bundle as a plain map, and every consumer has to do the same three
  things with them: drop the empties, work out the real URL, and put them in a
  stable order. Doing that in a template is how a site ends up with a link to
  `https://@acme` and a row that reshuffles whenever an unrelated field is
  edited.

  The platform table itself is generated from `sdk/src/socials.ts` (see
  `BdStarter.Bd.SocialPlatforms`), so adding a platform upstream reaches
  every language at once.
  """

  alias BdStarter.Bd.SocialPlatforms

  @doc """
  Resolve one stored value into a real URL.

  Orgs type these by hand, so the same field arrives as
  `https://instagram.com/acme`, `acme`, `@acme` or `instagram.com/acme`:

    * anything already absolute (`http`, `https`, `mailto:`, `tel:`) is left
      alone — the org meant that link;
    * a known platform prefixes its handle, dropping a leading `@`;
    * anything else is assumed to be a bare domain and gets `https://`.
  """
  def href(value, platform) do
    v = String.trim(to_string(value))

    cond do
      Regex.match?(~r/^(https?:\/\/|mailto:|tel:)/i, v) ->
        v

      is_binary(platform[:href_prefix]) ->
        platform[:href_prefix] <> String.trim_leading(v, "@")

      true ->
        "https://" <> String.trim_leading(v, "/")
    end
  end

  @doc """
  Turn the `socials` map into `[%{key:, label:, icon_slug:, url:}]`.

  Returned in the platform table's canonical order rather than whatever order
  the keys arrived in, so a site's social row does not reshuffle itself. Empty
  values and unknown keys are dropped; the first value wins if a platform
  somehow appears twice.
  """
  def resolve(socials) when is_map(socials) do
    present =
      socials
      |> Enum.reduce(%{}, fn {raw_key, raw_value}, acc ->
        value = if is_binary(raw_value), do: String.trim(raw_value), else: ""

        with true <- value != "",
             platform when not is_nil(platform) <- platform_for(raw_key),
             false <- Map.has_key?(acc, platform[:key]) do
          Map.put(acc, platform[:key], value)
        else
          _ -> acc
        end
      end)

    SocialPlatforms.all()
    |> Enum.flat_map(fn platform ->
      case Map.fetch(present, platform[:key]) do
        {:ok, value} ->
          [
            %{
              key: platform[:key],
              label: platform[:label],
              icon_slug: platform[:icon_slug],
              url: href(value, platform)
            }
          ]

        :error ->
          []
      end
    end)
  end

  def resolve(_), do: []

  @doc """
  Case-insensitive platform lookup.

  These keys come from stored JSON, where `twitterX`, `twitterx` and `TWITTERX`
  are all plausible.
  """
  def platform_for(key) do
    needle = key |> to_string() |> String.downcase()
    Enum.find(SocialPlatforms.all(), fn p -> String.downcase(p[:key]) == needle end)
  end
end
