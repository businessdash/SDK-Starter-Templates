defmodule BdStarter.Forms.QuizBackend do
  @moduledoc """
  BD's side of a quiz run: an invitation (BD starts the clock, keeps a
  draft, locks and grades each answer) or a practice quiz (BD grades, this
  server times). Each function raises `FormsError` with a message for the taker.

    * `submit` — fn answers, question ids -> the completion (a JSON map)
    * `start` — fn -> `%{started_at:, deadline_at:, server_now:}` (or nil)
    * `save_draft` — fn answers -> any (or nil)
    * `lock_answer` — fn field id, answer -> its result (or nil)
  """
  @enforce_keys [:submit]
  defstruct [:submit, :start, :save_draft, :lock_answer]
end
