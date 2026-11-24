defmodule BdStarterWeb.SignInLive do
  @moduledoc """
  The business's sign-in screen on /my-account, as a LiveView.

  The same screen every BD starter shows (`<BdSignIn>`, the Swift app's
  `BdSignInView`, Kotlin's `:bd-sign-in`): the business's logo, name and brand
  colours, email and password, a new account confirmed by a 6-digit emailed
  code, a forgotten password reset by code, and "Continue with Google / Apple
  / GitHub / Discord". Words, checks and colours are `BdStarter.Bd.SignInCore`
  (a port of `@businessdash/sdk/sign-in-core`); the markup and
  `priv/static/bd-sign-in.css` are the SDK screen's.

  Nothing here signs anyone in by itself: every step is
  `BdStarter.Bd.CustomerAuth.forward` — BD's `auth/customer/*`, which runs it
  through WorkOS. "Continue with …" is a plain link to
  `/api/bd-auth/customer/oauth/{provider}`.

    * Leaving a box you typed in checks it; a box marked wrong is checked
      again as you type, until it's right.
    * The button checks every box first and sends nothing until they're
      right. BD's answers about a box (a weak password, a wrong code) land
      under it; the rest above the button.
    * Six digits in the code box send it.

  A LiveView can't set a cookie, so a finished sign-in hands the session to
  `PortalController.sign_in_handoff` through a form it submits
  (`phx-trigger-action`), encrypted and good for a minute; that sets the
  httpOnly `bd_session` cookie. The code step's details stay in this
  process — the page never sees them.
  """
  use BdStarterWeb, :live_view

  alias BdStarter.Bd
  alias BdStarter.Bd.Cache
  alias BdStarter.Bd.CustomerAuth
  alias BdStarter.Bd.SignInCore, as: Core

  @handoff_salt "bd sign-in handoff"

  @doc "Opens what `handoff/1` sealed, within a minute: `{:ok, token, max_age}`."
  def open_handoff(sealed) do
    case Phoenix.Token.decrypt(BdStarterWeb.Endpoint, @handoff_salt, sealed, max_age: 60) do
      {:ok, %{"token" => token, "age" => age}} -> {:ok, token, age}
      _ -> :error
    end
  end

  @impl true
  def mount(_params, session, socket) do
    socket =
      assign(socket,
        step: if(session["start"] == "createAccount", do: :createAccount, else: :signIn),
        pending: nil,
        values: %{},
        errors: %{},
        edited: MapSet.new(),
        # Back from a provider that didn't finish.
        problem: session["problem"],
        notice: nil,
        options: options(),
        handoff: nil,
        # Where a finished sign-in lands: ?next= (checked), else My account.
        next: Core.safe_next(session["next"])
      )

    {:ok, socket, layout: false}
  end

  # ── Events ────────────────────────────────────────────────────────────────

  @impl true
  def handle_event("change", %{"_target" => [field | _]} = params, socket) do
    socket = take_values(socket, params)
    socket = update(socket, :edited, &MapSet.put(&1, field))

    # A box already marked wrong is re-checked as it's typed in, so the
    # message goes the moment it's right (and never appears early).
    socket =
      if Map.has_key?(socket.assigns.errors, field),
        do: set_error(socket, field, check(socket, field)),
        else: socket

    if field == "code" and auto_send_code?(socket),
      do: submit(socket),
      else: {:noreply, socket}
  end

  def handle_event("change", params, socket), do: {:noreply, take_values(socket, params)}

  # The person left a box: check it, if they typed in it.
  def handle_event("blur", %{"field" => field} = params, socket) do
    socket =
      case params do
        %{"value" => value} when is_binary(value) -> put_value(socket, field, value)
        _ -> socket
      end

    if MapSet.member?(socket.assigns.edited, field) and field in fields(socket.assigns),
      do: {:noreply, set_error(socket, field, check(socket, field))},
      else: {:noreply, socket}
  end

  def handle_event("submit", params, socket), do: socket |> take_values(params) |> submit()

  def handle_event("go", %{"to" => "resend"}, socket), do: resend(socket)

  def handle_event("go", %{"to" => to}, socket)
      when to in ["signIn", "createAccount", "forgot"] do
    step = String.to_existing_atom(to)
    {:noreply, go(socket, step, if(step == :createAccount, do: "firstName", else: "email"))}
  end

  # ── Steps ─────────────────────────────────────────────────────────────────

  defp submit(socket) do
    socket = assign(socket, problem: nil, notice: nil)
    shown = fields(socket.assigns)
    errors = for f <- shown, message = check(socket, f), into: %{}, do: {f, message}

    if errors != %{} do
      first = Enum.find(shown, &Map.has_key?(errors, &1))
      {:noreply, socket |> assign(errors: errors) |> focus(first)}
    else
      send_step(socket)
    end
  end

  defp send_step(%{assigns: %{step: :signIn}} = socket) do
    email = email(socket)
    password = value(socket, "password")

    case forward("sign-in", %{email: email, password: password}) do
      # WorkOS wants the email confirmed first; it has sent a code.
      {:answered, sent} ->
        to_code(socket, sent, %{purpose: :verify, email: email, password: password})

      other ->
        finish(socket, other)
    end
  end

  defp send_step(%{assigns: %{step: :createAccount}} = socket) do
    details = %{
      purpose: :signUp,
      email: email(socket),
      password: value(socket, "password"),
      firstName: clean(value(socket, "firstName")),
      lastName: clean(value(socket, "lastName"))
    }

    case forward("sign-up", Map.delete(details, :purpose)) do
      {:answered, sent} -> to_code(socket, sent, details)
      other -> finish(socket, other)
    end
  end

  defp send_step(%{assigns: %{step: :forgot}} = socket) do
    email = email(socket)

    case forward("forgot-password", %{email: email}) do
      {:answered, sent} -> to_code(socket, sent, %{purpose: :reset, email: email})
      other -> finish(socket, other)
    end
  end

  defp send_step(%{assigns: %{step: :code, pending: pending}} = socket) do
    new_password = if pending.purpose == :reset, do: value(socket, "newPassword")

    case forward("verify", %{
           pendingId: pending.pending_id,
           code: value(socket, "code"),
           newPassword: new_password
         }) do
      {:answered, _} -> finish(socket, {:refused, 502, "unavailable", CustomerAuth.unavailable()})
      other -> finish(socket, other)
    end
  end

  defp resend(%{assigns: %{step: :code, pending: pending}} = socket) when not is_nil(pending) do
    socket = assign(socket, problem: nil)

    answer =
      case pending.purpose do
        :signUp ->
          forward("sign-up", Map.take(pending, [:email, :password, :firstName, :lastName]))

        :verify ->
          forward("sign-in", Map.take(pending, [:email, :password]))

        :reset ->
          forward("forgot-password", %{email: pending.email})
      end

    case answer do
      {:answered, sent} ->
        to_code(socket, sent, Map.delete(pending, :pending_id), Core.word(:codeResent))

      other ->
        finish(socket, other)
    end
  end

  defp resend(socket), do: {:noreply, socket}

  defp to_code(socket, sent, details, notice \\ nil)

  defp to_code(socket, %{"pendingId" => id}, details, notice) when is_binary(id) do
    socket =
      socket
      |> go(:code, "code")
      |> assign(pending: Map.put(details, :pending_id, id), notice: notice)

    {:noreply, socket}
  end

  defp to_code(socket, _sent, _details, _notice),
    do: finish(socket, {:refused, 502, "unavailable", CustomerAuth.unavailable()})

  defp finish(socket, {:signed_in, token, age, _body}) do
    # Hand the session to the controller, which sets the httpOnly cookie.
    sealed =
      Phoenix.Token.encrypt(BdStarterWeb.Endpoint, @handoff_salt, %{
        "token" => token,
        "age" => age
      })

    {:noreply, assign(socket, handoff: sealed)}
  end

  defp finish(socket, {:refused, _status, code, message}) do
    case Core.field_for(code, fields(socket.assigns)) do
      nil -> {:noreply, assign(socket, problem: message)}
      field -> {:noreply, socket |> set_error(field, message) |> focus(field)}
    end
  end

  defp finish(socket, _other),
    do: {:noreply, assign(socket, problem: CustomerAuth.unavailable())}

  defp go(socket, step, focus) do
    socket
    |> assign(
      step: step,
      pending: if(step == :code, do: socket.assigns.pending),
      errors: %{},
      edited: MapSet.new(),
      problem: nil,
      notice: nil,
      values: Map.drop(socket.assigns.values, ["code", "newPassword", "password"])
    )
    |> focus(focus)
  end

  defp forward(path, body) do
    case Bd.client() do
      nil -> {:refused, 503, "unavailable", "Sign-in isn't set up yet."}
      client -> CustomerAuth.forward(client, path, body)
    end
  end

  # ── Values and checks ─────────────────────────────────────────────────────

  defp take_values(socket, params) do
    Enum.reduce(Core.fields(), socket, fn field, acc ->
      case params do
        %{^field => value} when is_binary(value) -> put_value(acc, field, value)
        _ -> acc
      end
    end)
  end

  defp put_value(socket, "code", value),
    do:
      update(
        socket,
        :values,
        &Map.put(&1, "code", value |> String.replace(~r/[^0-9]/, "") |> String.slice(0, 6))
      )

  defp put_value(socket, field, value), do: update(socket, :values, &Map.put(&1, field, value))

  defp value(socket, field), do: Map.get(socket.assigns.values, field, "")
  defp email(socket), do: socket |> value("email") |> String.trim()

  defp check(socket, field), do: Core.problem(field, value(socket, field), socket.assigns.step)

  defp set_error(socket, field, nil), do: update(socket, :errors, &Map.delete(&1, field))

  defp set_error(socket, field, message),
    do: update(socket, :errors, &Map.put(&1, field, message))

  defp auto_send_code?(%{assigns: %{step: :code, pending: %{purpose: purpose}}} = socket),
    do: purpose != :reset and String.length(value(socket, "code")) == 6

  defp auto_send_code?(_socket), do: false

  defp focus(socket, nil), do: socket

  defp focus(socket, field),
    do: push_event(socket, "bd-sign-in-focus", %{id: "bd-sign-in-" <> field})

  defp clean(text) do
    case String.trim(text) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  # ── What each step shows ──────────────────────────────────────────────────

  defp fields(%{step: :signIn}), do: ["email", "password"]
  defp fields(%{step: :createAccount}), do: ["firstName", "lastName", "email", "password"]
  defp fields(%{step: :forgot}), do: ["email"]
  defp fields(%{step: :code, pending: %{purpose: :reset}}), do: ["code", "newPassword"]
  defp fields(%{step: :code}), do: ["code"]

  defp texts(%{step: :signIn, options: options}) do
    name = options.name

    %{
      title:
        if(name,
          do: Core.fill(Core.word(:signInTitle), name: name),
          else: Core.word(:signInTitleNoName)
        ),
      subtitle: "Sign in to see your jobs and invoices.",
      primary: Core.word(:signIn),
      hint: nil,
      links:
        if(options.password,
          do: [{"forgot", Core.word(:forgotPassword)}, {"createAccount", Core.word(:noAccount)}],
          else: []
        )
    }
  end

  defp texts(%{step: :createAccount, options: %{name: name}}) do
    %{
      title:
        if(name,
          do: Core.fill(Core.word(:createTitle), name: name),
          else: Core.word(:createTitleNoName)
        ),
      subtitle:
        if(name,
          do: Core.fill(Core.word(:createSubtitle), name: name),
          else: Core.word(:createSubtitleNoName)
        ),
      primary: Core.word(:createAccount),
      hint: Core.word(:passwordRule),
      links: [{"signIn", Core.word(:haveAccount)}]
    }
  end

  defp texts(%{step: :forgot}) do
    %{
      title: Core.word(:forgotTitle),
      subtitle: Core.word(:forgotSubtitle),
      primary: Core.word(:sendCode),
      hint: nil,
      links: [{"signIn", Core.word(:backToSignIn)}]
    }
  end

  defp texts(%{step: :code, pending: pending}) do
    reset = pending.purpose == :reset

    %{
      title: Core.word(:codeTitle),
      subtitle:
        Core.fill(Core.word(if(reset, do: :codeResetSubtitle, else: :codeSubtitle)),
          email: pending.email
        ),
      primary: Core.word(:confirm),
      hint: if(reset, do: Core.word(:passwordRule)),
      links: [{"resend", Core.word(:resendCode)}, {"signIn", Core.word(:backToSignIn)}]
    }
  end

  # The boxes, with first and last name sharing a row.
  defp rows(["firstName", "lastName" | rest]), do: [["firstName", "lastName"] | rows(rest)]
  defp rows([field | rest]), do: [[field] | rows(rest)]
  defp rows([]), do: []

  defp input_type("email"), do: "email"
  defp input_type(field) when field in ["password", "newPassword"], do: "password"
  defp input_type(_), do: "text"

  defp autocomplete("firstName", _), do: "given-name"
  defp autocomplete("lastName", _), do: "family-name"
  defp autocomplete("email", _), do: "email"
  defp autocomplete("password", :createAccount), do: "new-password"
  defp autocomplete("password", _), do: "current-password"
  defp autocomplete("code", _), do: "one-time-code"
  defp autocomplete("newPassword", _), do: "new-password"

  defp inputmode("email"), do: "email"
  defp inputmode("code"), do: "numeric"
  defp inputmode(_), do: nil

  # Passwords are never written back into the page.
  defp shown_value(_values, field) when field in ["password", "newPassword"], do: ""
  defp shown_value(values, field), do: Map.get(values, field, "")

  # ── BD's options for the screen ───────────────────────────────────────────

  defp options do
    fallback = %{name: nil, password: true, oauth: [], style: "", logo_url: nil}

    Cache.fetch(
      "sign-in-options",
      ["site"],
      fn ->
        case forward("options", nil) do
          {:answered, body} ->
            {:ok,
             %{
               name: present(body["name"]),
               password: body["password"] != false,
               oauth: Enum.filter(Core.providers(), &(&1 in List.wrap(body["oauth"]))),
               style: Core.palette_style(body["primaryColor"], body["secondaryColor"]),
               logo_url:
                 case body["logoUrl"] do
                   "https://" <> _ = url -> url
                   _ -> nil
                 end
             }}

          other ->
            {:error, other}
        end
      end,
      fallback
    )
  end

  defp present(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp present(_), do: nil

  # ── The screen ────────────────────────────────────────────────────────────

  @marks %{
    "apple" =>
      ~S|<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"/></svg>|,
    "github" =>
      ~S|<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>|,
    "discord" =>
      ~S|<svg viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>|,
    "google" =>
      ~S|<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>|
  }

  @impl true
  def render(assigns) do
    assigns = assign(assigns, t: texts(assigns), shown: fields(assigns), marks: @marks)

    ~H"""
    <div class="bd-sign-in" id="bd-sign-in" style={@options.style}>
      <form class="bd-sign-in__form" novalidate phx-change="change" phx-submit="submit">
        <fieldset class="bd-sign-in__fieldset">
          <div class="bd-sign-in__header">
            <img :if={@options.logo_url} class="bd-sign-in__logo" src={@options.logo_url} alt="" onerror="this.hidden=true" />
            <h2 class="bd-sign-in__title">{@t.title}</h2>
            <p :if={@t.subtitle} class="bd-sign-in__subtitle">{@t.subtitle}</p>
          </div>
          <div class="bd-sign-in__body">
            <div class="bd-sign-in__body">
              <div :for={row <- rows(@shown)} class={length(row) > 1 && "bd-sign-in__row"}>
                <div :for={f <- row} class={["bd-sign-in__field", @errors[f] && "bd-sign-in__field--error"]}>
                  <input
                    class={["bd-sign-in__input", f == "code" && "bd-sign-in__input--code"]}
                    id={"bd-sign-in-" <> f}
                    name={f}
                    type={input_type(f)}
                    autocomplete={autocomplete(f, @step)}
                    inputmode={inputmode(f)}
                    maxlength={if f == "code", do: "6"}
                    placeholder={Core.label(f)}
                    aria-label={Core.label(f)}
                    aria-describedby={"bd-sign-in-" <> f <> "-error"}
                    aria-invalid={@errors[f] && "true"}
                    value={shown_value(@values, f)}
                    phx-blur="blur"
                    phx-value-field={f}
                  />
                  <p class="bd-sign-in__error" id={"bd-sign-in-" <> f <> "-error"} aria-live="polite" hidden={!@errors[f]}>{@errors[f]}</p>
                </div>
              </div>
              <p :if={@t.hint} class="bd-sign-in__hint">{@t.hint}</p>
            </div>
            <p class="bd-sign-in__problem" id="bd-sign-in-problem" role="alert" hidden={!@problem}>{@problem}</p>
            <p class="bd-sign-in__notice" id="bd-sign-in-notice" role="status" hidden={!@notice}>{@notice}</p>
            <button type="submit" class="bd-sign-in__primary">
              <span class="bd-sign-in__label">{@t.primary}</span><span class="bd-sign-in__spinner" aria-hidden="true"></span>
            </button>
          </div>
          <div :if={@t.links != []} class="bd-sign-in__links">
            <button :for={{to, label} <- @t.links} type="button" class="bd-sign-in__link" phx-click="go" phx-value-to={to} name="go" value={to}>
              {label}
            </button>
          </div>
          <div :if={@step in [:signIn, :createAccount] and @options.oauth != []} class="bd-sign-in__providers">
            <div class="bd-sign-in__divider">{Core.word(:or)}</div>
            <a
              :for={id <- @options.oauth}
              class={"bd-sign-in__provider bd-sign-in__provider--" <> id}
              href={"/api/bd-auth/customer/oauth/" <> id <> "?returnTo=" <> URI.encode_www_form(@next || "/my-account")}
            >
              {raw(@marks[id])}<span>{Core.continue_with(id)}</span>
            </a>
          </div>
        </fieldset>
      </form>
      <.form
        :if={@handoff}
        for={to_form(%{}, as: :handoff)}
        id="bd-sign-in-handoff"
        action={~p"/my-account/session"}
        phx-trigger-action={true}
      >
        <input type="hidden" name="token" value={@handoff} />
        <input :if={@next} type="hidden" name="next" value={@next} />
      </.form>
    </div>
    """
  end
end
