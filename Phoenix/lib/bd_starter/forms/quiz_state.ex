defmodule BdStarter.Forms.QuizState do
  @moduledoc """
  Where a run is: the question, the answers, the verdicts, the clock. Times
  are epoch milliseconds, as in JavaScript, so a state travels to and from
  JSON unchanged.
  """

  alias BdStarter.Forms.{Json, QuizScoring}

  defstruct index: 0,
            answers: %{},
            dont_know: [],
            results: [],
            revealed: false,
            completion: nil,
            started_at: nil,
            deadline_at: nil,
            clock_offset: 0.0,
            paused_ms: 0.0,
            reveal_started_at: nil,
            # nil | "start" | "lock" | "submit"
            pending: nil,
            error: nil,
            field_errors: %{},
            time_up: false

  def to_json(s) do
    %{
      "index" => s.index * 1.0,
      "answers" => s.answers,
      "dontKnow" => s.dont_know,
      "results" => s.results,
      "revealed" => s.revealed,
      "completion" => s.completion,
      "startedAt" => s.started_at,
      "deadlineAt" => s.deadline_at,
      "clockOffset" => s.clock_offset,
      "pausedMs" => s.paused_ms,
      "revealStartedAt" => s.reveal_started_at,
      "pending" => s.pending,
      "error" => s.error,
      "fieldErrors" => s.field_errors,
      "timeUp" => s.time_up
    }
  end

  def from_json(o) do
    %__MODULE__{
      index: Kernel.trunc(Json.num(o["index"]) || 0.0),
      answers: Json.obj(o["answers"]) || %{},
      dont_know: Json.strings(o["dontKnow"]),
      results: Enum.map(Json.list(o["results"]) || [], &QuizScoring.read_result/1),
      revealed: o["revealed"] == true,
      completion: if(Json.object?(o["completion"]), do: QuizScoring.read_completion(o["completion"])),
      started_at: Json.num(o["startedAt"]),
      deadline_at: Json.num(o["deadlineAt"]),
      clock_offset: Json.num(o["clockOffset"]) || 0.0,
      paused_ms: Json.num(o["pausedMs"]) || 0.0,
      reveal_started_at: Json.num(o["revealStartedAt"]),
      pending: Json.str(o["pending"]),
      error: Json.str(o["error"]),
      field_errors: (Json.obj(o["fieldErrors"]) || %{}) |> Enum.filter(fn {_, v} -> is_binary(v) end) |> Map.new(),
      time_up: o["timeUp"] == true
    }
  end

  def result(state, field_id), do: Enum.find(state.results, &(&1["fieldId"] == field_id))
end
