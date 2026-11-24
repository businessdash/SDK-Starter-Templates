defmodule BdStarter.Forms.QuizConfig do
  @moduledoc "A quiz's options resolved for one run: its questions in order, its rules settled."

  alias BdStarter.Forms.{QuizArrange, QuizScoring}

  defstruct [
    :questions,
    :feedback_mode,
    :passing_score,
    :timer_enabled,
    :time_limit_minutes,
    :show_score,
    :results_locked,
    :sign_in_href,
    :allow_dont_know,
    :layout,
    :local,
    :can_restart,
    :words
  ]

  def new(options, seed) do
    limit =
      case options.time_limit_minutes do
        l when is_float(l) and l > 0 -> Kernel.trunc(Float.floor(l))
        l when is_integer(l) and l > 0 -> l
        _ -> nil
      end

    local = options.local || false

    %__MODULE__{
      local: local,
      questions: QuizArrange.questions(options, seed, local),
      feedback_mode: options.feedback_mode,
      passing_score:
        if(is_float(options.passing_score), do: options.passing_score, else: QuizScoring.default_passing_grade()),
      timer_enabled: options.show_timer or limit != nil,
      time_limit_minutes: limit,
      show_score: options.show_score,
      results_locked: options.results_locked,
      sign_in_href: options.sign_in_href,
      allow_dont_know: options.allow_dont_know,
      layout: if(options.feedback_mode == "end" and options.layout == "all", do: "all", else: "single"),
      can_restart: options.can_restart || false,
      words: options.words
    }
  end

  def question(config, field_id), do: Enum.find(config.questions, &(&1.id == field_id))
end
