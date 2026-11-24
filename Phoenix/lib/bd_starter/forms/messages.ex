defmodule BdStarter.Forms.Messages do
  @moduledoc """
  What a visitor reads for a problem: the same wording as the web renderer
  and the other native ports.
  """

  alias BdStarter.Forms.{Field, Js, Json}

  def message(reason, label, field) do
    name = if label == "", do: "This field", else: label
    type = field && field.type

    case reason do
      "required" ->
        cond do
          type == "boolean" and Field.must_be_true?(field) -> "Please confirm to continue."
          type == "or_condition" -> "Fill in at least one side to continue."
          type == "multi_populator" -> "Add at least one entry."
          true -> "#{name} is required."
        end

      "business_email" ->
        "Please use your work email address."

      "regex" ->
        "#{name} isn't in the expected format."

      "options" ->
        "Choose one of the listed options."

      "unknown_field" ->
        "#{name} isn't part of this form."

      "range_order" ->
        "The end must come after the start."

      "range_same_day" ->
        "Choose an end date after the start date."

      "format" ->
        case type do
          "email" -> "Enter a valid email address."
          "phone" -> "Enter a valid phone number."
          t when t in ["url", "image_input"] -> "Enter a valid web address, like example.com."
          "address" -> "Enter a 5-digit ZIP code."
          "month_year" -> "Choose a month and a year."
          "color_picker" -> "Enter a hex color, like #3366FF."
          "schedule" -> "Choose a valid time."
          t when t in ["number", "measurement"] -> "Enter a whole number."
          "currency" ->
            if Field.config(field, "currencyConfig", "allowDecimal") == false,
              do: "Enter a whole amount.",
              else: "Enter an amount of 0 or more."

          _ -> "#{name} isn't valid."
        end

      "min" ->
        min = field && (Json.num(Field.config(field, "validation", "min")) || Json.num(Field.config(field, "sliderConfig", "min")))
        if min != nil, do: "Enter #{Js.number_string(min)} or more.", else: "Enter 0 or more."

      "max" ->
        max = field && (Json.num(Field.config(field, "validation", "max")) || Json.num(Field.config(field, "sliderConfig", "max")))

        cond do
          max != nil ->
            "Enter #{Js.number_string(max)} or less."

          type == "file_upload" ->
            n = Kernel.trunc(Json.num(Field.config(field, "fileConfig", "maxFiles")) || 1.0)
            "Attach at most #{n} file#{if n == 1, do: "", else: "s"}."

          type == "star_rating" ->
            "Choose up to #{Kernel.trunc(Json.num(Field.config(field, "starRatingConfig", "maxStars")) || 5.0)} stars."

          true ->
            "#{name} is too long."
        end

      "type" ->
        "#{name} has an invalid value."

      _ ->
        # A repeater reports its child: "Age: max".
        case :binary.match(reason, ":") do
          {at, 1} ->
            inner = message(String.trim(binary_part(reason, at + 1, byte_size(reason) - at - 1), " "), "", nil)
            binary_part(reason, 0, at) <> ": " <> Js.lower(inner)

          :nomatch ->
            "#{name} isn't valid."
        end
    end
  end
end
