defmodule BdStarterWeb.FormComponents do
  @moduledoc """
  A BusinessDash form's markup (`BdStarterWeb.FormLive`), in the SDK's
  `bd-*` classes, so the SDK's bd-forms.css and priv/static/forms.css style
  it as they style the `<bd-form>` element.

  Every function takes `v`: the form's controller (`c`), the problems shown
  (`errors`), its DOM id (`form_id`) and the LiveView's `uploads`.
  """
  use Phoenix.Component

  alias BdStarter.Forms.{Calculation, Field, FieldPath, FormController, FormView, Js, Json}

  # ── A list of fields ──────────────────────────────────────────────────────

  @doc "A list of fields. `prefix` is the repeater row's key prefix, `entries` its path, `flat` draws groups flat."
  attr :v, :map, required: true
  attr :fields, :list, required: true
  attr :prefix, :string, default: ""
  attr :entries, :list, default: []
  attr :flat, :boolean, default: false

  def tree(assigns) do
    ~H"""
    <div class="bd-tree">
      <%= for field <- @fields do %>
        <.item v={@v} field={field} prefix={@prefix} entries={@entries} flat={@flat} />
      <% end %>
    </div>
    """
  end

  attr :v, :map, required: true
  attr :field, :any, required: true
  attr :prefix, :string, required: true
  attr :entries, :list, required: true
  attr :flat, :boolean, required: true

  defp item(%{field: %Field{type: "input_group"}} = assigns) do
    kids = assigns.field.children || []
    count = FormController.reveal_count(assigns.v.c, assigns.field, assigns.entries)
    assigns = assign(assigns, shown: Enum.take(kids, count), rest: Enum.drop(kids, count))

    ~H"""
    <div
      class={["bd-group", @flat && "bd-group--flat", !@flat && "bd-group--card"]}
      data-bd-group={FormView.css_key(@field)}
      hidden={!FormController.visible?(@v.c, @field, @entries)}
      id={"group-#{@v.form_id}-#{@prefix}#{@field.id}"}
    >
      <div
        :if={Field.bool(@field, "showGroupLabel") == true and @field.label != ""}
        class="bd-group__label"
      >
        {@field.label}
      </div>
      <.tree v={@v} fields={@shown} prefix={@prefix} entries={@entries} />
      <div :if={@rest != []} hidden>
        <.tree v={@v} fields={@rest} prefix={@prefix} entries={@entries} />
      </div>
    </div>
    """
  end

  defp item(%{field: %Field{type: "condition_block"}} = assigns) do
    ~H"""
    <%!-- Hidden, not dropped: what's typed there comes back if the condition does. --%>
    <div class="bd-condition" hidden={!FormController.visible?(@v.c, @field, @entries)}>
      <.tree v={@v} fields={@field.children || []} prefix={@prefix} entries={@entries} />
    </div>
    """
  end

  defp item(%{field: %Field{type: "or_condition"}} = assigns) do
    kids = assigns.field.children || []

    assigns =
      assign(assigns,
        left: Enum.at(kids, 0),
        right: Enum.at(kids, 1),
        error:
          Map.get(
            assigns.v.errors,
            FieldPath.key(FieldPath.new(assigns.field.id, assigns.entries))
          )
      )

    ~H"""
    <div class={["bd-or", @error && "bd-or--error"]}>
      <div :if={@field.label != ""} class="bd-or__label">
        {@field.label}<span class="bd-or__hint"> Fill at least one side</span>
      </div>
      <div class="bd-or__grid">
        <div class="bd-or__side">
          <div class="bd-or__side-label">
            {Field.config(@field, "orConditionConfig", "leftLabel") || "Option A"}
          </div>
          <.tree :if={@left} v={@v} fields={[@left]} prefix={@prefix} entries={@entries} />
        </div>
        <div class="bd-or__divider"><span class="bd-or__badge">OR</span></div>
        <div class="bd-or__side">
          <div class="bd-or__side-label">
            {Field.config(@field, "orConditionConfig", "rightLabel") || "Option B"}
          </div>
          <.tree :if={@right} v={@v} fields={[@right]} prefix={@prefix} entries={@entries} />
        </div>
      </div>
      <p :if={@error} class="bd-or__error">{@error}</p>
    </div>
    """
  end

  defp item(%{field: %Field{type: "flex_row"}} = assigns) do
    ~H"""
    <div class="bd-flex-row">
      <div :for={cell <- @field.children || []} class="bd-flex-row__cell">
        <.tree v={@v} fields={[cell]} prefix={@prefix} entries={@entries} />
      </div>
    </div>
    """
  end

  defp item(%{field: %Field{type: "reference_value"}} = assigns), do: ~H""

  defp item(assigns), do: field(assigns)

  # ── One field: label, control, problem, help ──────────────────────────────

  defp field(assigns) do
    %{v: v, field: field, prefix: prefix, entries: entries} = assigns
    key = prefix <> field.id
    path = FieldPath.new(field.id, entries)
    error = Map.get(v.errors, FieldPath.key(path))
    input_id = FormView.dom_id(v.form_id, key)
    help = Field.str(field, "helpText")
    help_id = if help, do: "#{input_id}-help"
    error_id = if error, do: "#{input_id}-error"
    described_by = [error_id, help_id] |> Enum.reject(&is_nil/1) |> Enum.join(" ")
    single = FormView.single_control?(field)
    shows_label = FormView.shows_label?(field)

    assigns =
      assign(assigns,
        key: key,
        path: path,
        error: error,
        input_id: input_id,
        help: help,
        help_id: help_id,
        error_id: error_id,
        label_id: "#{input_id}-label",
        single: single,
        shows_label: shows_label,
        # On a control: what describes it and whether it's wrong. On a group's container: what names it.
        described_by: if(described_by != "", do: described_by),
        invalid: if(error, do: "true"),
        labelled_by: if(shows_label and not single, do: "#{input_id}-label"),
        value: FormController.value(v.c, path),
        name: FormView.input_name(key)
      )

    ~H"""
    <div
      class={[
        "bd-field",
        "bd-field--#{@field.type}",
        @field.required && "bd-field--required",
        @error && "bd-field--error"
      ]}
      data-field-id={@field.id}
      data-bd-field={FormView.css_key(@field)}
      data-bd-type={@field.type}
    >
      <%= if @shows_label do %>
        <label :if={@single} class="bd-field__label" id={@label_id} for={@input_id}>{@field.label}<span
          :if={@field.required}
          class="bd-field__required"
          aria-hidden="true"
        > *</span></label>
        <span :if={!@single} class="bd-field__label" id={@label_id}>{@field.label}<span
          :if={@field.required}
          class="bd-field__required"
          aria-hidden="true"
        > *</span></span>
      <% end %>
      <.control {assigns} />
      <p :if={@error} class="bd-field__error" id={@error_id}>{@error}</p>
      <p :if={@help} class="bd-field__help" id={@help_id}>{@help}</p>
    </div>
    """
  end

  # ── A field's control ─────────────────────────────────────────────────────

  defp control(%{field: %Field{type: "title"}} = assigns),
    do: ~H|<h2 class="bd-field__title">{@field.label}</h2>|

  defp control(%{field: %Field{type: "subtitle"}} = assigns),
    do: ~H|<h3 class="bd-field__subtitle">{@field.label}</h3>|

  defp control(%{field: %Field{type: "separator"}} = assigns),
    do: ~H|<hr class="bd-field__separator" />|

  defp control(%{field: %Field{type: t}} = assigns) when t in ["richtext", "body_text"] do
    ~H"""
    <%!-- BD publishes `content` already sanitized. --%>
    <div :if={Field.str(@field, "content")} class="bd-field__richtext bd-prose">
      {Phoenix.HTML.raw(Field.str(@field, "content"))}
    </div>
    """
  end

  defp control(%{field: %Field{type: "image"}} = assigns) do
    ~H"""
    <img
      :if={Field.config(@field, "imageConfig", "src") not in [nil, ""]}
      class="bd-field__image"
      src={Field.config(@field, "imageConfig", "src")}
      alt={Field.config(@field, "imageConfig", "alt") || ""}
    />
    """
  end

  defp control(%{field: %Field{type: t}} = assigns) when t in ["textarea", "rich_text_input"] do
    ~H"""
    <textarea
      class="bd-textarea"
      id={@input_id}
      name={@name}
      rows={Field.config(@field, "textareaConfig", "rows") |> rows()}
      placeholder={Field.str(@field, "placeholder") || ""}
      autocomplete={FormView.autocomplete(@field)}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    >{FormView.str(@value)}</textarea>
    """
  end

  defp control(%{field: %Field{type: "select"}} = assigns) do
    ~H"""
    <select
      class="bd-select"
      id={@input_id}
      name={@name}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
    >
      <option value="">{Field.str(@field, "placeholder") || "Select…"}</option>
      <option
        :for={option <- Field.options(@field) || []}
        value={option}
        selected={FormView.str(@value) == option}
      >
        {option}
      </option>
    </select>
    """
  end

  defp control(%{field: %Field{type: t}} = assigns) when t in ["radio", "checkbox"] do
    radio = assigns.field.type == "radio"

    assigns =
      assign(assigns,
        radio: radio,
        picked:
          if(radio,
            do: [FormView.str(assigns.value)],
            else: Enum.map(Json.list(assigns.value) || [], &FormView.str/1)
          )
      )

    ~H"""
    <div
      class={if @radio, do: "bd-radio-group", else: "bd-checkbox-group"}
      role={if @radio, do: "radiogroup", else: "group"}
      id={@input_id}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      aria-labelledby={@labelled_by}
    >
      <input :if={!@radio} type="hidden" name={@name <> "[]"} value="" />
      <label
        :for={{option, i} <- Enum.with_index(Field.options(@field) || [])}
        class={if @radio, do: "bd-radio-option", else: "bd-checkbox-option"}
        for={"#{@input_id}-#{i}"}
      >
        <input
          class={if @radio, do: "bd-radio", else: "bd-checkbox"}
          type={@field.type}
          id={"#{@input_id}-#{i}"}
          name={if @radio, do: @name, else: @name <> "[]"}
          value={option}
          checked={option in @picked}
        /><span>{option}</span>
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "boolean"}} = assigns) do
    ~H"""
    <label class="bd-boolean" for={@input_id}>
      <input type="hidden" name={@name} value="false" />
      <input
        class="bd-switch"
        type="checkbox"
        id={@input_id}
        name={@name}
        value="true"
        checked={@value == true}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
      />
      <span class="bd-boolean__label">{Field.str(@field, "placeholder") ||
        if(@field.label == "", do: "Yes", else: @field.label)}<span
        :if={@field.required or Field.must_be_true?(@field)}
        class="bd-field__required"
        aria-hidden="true"
      > *</span></span>
    </label>
    """
  end

  defp control(%{field: %Field{type: "date"}} = assigns) do
    ~H"""
    <input
      class="bd-input"
      type="date"
      id={@input_id}
      name={@name}
      value={FormView.str(@value)}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    />
    """
  end

  defp control(%{field: %Field{type: "email"}} = assigns) do
    ~H"""
    <input
      class="bd-input"
      type="email"
      id={@input_id}
      name={@name}
      value={FormView.str(@value)}
      placeholder={Field.str(@field, "placeholder") || "you@example.com"}
      autocomplete={FormView.autocomplete(@field)}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    />
    """
  end

  defp control(%{field: %Field{type: "phone"}} = assigns) do
    assigns =
      assign(assigns, intl: Field.config(assigns.field, "phoneConfig", "international") == true)

    ~H"""
    <div class="bd-phone">
      <span
        :if={Field.config(@field, "phoneConfig", "showFlags") == true}
        class="bd-phone__flag"
        aria-hidden="true"
      >🇺🇸</span>
      <input
        class="bd-input"
        type="tel"
        id={@input_id}
        name={@name}
        value={FormView.str(@value)}
        placeholder={
          Field.str(@field, "placeholder") ||
            if(@intl, do: "+1 (555) 000-0000", else: "(555) 000-0000")
        }
        autocomplete={FormView.autocomplete(@field)}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
        phx-debounce="blur"
      />
    </div>
    """
  end

  defp control(%{field: %Field{type: t}} = assigns) when t in ["number", "currency", "stepper"] do
    f = assigns.field
    decimals = Field.bool(f, "allowDecimal") != false and f.type != "stepper"
    min = Json.num(Field.config(f, "validation", "min"))
    max = Json.num(Field.config(f, "validation", "max"))

    assigns =
      assign(assigns,
        decimals: decimals,
        min:
          cond do
            min != nil -> FormView.number(min)
            Field.bool(f, "allowNegative") == false -> "0"
            true -> nil
          end,
        max: if(max != nil, do: FormView.number(max))
      )

    ~H"""
    <input
      class="bd-input"
      type="number"
      id={@input_id}
      name={@name}
      value={FormView.str(@value)}
      placeholder={Field.str(@field, "placeholder") || ""}
      min={@min}
      max={@max}
      step={if @decimals, do: "any", else: "1"}
      inputmode={if @decimals, do: "decimal", else: "numeric"}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    />
    """
  end

  defp control(%{field: %Field{type: "slider"}} = assigns) do
    assigns = assign(assigns, s: FormView.slider(assigns.field, assigns.value))

    ~H"""
    <div class="bd-slider-wrap">
      <div class="bd-slider__scale">
        <span>{@s.fmt.(@s.lo)}</span><output class="bd-slider__value" for={@input_id}>{@s.fmt.(
          @s.current
        )}</output><span>{@s.fmt.(@s.hi)}</span>
      </div>
      <input
        class="bd-slider"
        type="range"
        id={@input_id}
        name={@name}
        min={FormView.number(@s.lo)}
        max={FormView.number(@s.hi)}
        step={FormView.number(@s.step)}
        value={FormView.number(@s.current)}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
      />
    </div>
    """
  end

  defp control(%{field: %Field{type: "star_rating"}} = assigns) do
    assigns =
      assign(assigns,
        most:
          Kernel.trunc(
            Json.num(Field.config(assigns.field, "starRatingConfig", "maxStars")) || 5.0
          ),
        current: Kernel.trunc(Json.num(assigns.value) || 0.0)
      )

    ~H"""
    <div
      class="bd-stars"
      role="radiogroup"
      id={@input_id}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      aria-labelledby={@labelled_by}
    >
      <label :for={i <- 0..(@most - 1)//1} class={["bd-star", i < @current && "bd-star--filled"]}>
        <input
          class="bd-visually-hidden"
          type="radio"
          name={@name}
          value={i + 1}
          checked={@current == i + 1}
        /><span aria-hidden="true">★</span><span class="bd-visually-hidden">{i + 1} star{if i == 0,
          do: "",
          else: "s"}</span>
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "happiness_rating"}} = assigns) do
    assigns =
      assign(assigns,
        current: if(Json.number?(assigns.value), do: Kernel.trunc(assigns.value), else: -1)
      )

    ~H"""
    <div
      class="bd-happiness"
      role="radiogroup"
      id={@input_id}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      aria-labelledby={@labelled_by}
    >
      <label
        :for={{{face, name}, i} <- Enum.with_index(FormView.faces())}
        class={["bd-happiness__face", i == @current && "bd-happiness__face--active"]}
        title={name}
      >
        <input class="bd-visually-hidden" type="radio" name={@name} value={i} checked={@current == i} /><span aria-hidden="true">{face}</span><span class="bd-visually-hidden">{name}</span>
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "color_picker"}} = assigns) do
    ~H"""
    <div
      class="bd-colors"
      role="radiogroup"
      id={@input_id}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      aria-labelledby={@labelled_by}
    >
      <label
        :for={color <- Field.options(@field) || []}
        class={["bd-color", FormView.str(@value) == color && "bd-color--selected"]}
        style={"background-color:#{color}"}
        title={color}
      >
        <input
          class="bd-visually-hidden"
          type="radio"
          name={@name}
          value={color}
          checked={FormView.str(@value) == color}
        /><span class="bd-visually-hidden">{color}</span>
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "choice_cards"}} = assigns) do
    multi = Field.multi?(assigns.field)

    assigns =
      assign(assigns,
        multi: multi,
        picked:
          if(multi,
            do: Enum.map(Json.list(assigns.value) || [], &FormView.str/1),
            else: [FormView.str(assigns.value)]
          )
      )

    ~H"""
    <div
      class="bd-cards"
      role={if @multi, do: "group", else: "radiogroup"}
      id={@input_id}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      aria-labelledby={@labelled_by}
    >
      <input :if={@multi} type="hidden" name={@name <> "[]"} value="" />
      <label
        :for={{card, i} <- Enum.with_index(Field.cards(@field))}
        class={["bd-card-choice", card["label"] in @picked && "bd-card-choice--on"]}
        for={"#{@input_id}-#{i}"}
      >
        <input
          class="bd-card-choice__input"
          type={if @multi, do: "checkbox", else: "radio"}
          id={"#{@input_id}-#{i}"}
          name={if @multi, do: @name <> "[]", else: @name}
          value={card["label"]}
          checked={card["label"] in @picked}
        />
        <img :if={card["imageUrl"]} class="bd-card-choice__image" src={card["imageUrl"]} alt="" />
        <span class="bd-card-choice__label">{card["label"]}</span>
        <span :if={card["description"]} class="bd-card-choice__description">{card["description"]}</span>
        <span :if={card["price"]} class="bd-card-choice__price">{card["price"]}</span>
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "date_range"}} = assigns),
    do: pair(assign(assigns, cells: [{"start", "Start", "date"}, {"end", "End", "date"}]))

  defp control(%{field: %Field{type: "time_picker"}} = assigns) do
    case Field.time_mode(assigns.field) do
      "time_block" ->
        pair(assign(assigns, cells: [{"start", "Start", "time"}, {"end", "End", "time"}]))

      "appointment" ->
        pair(assign(assigns, cells: [{"date", "Date", "date"}, {"time", "Time", "time"}]))

      _ ->
        ~H"""
        <select
          class="bd-select"
          id={@input_id}
          name={@name}
          aria-describedby={@described_by}
          aria-invalid={@invalid}
        >
          <option value="">{Field.str(@field, "placeholder") || "Select time"}</option>
          <option
            :for={{time, label} <- FormView.times(@field)}
            value={time}
            selected={FormView.str(@value) == time}
          >
            {label}
          </option>
        </select>
        """
    end
  end

  defp control(%{field: %Field{type: "name"}} = assigns) do
    ~H"""
    <div class="bd-name" role="group" id={@input_id} aria-labelledby={@labelled_by}>
      <label
        :for={{part, label, token, hint, full} <- FormView.name_parts(@field)}
        class={["bd-name__field", full && "bd-name__field--full"]}
      >
        <span class="bd-name__label">{label}</span><input
          class="bd-input"
          id={FormView.dom_id(@v.form_id, @key, part)}
          name={FormView.input_name(@key, part)}
          value={FormView.part(@value, part)}
          placeholder={hint}
          autocomplete={token}
          aria-describedby={@described_by}
          aria-invalid={@invalid}
          phx-debounce="blur"
        />
      </label>
      <label
        :if={Field.config(@field, "nameConfig", "nicknames") == true}
        class="bd-name__field bd-name__field--full"
      >
        <span class="bd-name__label">Nicknames</span><input
          class="bd-input"
          name={FormView.input_name(@key, "nicknames")}
          value={FormView.part(@value, "nicknames")}
          placeholder="Johnny, JM — separate with commas"
          phx-debounce="blur"
        />
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "address"}} = assigns) do
    assigns =
      assign(assigns,
        parts: [
          {"line1", "Address line 1", "address-line1", true},
          {"line2", "Address line 2", "address-line2", true},
          {"city", "City", "address-level2", false},
          {"state", "State", "address-level1", false},
          {"zip", "ZIP", "postal-code", true}
        ]
      )

    ~H"""
    <div class="bd-address" role="group" id={@input_id} aria-labelledby={@labelled_by}>
      <label
        :for={{part, label, token, full} <- @parts}
        class={["bd-address__field", full && "bd-address__field--full"]}
      >
        <span class="bd-address__label">{label}</span><input
          class="bd-input"
          id={FormView.dom_id(@v.form_id, @key, part)}
          name={FormView.input_name(@key, part)}
          value={FormView.part(@value, part)}
          autocomplete={token}
          aria-describedby={@described_by}
          aria-invalid={@invalid}
          phx-debounce="blur"
        />
      </label>
    </div>
    """
  end

  defp control(%{field: %Field{type: "url"}} = assigns) do
    ~H"""
    <input
      class="bd-input"
      type="url"
      id={@input_id}
      name={@name}
      value={FormView.part(@value, "url")}
      placeholder={Field.str(@field, "placeholder") || "https://"}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    />
    """
  end

  defp control(%{field: %Field{type: "tags"}} = assigns) do
    ~H"""
    <input
      class="bd-input"
      id={@input_id}
      name={@name}
      value={Enum.map_join(Json.list(@value) || [], ", ", &FormView.str/1)}
      placeholder={Field.str(@field, "placeholder") || "Separate with commas"}
      aria-describedby={@described_by}
      aria-invalid={@invalid}
      phx-debounce="blur"
    />
    """
  end

  defp control(%{field: %Field{type: "measurement"}} = assigns) do
    assigns = assign(assigns, m: FormView.measurement(assigns.field, assigns.value))

    ~H"""
    <div class="bd-measurement">
      <input
        class="bd-input"
        type="number"
        step="any"
        id={@input_id}
        name={FormView.input_name(@key, "value")}
        value={FormView.part(@value, "value")}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
        phx-debounce="blur"
      />
      <%= if @m.fixed do %>
        <span class="bd-measurement__unit">{@m.unit}</span>
        <input type="hidden" name={FormView.input_name(@key, "unit")} value={@m.unit} />
      <% else %>
        <select class="bd-select" aria-label="Unit" name={FormView.input_name(@key, "unit")}>
          <option :for={unit <- @m.units} value={unit} selected={unit == @m.unit}>{unit}</option>
        </select>
      <% end %>
    </div>
    """
  end

  defp control(%{field: %Field{type: "calculation"}} = assigns) do
    display = Json.obj(Json.get(Field.cfg(assigns.field, "calculationConfig"), "display"))
    assigns = assign(assigns, display: display, shown: Calculation.format(assigns.value, display))

    ~H"""
    <output
      :if={Json.get(@display, "show") != false}
      class="bd-calc"
      id={@input_id}
      aria-live="polite"
    >{if @shown == "", do: "—", else: @shown}</output>
    """
  end

  defp control(%{field: %Field{type: "collection_select"}} = assigns) do
    cs = FormView.collection(assigns.v.c, assigns.field)

    picked =
      if cs.multi,
        do: Enum.map(Json.list(assigns.value) || [], &FormView.str/1),
        else: Enum.reject([FormView.str(assigns.value)], &(&1 == ""))

    assigns = assign(assigns, cs: cs, picked: picked)

    ~H"""
    <div :if={@cs.message} class="bd-field__collection" data-status={@cs.status}>
      <p
        class="bd-field__collection-status"
        role={if @cs.status == "empty", do: "status", else: "alert"}
      >
        {@cs.message}
      </p>
    </div>
    <div
      :if={!@cs.message and @cs.status == "select"}
      class="bd-field__collection"
      data-status="ready"
    >
      <select
        class="bd-select bd-field__collection-select"
        id={@input_id}
        name={@name}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
      >
        <option value="">{Field.str(@field, "placeholder") || "Choose…"}</option>
        <option
          :for={option <- @cs.options}
          value={option.value}
          selected={FormView.str(@value) == option.value}
        >
          {option.label}
        </option>
      </select>
    </div>
    <div :if={!@cs.message and @cs.status == "list"} class="bd-field__collection" data-status="ready">
      <div
        class="bd-field__collection-options"
        role={if @cs.multi, do: "group", else: "radiogroup"}
        id={@input_id}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
        aria-labelledby={@labelled_by}
      >
        <input :if={@cs.multi} type="hidden" name={@name <> "[]"} value="" />
        <label
          :for={{option, i} <- Enum.with_index(@cs.options)}
          class="bd-field__collection-option"
          data-selected={if option.value in @picked, do: "true"}
          for={"#{@input_id}-#{i}"}
        >
          <input
            type={if @cs.multi, do: "checkbox", else: "radio"}
            id={"#{@input_id}-#{i}"}
            name={if @cs.multi, do: @name <> "[]", else: @name}
            value={option.value}
            checked={option.value in @picked}
          /><span class="bd-field__collection-label">{option.label}</span>
        </label>
      </div>
    </div>
    """
  end

  defp control(%{field: %Field{type: "multi_populator"}} = assigns) do
    assigns = assign(assigns, r: FormView.repeater(assigns.field, assigns.value))

    ~H"""
    <div role="group" aria-labelledby={@labelled_by}>
      <div class="bd-repeater">
        <fieldset
          :for={row <- 0..(@r.count - 1)//1}
          class="bd-repeater__row"
          id={"entry-#{@v.form_id}-#{@key}-#{row}"}
        >
          <legend class="bd-repeater__legend">{@r.item} {row + 1}</legend>
          <.tree
            v={@v}
            fields={@field.children || []}
            prefix={"#{@key}.#{row}."}
            entries={FieldPath.entry(@path, row)}
            flat={true}
          />
          <button
            :if={@r.count > @r.least}
            class="bd-btn bd-btn--ghost bd-btn--sm bd-repeater__remove"
            type="button"
            phx-click="remove-row"
            phx-value-path={encode_path(@path)}
            phx-value-row={row}
          >
            Remove {Js.lower(@r.item)} {row + 1}
          </button>
        </fieldset>
        <button
          :if={@r.count < @r.most}
          class="bd-btn bd-btn--ghost bd-repeater__add"
          type="button"
          phx-click="add-row"
          phx-value-path={encode_path(@path)}
        >
          {@r.add}
        </button>
      </div>
    </div>
    """
  end

  defp control(%{field: %Field{type: "file_upload"}} = assigns) do
    list = Json.list(assigns.value) || []
    most = Kernel.trunc(Json.num(Field.config(assigns.field, "fileConfig", "maxFiles")) || 1.0)

    assigns =
      assign(assigns,
        list: list,
        most: most,
        remaining: max(most - length(list), 0),
        upload: assigns.v.uploads[FormView.upload_name(assigns.path)]
      )

    ~H"""
    <%!--
      A picked file uploads to this server at once and waits there until
      Submit sends it to BD, so an abandoned form never leaves a file on BD.
    --%>
    <div class="bd-file" role="group" id={@input_id} aria-labelledby={@labelled_by}>
      <%= if @remaining > 0 and @upload do %>
        <label class="bd-file__trigger" for={@upload.ref}>
          <span id={"#{@input_id}-text"}>{if @list == [], do: "Choose a file", else: "Add another"}{if @most >
                                                                                                         1,
                                                                                                       do:
                                                                                                         " (up to #{@remaining} more)",
                                                                                                       else:
                                                                                                         ""}</span>
          <span :if={Enum.any?(@upload.entries, &(!&1.done?))} class="bd-file__uploading"> · uploading…</span>
          <.live_file_input
            upload={@upload}
            class="bd-file__input"
            aria-describedby={@described_by}
            aria-invalid={@invalid}
            aria-labelledby={if @labelled_by, do: "#{@labelled_by} #{@input_id}-text"}
          />
        </label>
      <% else %>
        <p :if={@remaining == 0} class="bd-field__help">
          That's the most files this takes ({@most}).
        </p>
      <% end %>
      <ul :if={@list != []} class="bd-file__list">
        <li :for={{file, i} <- Enum.with_index(@list)} class="bd-file__item">
          <span class="bd-file__name">{Json.str(Json.get(file, "name")) || "file"}</span><span class="bd-file__size">{FormView.kilobytes(
            file
          )} KB{if Json.get(file, "pending") == true, do: " · sends with the form", else: ""}</span><button
            class="bd-file__remove"
            type="button"
            phx-click="remove-file"
            phx-value-path={encode_path(@path)}
            phx-value-index={i}
            aria-label={"Remove #{Json.str(Json.get(file, "name")) || "file"}"}
          >✕</button>
        </li>
      </ul>
    </div>
    """
  end

  defp control(assigns) do
    if FormView.unsupported?(assigns.field) do
      ~H"""
      <p class="bd-field__unsupported">
        {if @field.label == "", do: "This field", else: @field.label} can't be filled in on this page yet.
      </p>
      """
    else
      ~H"""
      <input
        class="bd-input"
        type="text"
        id={@input_id}
        name={@name}
        value={FormView.str(@value)}
        placeholder={Field.str(@field, "placeholder") || ""}
        autocomplete={FormView.autocomplete(@field)}
        aria-describedby={@described_by}
        aria-invalid={@invalid}
        phx-debounce="blur"
      />
      """
    end
  end

  # Two boxes side by side: a date range, a time block, an appointment.
  defp pair(assigns) do
    ~H"""
    <div class="bd-grid bd-grid--2" role="group" id={@input_id} aria-labelledby={@labelled_by}>
      <label :for={{part, label, type} <- @cells} class="bd-grid__cell">
        <span class="bd-grid__label">{label}</span><input
          class="bd-input"
          type={type}
          id={"#{@input_id}-#{part}"}
          name={FormView.input_name(@key, part)}
          value={FormView.part(@value, part)}
          phx-debounce="blur"
        />
      </label>
    </div>
    """
  end

  defp rows(n) when is_float(n), do: Kernel.trunc(n)
  defp rows(n) when is_integer(n), do: n
  defp rows(_), do: 4

  @doc "A field path for a `phx-value-path`: JSON `[field id, [[repeater, row], …]]`."
  def encode_path(%FieldPath{field_id: id, entries: entries}),
    do: Jason.encode!([id, Enum.map(entries, fn {r, i} -> [r, i] end)])

  @doc "A path back from the page, checked: nil when it isn't one."
  def decode_path(raw) when is_binary(raw) do
    with {:ok, [id, entries]} when is_binary(id) and is_list(entries) <- Jason.decode(raw),
         true <-
           Enum.all?(entries, &match?([r, i] when is_binary(r) and is_integer(i) and i >= 0, &1)) do
      FieldPath.new(id, Enum.map(entries, fn [r, i] -> {r, i} end))
    else
      _ -> nil
    end
  end

  def decode_path(_), do: nil
end
