defmodule BdStarter.Bd.SignInCore do
  @moduledoc """
  The sign-in screen's words, checks and brand colours: an Elixir port of
  `@businessdash/sdk/sign-in-core`, so this app renders the same screen as
  every other starter (`<BdSignIn>`, the Swift app's `BdSignInView`, Kotlin's
  `:bd-sign-in`). Keep it in step with the SDK.
  """

  @fields ~w(firstName lastName email password code newPassword)
  @providers ~w(apple google github discord)

  @doc "Every box the screen can show."
  def fields, do: @fields

  @doc "The \"Continue with …\" providers, in the order the screen shows them."
  def providers, do: @providers

  # ── Words (DEFAULT_SIGN_IN_STRINGS) ────────────────────────────────────────

  @words %{
    signInTitle: "Sign in to {name}",
    createTitle: "Create your {name} account",
    createSubtitle: "Your account with {name}. We'll email you a code to confirm it.",
    signInTitleNoName: "Sign in",
    createTitleNoName: "Create your account",
    createSubtitleNoName: "We'll email you a code to confirm it.",
    forgotTitle: "Reset your password",
    forgotSubtitle: "Enter your email and we'll send you a code.",
    codeTitle: "Check your email",
    codeSubtitle: "We sent a 6-digit code to {email}.",
    codeResetSubtitle: "We sent a 6-digit code to {email}. Enter it with your new password.",
    passwordRule: "At least 10 characters.",
    signIn: "Sign in",
    createAccount: "Create account",
    sendCode: "Send code",
    confirm: "Continue",
    resendCode: "Send a new code",
    codeResent: "A new code is on its way.",
    forgotPassword: "Forgot password?",
    noAccount: "New here? Create an account",
    haveAccount: "Already have an account? Sign in",
    backToSignIn: "Back to sign in",
    or: "or",
    enterEmail: "Enter your email.",
    invalidEmail: "Enter a full email address, like name@example.com.",
    enterPassword: "Enter your password.",
    enterCode: "Enter the 6-digit code from the email.",
    passwordTooShort: "Use at least 10 characters for your password.",
    passwordTooLong: "Use 256 characters or fewer for your password.",
    nameTooLong: "Use 100 characters or fewer."
  }

  @labels %{
    "firstName" => "First name",
    "lastName" => "Last name",
    "email" => "Email",
    "password" => "Password",
    "code" => "6-digit code",
    "newPassword" => "New password"
  }

  @continue_with %{
    "apple" => "Continue with Apple",
    "google" => "Continue with Google",
    "github" => "Continue with GitHub",
    "discord" => "Continue with Discord"
  }

  def word(key), do: Map.fetch!(@words, key)
  def label(field), do: Map.fetch!(@labels, field)
  def continue_with(provider), do: Map.fetch!(@continue_with, provider)

  @doc "`{name}` → the business's name, `{email}` → where a code went."
  def fill(template, values) do
    Enum.reduce(values, template, fn {key, value}, acc ->
      String.replace(acc, "{#{key}}", value)
    end)
  end

  # ── Checks (validateSignInField) ───────────────────────────────────────────

  @min_password 10
  @max_password 256
  @max_email 320
  @max_name 100
  # Local part @ domain . TLD (≥ 2) — the rule the SDK's email fields use.
  @email_pattern ~r/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u

  @doc """
  What's wrong with one box, or nil. `step` matters for the password: signing
  in only needs one, a new account needs BD's 10-character minimum.
  """
  def problem(field, value, step)

  def problem(field, value, _step) when field in ["firstName", "lastName"] do
    if length16(String.trim(value)) > @max_name, do: word(:nameTooLong)
  end

  def problem("email", value, _step) do
    email = String.trim(value)

    cond do
      email == "" ->
        word(:enterEmail)

      length16(email) > @max_email or not Regex.match?(@email_pattern, email) ->
        word(:invalidEmail)

      true ->
        nil
    end
  end

  def problem("password", value, :signIn) do
    cond do
      value == "" -> word(:enterPassword)
      length16(value) > @max_password -> word(:passwordTooLong)
      true -> nil
    end
  end

  def problem("password", value, _step), do: new_password_problem(value)
  def problem("newPassword", value, _step), do: new_password_problem(value)

  def problem("code", value, _step) do
    if Regex.match?(~r/^[0-9]{6}$/, value), do: nil, else: word(:enterCode)
  end

  defp new_password_problem(value) do
    cond do
      length16(value) < @min_password -> word(:passwordTooShort)
      length16(value) > @max_password -> word(:passwordTooLong)
      true -> nil
    end
  end

  # Lengths as JavaScript counts them (UTF-16), so both sides agree.
  defp length16(text), do: div(byte_size(:unicode.characters_to_binary(text, :utf8, :utf16)), 2)

  @doc "BD's answers that are about one box go under that box."
  def field_for(code, shown) do
    pick = fn candidates -> Enum.find(candidates, &(&1 in shown)) end

    case code do
      c when c in ["weak_password", "password_too_short"] -> pick.(["newPassword", "password"])
      c when c in ["invalid_code", "code_expired"] -> pick.(["code"])
      "invalid_email" -> pick.(["email"])
      _ -> nil
    end
  end

  # ── Brand colours (signInPalette) ──────────────────────────────────────────

  @doc """
  A business's two colours as the screen uses them, as CSS variables: the
  button keeps the primary as set, with readable text on it; links use the
  secondary (the primary when there's none), nudged only as far as it takes to
  read at 4.5:1 on a light and on a dark page. "" when there's no primary.
  """
  def palette_style(primary, secondary) do
    case normalize(primary) do
      nil ->
        ""

      accent ->
        link_base = normalize(secondary) || accent

        on_accent =
          if contrast(accent, "#ffffff") >= contrast(accent, "#111827"),
            do: "#ffffff",
            else: "#111827"

        [
          {"--bd-sign-in-accent", accent},
          {"--bd-sign-in-on-accent", on_accent},
          {"--bd-sign-in-link", legible(link_base, "#ffffff", 4.5)},
          {"--bd-sign-in-link-dark", legible(link_base, "#111827", 4.5)},
          {"--bd-sign-in-ring-light", legible(accent, "#ffffff", 3)},
          {"--bd-sign-in-ring-dark", legible(accent, "#111827", 3)}
        ]
        |> Enum.map_join(";", fn {name, value} -> "#{name}:#{value}" end)
    end
  end

  @doc "`#abc` / `#AABBCC` → `#aabbcc`; anything else → nil."
  def normalize(raw) when is_binary(raw) do
    color = raw |> String.trim() |> String.downcase()

    cond do
      Regex.match?(~r/^#[0-9a-f]{6}$/, color) ->
        color

      Regex.match?(~r/^#[0-9a-f]{3}$/, color) ->
        "#" <> (color |> String.slice(1, 3) |> String.graphemes() |> Enum.map_join(&(&1 <> &1)))

      true ->
        nil
    end
  end

  def normalize(_), do: nil

  defp channels("#" <> hex) do
    for i <- [0, 2, 4], do: hex |> binary_part(i, 2) |> String.to_integer(16)
  end

  defp luminance(hex) do
    [r, g, b] =
      for value <- channels(hex) do
        c = value / 255
        if c <= 0.03928, do: c / 12.92, else: :math.pow((c + 0.055) / 1.055, 2.4)
      end

    0.2126 * r + 0.7152 * g + 0.0722 * b
  end

  @doc "WCAG contrast ratio of two `#rrggbb` colours (1–21)."
  def contrast(a, b) do
    {la, lb} = {luminance(a), luminance(b)}
    (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
  end

  defp mix(hex, toward, t) do
    channels = Enum.zip(channels(hex), channels(toward))

    "#" <>
      Enum.map_join(channels, fn {from, to} ->
        (from + (to - from) * t)
        |> round()
        |> Integer.to_string(16)
        |> String.downcase()
        |> String.pad_leading(2, "0")
      end)
  end

  # Darkened (light surface) or lightened (dark one) just enough to read.
  defp legible(hex, surface, min) do
    toward = if luminance(surface) > 0.5, do: "#000000", else: "#ffffff"

    Enum.find_value(0..40, toward, fn step ->
      candidate = mix(hex, toward, step / 40)
      if contrast(candidate, surface) >= min, do: candidate
    end)
  end

  @doc """
  Where to go after signing in (`?next=` on /my-account): a path on this
  site, or nil. Not `//host` (another site), no backslash or control
  characters, at most 512 characters.
  """
  def safe_next("/" <> _ = raw) do
    if byte_size(raw) > 512 or String.starts_with?(raw, "//") or
         Regex.match?(~r/[\\\x00-\x1f\x7f]/, raw),
       do: nil,
       else: raw
  end

  def safe_next(_), do: nil
end
