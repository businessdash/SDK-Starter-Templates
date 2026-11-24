defmodule BdStarter.Forms.FieldPath do
  @moduledoc "Where a value lives: a field id, inside zero or more repeater entries."

  # entries: [{repeater id, entry index}], outermost first
  defstruct field_id: "", entries: []

  def new(field_id, entries \\ []), do: %__MODULE__{field_id: field_id, entries: entries}

  @doc "`email`, or `kids[1].name` inside a repeater. Errors are keyed by this."
  def key(%__MODULE__{field_id: id, entries: entries}),
    do: Enum.map_join(entries, "", fn {repeater, i} -> "#{repeater}[#{i}]." end) <> id

  @doc "A sibling field in the same entries."
  def child(%__MODULE__{entries: entries}, id), do: new(id, entries)

  @doc "The entries of one row of this repeater."
  def entry(%__MODULE__{field_id: id, entries: entries}, index), do: entries ++ [{id, index}]
end
