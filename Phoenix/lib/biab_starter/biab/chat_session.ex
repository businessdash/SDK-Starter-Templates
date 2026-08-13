defmodule BiabStarter.Biab.ChatSession do
  @moduledoc """
  One GenServer per Front Desk chat session, polling BIAB and fanning the
  results out over PubSub.

  ## Why this exists

  The whole BIAB real-time surface is polling — there is no SSE and no
  WebSocket anywhere in the Package API. The SDK's own guidance is
  `chatbot/messages` every **3–5s** while a widget is open, and
  `chatbot/availability` every **20–30s**.

  In a browser-rendered starter that cost is per-tab: ten visitors watching a
  conversation is ten browsers independently hitting BIAB every few seconds,
  and the org pays for all of it.

  Here, **one** process polls per session and broadcasts deltas to every
  LiveView attached to it. N viewers collapse to 1 upstream poll — a
  customer's phone and the tab they left open on their laptop share a poller.
  This is the one thing the Phoenix starter does that none of the JS starters
  can.

  ## Lifecycle

  Subscribers are monitored, not counted by guesswork: `join/2` hands the
  caller's pid to the poller, which `Process.monitor/1`s it. When the last
  subscriber goes down the poller stops. That is why an abandoned tab can't
  leave a poller running forever — and why the poller doesn't die the instant
  a LiveView reconnects during a deploy, since the next `join/2` restarts it.
  """

  use GenServer, restart: :transient

  alias BiabStarter.Biab.Client
  alias Phoenix.PubSub

  require Logger

  @poll_interval_ms 4_000
  @backoff_ms 15_000

  # ── Public API ────────────────────────────────────────────────────────────

  def topic(session_id), do: "biab:chat:#{session_id}"

  @doc """
  Mint (or resume) a Front Desk session for a visitor.

  A visitor token is NOT a session id — polling with one watches a
  conversation that doesn't exist and returns nothing, forever, without
  erroring.
  """
  def start_session(visitor_token) do
    with client when not is_nil(client) <- Client.new(),
         {:ok, %{"sessionId" => session_id}} <-
           Client.post(client, "chatbot/persisted-session", %{visitorToken: visitor_token}) do
      {:ok, session_id}
    else
      nil -> {:error, :not_configured}
      {:ok, _} -> {:error, :no_session_id}
      error -> error
    end
  end

  @doc """
  Ensure a poller exists for this session and subscribe the caller to it.

  Safe to call from every LiveView mount — the second and subsequent callers
  attach to the running poller rather than starting another.
  """
  def join(session_id, visitor_token) do
    case start_poller(session_id, visitor_token) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
      {:error, reason} -> {:error, reason}
    end
    |> case do
      :ok ->
        PubSub.subscribe(BiabStarter.PubSub, topic(session_id))
        # Registering the pid is what keeps the poller alive; PubSub alone
        # gives the server no way to know anyone is listening.
        GenServer.cast(via(session_id), {:watch, self()})
        :ok

      error ->
        error
    end
  end

  @doc "Post a message, then poll immediately so the sender sees it without waiting."
  def send_message(session_id, visitor_token, text) do
    with client when not is_nil(client) <- Client.new(),
         {:ok, _} <-
           Client.post(client, "chatbot/messages", %{
             sessionId: session_id,
             visitorToken: visitor_token,
             content: text,
             role: "visitor"
           }) do
      GenServer.cast(via(session_id), :poll_now)
      :ok
    else
      nil -> {:error, :not_configured}
      error -> error
    end
  end

  # ── GenServer ─────────────────────────────────────────────────────────────

  def start_link(opts) do
    session_id = Keyword.fetch!(opts, :session_id)
    GenServer.start_link(__MODULE__, opts, name: via(session_id))
  end

  @impl true
  def init(opts) do
    state = %{
      session_id: Keyword.fetch!(opts, :session_id),
      visitor_token: Keyword.fetch!(opts, :visitor_token),
      since: nil,
      watchers: MapSet.new()
    }

    schedule_poll(0)
    {:ok, state}
  end

  @impl true
  def handle_cast({:watch, pid}, state) do
    Process.monitor(pid)
    {:noreply, %{state | watchers: MapSet.put(state.watchers, pid)}}
  end

  @impl true
  def handle_cast(:poll_now, state), do: do_poll(state)

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    watchers = MapSet.delete(state.watchers, pid)

    if MapSet.size(watchers) == 0 do
      {:stop, :normal, state}
    else
      {:noreply, %{state | watchers: watchers}}
    end
  end

  @impl true
  def handle_info(:poll, state), do: do_poll(state)

  defp do_poll(state) do
    case fetch(state) do
      {:ok, [], since} ->
        schedule_poll(@poll_interval_ms)
        {:noreply, %{state | since: since}}

      {:ok, new_messages, since} ->
        PubSub.broadcast(
          BiabStarter.PubSub,
          topic(state.session_id),
          {:biab_chat_messages, new_messages}
        )

        schedule_poll(@poll_interval_ms)
        {:noreply, %{state | since: since}}

      {:error, reason} ->
        # Back off rather than hammer a failing endpoint at 4s forever.
        Logger.debug("[biab] chat poll failed: #{inspect(reason)}")
        schedule_poll(@backoff_ms)
        {:noreply, state}
    end
  end

  defp fetch(state) do
    case Client.new() do
      nil ->
        {:error, :not_configured}

      client ->
        client
        |> Client.get("chatbot/messages",
          sessionId: state.session_id,
          visitorToken: state.visitor_token,
          since: state.since
        )
        |> case do
          {:ok, %{"messages" => messages} = body} when is_list(messages) ->
            # `since` is an ISO timestamp the platform uses to return only
            # newer rows; carry the last one forward so each poll is a delta.
            {:ok, messages, body["cursor"] || latest_timestamp(messages) || state.since}

          {:ok, _} ->
            {:ok, [], state.since}

          error ->
            error
        end
    end
  end

  defp latest_timestamp([]), do: nil
  defp latest_timestamp(messages), do: messages |> List.last() |> Map.get("createdAt")

  defp start_poller(session_id, visitor_token) do
    DynamicSupervisor.start_child(
      BiabStarter.ChatSupervisor,
      {__MODULE__, session_id: session_id, visitor_token: visitor_token}
    )
  end

  defp schedule_poll(delay), do: Process.send_after(self(), :poll, delay)
  defp via(session_id), do: {:via, Registry, {BiabStarter.ChatRegistry, session_id}}
end
