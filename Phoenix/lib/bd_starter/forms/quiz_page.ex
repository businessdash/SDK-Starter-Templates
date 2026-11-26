defmodule BdStarter.Forms.QuizPage do
  @moduledoc """
  The page around a quiz: a header (name, description, facts) and, when the
  quiz can't be taken here and now, a gate in its place. Worded exactly as
  BD's hosted `/quiz-invite` page (forms-core's `quizInvitationPage` /
  `quizPracticePage`).

  A page is `%{header: %{eyebrow, title, description, facts} | nil, gate:
  %{kind, title, body, action: %{id, label, href} | nil} | nil}`; a gate's
  kind is invalid, expired, closed, signIn or switchAccount.
  """

  alias BdStarter.Forms.{Js, Json, QuizWords}

  # "About 10 minutes", "15 minute limit".
  defp minutes_facts(w, page) do
    estimated = Json.num(page["estimatedMinutes"])
    limit = Json.num(page["timeLimitMinutes"])

    if(estimated != nil and estimated != 0,
      do: [QuizWords.fill(w.about_minutes, minutes: Js.string(estimated))],
      else: []
    ) ++
      if(limit != nil and limit != 0,
        do: [QuizWords.fill(w.minute_limit, minutes: Js.string(limit))],
        else: []
      )
  end

  defp gate(kind, body),
    do: %{header: nil, gate: %{kind: kind, title: nil, body: body, action: nil}}

  @doc "An invitation's page; nil (BD found none) is the invalid gate."
  def invitation(invitation, w \\ %QuizWords{}, sign_in_href \\ nil, switch_account_href \\ nil)

  def invitation(nil, w, _, _), do: gate("invalid", w.invalid)

  def invitation(invitation, w, sign_in_href, switch_account_href) do
    cond do
      invitation["expired"] == true ->
        gate("expired", w.expired)

      invitation["active"] != true and invitation["status"] != "completed" ->
        gate("closed", w.closed)

      true ->
        recipient = Json.str(invitation["recipientName"])

        facts =
          if(recipient not in [nil, ""],
            do: [QuizWords.fill(w.for_recipient, name: recipient)],
            else: []
          ) ++
            minutes_facts(w, invitation) ++
            [
              if(invitation["requireAuthentication"] == true,
                do: w.authenticated_response,
                else: w.one_response
              )
            ]

        description = Json.str(invitation["description"]) || ""

        header = %{
          eyebrow: w.eyebrow,
          title: Json.str(invitation["name"]) || "",
          description: if(description != "", do: description),
          facts: facts
        }

        case invitation["authenticationStatus"] do
          status when status in ["required", "mismatch"] ->
            sign_in = status == "required"

            %{
              header: header,
              gate: %{
                kind: if(sign_in, do: "signIn", else: "switchAccount"),
                title: if(sign_in, do: w.sign_in_title, else: w.switch_account_title),
                body:
                  QuizWords.fill(w.account_body,
                    email: Json.str(invitation["recipientEmailHint"]) || ""
                  ),
                action: %{
                  id: if(sign_in, do: "signIn", else: "switchAccount"),
                  label: if(sign_in, do: w.sign_in_action, else: w.switch_account_action),
                  href: if(sign_in, do: sign_in_href, else: switch_account_href)
                }
              }
            }

          _ ->
            %{header: header, gate: nil}
        end
    end
  end

  def practice(practice, w \\ %QuizWords{}) do
    description = Json.str(practice["description"]) || ""

    %{
      header: %{
        eyebrow: w.practice_eyebrow,
        title: Json.str(practice["name"]) || "",
        description: if(description != "", do: description),
        facts: minutes_facts(w, practice) ++ [w.practice_note]
      },
      gate: nil
    }
  end
end
