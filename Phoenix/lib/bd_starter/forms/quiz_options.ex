defmodule BdStarter.Forms.QuizOptions do
  @moduledoc "How a quiz is taken: its questions, feedback, timer, order and wording."

  alias BdStarter.Forms.{Field, Json, QuizWords}

  defstruct fields: [],
            question_field_ids: nil,
            # "immediate" | "end"
            feedback_mode: "end",
            passing_score: nil,
            show_timer: false,
            time_limit_minutes: nil,
            show_score: true,
            results_locked: false,
            sign_in_href: nil,
            shuffle_choices: false,
            shuffle_questions: false,
            seed: nil,
            question_limit: nil,
            allow_dont_know: false,
            # "single" | "all"
            layout: "single",
            local: nil,
            can_restart: nil,
            words: %QuizWords{}

  defp finite(v) when is_float(v), do: v
  defp finite(_), do: nil

  @doc "Options as JSON (forms-core's `QuizOptions`), read leniently."
  def from_json(o) do
    limit = finite(Json.num(o["questionLimit"]))
    ids = o["questionFieldIds"]

    %__MODULE__{
      fields: Field.list(o["fields"]),
      question_field_ids: if(Field.fits?(ids, "s*"), do: ids),
      feedback_mode: if(o["feedbackMode"] == "immediate", do: "immediate", else: "end"),
      passing_score: Json.num(o["passingScore"]),
      show_timer: Json.bool(o["showTimer"]) || false,
      time_limit_minutes: Json.num(o["timeLimitMinutes"]),
      show_score: if(is_boolean(o["showScore"]), do: o["showScore"], else: true),
      results_locked: Json.bool(o["resultsLocked"]) || false,
      sign_in_href: Json.str(o["signInHref"]),
      shuffle_choices: Json.bool(o["shuffleChoices"]) || false,
      shuffle_questions: Json.bool(o["shuffleQuestions"]) || false,
      seed: Json.str(o["seed"]),
      question_limit: if(limit != nil, do: Kernel.trunc(Float.floor(limit))),
      allow_dont_know: Json.bool(o["allowDontKnow"]) || false,
      layout: if(o["layout"] == "all", do: "all", else: "single"),
      local: Json.bool(o["local"]),
      can_restart: Json.bool(o["canRestart"])
    }
  end

  @doc "An invitation from BD: BD grades it, keeps its answers and runs its clock."
  def from_invitation(invitation, sign_in_href \\ nil) do
    taking = Json.obj(Json.get(invitation["settings"], "quiz")) || %{}

    %__MODULE__{
      fields: Field.list(invitation["fields"]),
      question_field_ids: Json.strings(invitation["questionFieldIds"]),
      feedback_mode: if(invitation["feedbackMode"] == "immediate", do: "immediate", else: "end"),
      passing_score: Json.num(invitation["passingScore"]),
      show_timer: invitation["showTimer"] == true,
      time_limit_minutes: Json.num(invitation["timeLimitMinutes"]),
      show_score: invitation["showScore"] != false,
      results_locked:
        invitation["resultsRequireAccount"] == true and invitation["resultsUnlocked"] != true,
      sign_in_href: sign_in_href,
      shuffle_choices: taking["shuffleChoices"] == true,
      shuffle_questions: taking["shuffleQuestions"] == true,
      seed: Json.str(invitation["id"]),
      allow_dont_know: taking["allowDontKnow"] == true,
      local: false,
      can_restart: false
    }
  end

  @doc "A practice quiz from BD: graded by BD, timed here, nothing recorded."
  def from_practice(practice, seed \\ nil, question_limit \\ nil) do
    taking = Json.obj(Json.get(practice["settings"], "quiz")) || %{}

    %__MODULE__{
      fields: Field.list(practice["fields"]),
      question_field_ids: Json.strings(practice["questionFieldIds"]),
      feedback_mode: if(practice["feedbackMode"] == "immediate", do: "immediate", else: "end"),
      passing_score: Json.num(practice["passingScore"]),
      show_timer: practice["showTimer"] == true,
      time_limit_minutes: Json.num(practice["timeLimitMinutes"]),
      shuffle_choices: taking["shuffleChoices"] == true,
      shuffle_questions: taking["shuffleQuestions"] == true,
      seed: seed,
      question_limit: question_limit,
      allow_dont_know: taking["allowDontKnow"] == true,
      local: true,
      can_restart: true
    }
  end
end
