defmodule BdStarter.Forms.Re do
  @moduledoc """
  Regexes built from text at run time, compiled once and kept.

  For the engine's own patterns only — an author's pattern is compiled per
  use, since there's no bound on how many there are.
  """

  def get(source, opts \\ "") do
    key = {__MODULE__, source, opts}

    case :persistent_term.get(key, nil) do
      nil ->
        regex = Regex.compile!(source, opts)
        :persistent_term.put(key, regex)
        regex

      regex ->
        regex
    end
  end
end
