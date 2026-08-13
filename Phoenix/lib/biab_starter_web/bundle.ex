defmodule BiabStarterWeb.Bundle do
  @moduledoc """
  Reads a value out of a marketing bundle, with a fallback.

  Exists because the bundle is absent in two different ways and a template
  should not care which: entirely absent when BIAB isn't configured, and
  partially absent when a section hasn't been authored yet. `get_in/2` alone
  returns `nil` for both, and a `nil` in HEEx renders as an empty element
  rather than as the local copy the page should be showing.

  Also treats an empty string as missing — an author who cleared a field wants
  the default back, not a blank heading.
  """

  @spec bundle(map() | nil, [String.t()], term()) :: term()
  def bundle(nil, _path, default), do: default

  def bundle(bundle, path, default) when is_map(bundle) and is_list(path) do
    case get_in(bundle, path) do
      nil -> default
      "" -> default
      value -> value
    end
  end

  def bundle(_bundle, _path, default), do: default
end
