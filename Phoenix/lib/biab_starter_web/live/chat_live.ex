defmodule BiabStarterWeb.ChatLive do
  @moduledoc """
  Front Desk chat — the one LiveView in this starter.

  Everything else is a dead view on purpose. Tying the storefront and the SEO
  pages to a socket buys nothing and costs uptime. Chat is the surface where
  LiveView genuinely beats the JS starters: the BIAB chat API is polling-only,
  so a browser-rendered widget polls per tab. Here `ChatSession` polls once per
  conversation and pushes deltas to every attached LiveView.

  Note `phx-update="ignore"` is NOT needed on the message list — that is
  server-rendered markup LiveView owns. It IS needed anywhere a third-party
  web component like `<biab-form>` mutates its own subtree, because LiveView's
  DOM patcher and the component would otherwise fight over the same nodes.
  """

  use BiabStarterWeb, :live_view

  alias BiabStarter.Biab.ChatSession

  @impl true
  def mount(_params, session, socket) do
    # The visitor id ties this browser to a conversation across reconnects.
    # It comes off the Plug session so a hard refresh rejoins the same thread.
    visitor_token = Map.get(session, "biab_visitor") || Ecto.UUID.generate()

    socket =
      socket
      |> assign(
        session_id: nil,
        visitor_token: visitor_token,
        draft: "",
        messages: [],
        status: :connecting
      )

    # Mint the Front Desk session on connect. The visitor token is NOT a
    # session id, so this can't be skipped — polling with one returns nothing
    # forever without erroring.
    if connected?(socket) do
      with {:ok, session_id} <- ChatSession.start_session(visitor_token),
           :ok <- ChatSession.join(session_id, visitor_token) do
        {:ok, assign(socket, session_id: session_id, status: :ready)}
      else
        _ -> {:ok, assign(socket, status: :unavailable)}
      end
    else
      {:ok, socket}
    end
  end

  @impl true
  def handle_event("change", %{"message" => draft}, socket) do
    {:noreply, assign(socket, draft: draft)}
  end

  @impl true
  def handle_event("send", %{"message" => text}, socket) do
    text = String.trim(text)

    if text == "" do
      {:noreply, socket}
    else
      ChatSession.send_message(socket.assigns.session_id, socket.assigns.visitor_token, text)
      {:noreply, assign(socket, draft: "")}
    end
  end

  # Deltas arrive from the shared poller, not from this process asking.
  @impl true
  def handle_info({:biab_chat_messages, new_messages}, socket) do
    {:noreply, assign(socket, messages: socket.assigns.messages ++ new_messages)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <section class="chat">
      <h1>Front desk</h1>

      <p :if={@status == :unavailable} class="muted">
        Chat isn't configured yet. Set <code>BIAB_SITE_ID</code> and
        <code>BIAB_API_KEY</code>, then reload.
      </p>

      <ul id="chat-messages" class="chat-messages" phx-update="append">
        <li :for={message <- @messages} id={"msg-#{message["id"]}"} class={"chat-msg chat-msg--#{message["role"]}"}>
          <span class="chat-msg__who">{message["role"]}</span>
          <p>{message["content"]}</p>
        </li>
      </ul>

      <form phx-submit="send" phx-change="change" class="chat-form">
        <input
          type="text"
          name="message"
          value={@draft}
          placeholder="Ask us anything…"
          autocomplete="off"
          disabled={@status == :unavailable}
        />
        <button type="submit" disabled={@status == :unavailable}>Send</button>
      </form>

      <p class="muted chat-note">
        One server-side poller feeds every viewer of this conversation —
        open this page in two tabs and watch both update from a single
        upstream request.
      </p>
    </section>
    """
  end
end
