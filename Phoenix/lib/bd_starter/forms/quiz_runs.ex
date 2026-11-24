defmodule BdStarter.Forms.QuizRuns do
  @moduledoc """
  Quiz runs in progress, kept for three hours: a reload (or a LiveView
  reconnect) picks up where the taker left off. In memory on this node, so a
  restart or another node starts a practice run over; an invitation's answers
  and clock are BD's, read again on the next visit.
  """
  use GenServer

  @table :bd_quiz_runs
  @ttl_ms 3 * 60 * 60 * 1000
  @sweep_ms 10 * 60 * 1000

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  def ttl_seconds, do: div(@ttl_ms, 1000)

  def get(run) when is_binary(run) do
    case :ets.lookup(@table, run) do
      [{^run, record, expires}] -> if now() < expires, do: record
      [] -> nil
    end
  end

  def get(_), do: nil

  def put(run, record), do: :ets.insert(@table, {run, record, now() + @ttl_ms})

  defp now, do: System.monotonic_time(:millisecond)

  @impl true
  def init(_) do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    Process.send_after(self(), :sweep, @sweep_ms)
    {:ok, nil}
  end

  @impl true
  def handle_info(:sweep, state) do
    :ets.select_delete(@table, [{{:_, :_, :"$1"}, [{:<, :"$1", now()}], [true]}])
    Process.send_after(self(), :sweep, @sweep_ms)
    {:noreply, state}
  end
end
