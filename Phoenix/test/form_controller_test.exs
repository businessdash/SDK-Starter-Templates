defmodule BdStarter.FormControllerTest do
  use ExUnit.Case, async: true

  alias BdStarter.Forms.{
    FieldPath,
    FormController,
    FormsError,
    Json,
    PickedFile,
    Rules,
    Schema,
    SubmitResult
  }

  defmodule MockBackend do
    @moduledoc "A backend that records what it was sent and answers from a script."
    @behaviour BdStarter.Forms.Backend

    alias BdStarter.Forms.{FormsError, Json, Schema, SubmitResult}

    defstruct [:fields, :settings, :agent]

    def new(fields, settings \\ %{}) do
      {:ok, agent} =
        Agent.start_link(fn ->
          %{
            submissions: [],
            uploads: [],
            fail_uploads: false,
            answer: {201, %{"submissionId" => "sub_1"}}
          }
        end)

      %__MODULE__{fields: fields, settings: settings, agent: agent}
    end

    def state(b), do: Agent.get(b.agent, & &1)
    def put(b, key, value), do: Agent.update(b.agent, &Map.put(&1, key, value))
    def last_data(b), do: (List.last(state(b).submissions) || %{data: %{}}).data

    @impl true
    def schema(b, _form) do
      Schema.from_json(
        Json.normalize(%{
          "id" => "form_1",
          "slug" => "contact",
          "name" => "Contact",
          "fields" => b.fields,
          "settings" => b.settings
        })
      )
    end

    @impl true
    def submit(b, _form, submission) do
      Agent.update(b.agent, &Map.update!(&1, :submissions, fn s -> s ++ [submission] end))
      {status, body} = state(b).answer

      if status in 200..299,
        do: SubmitResult.success(status, body["submissionId"]),
        else: SubmitResult.from_response(status, Json.normalize(body))
    end

    @impl true
    def upload(b, _form, _field_id, file) do
      if state(b).fail_uploads, do: raise(FormsError, message: "Upload failed.", status: 500)
      Agent.update(b.agent, &Map.update!(&1, :uploads, fn u -> u ++ [file.name] end))

      %{
        "storageId" => "s/#{file.name}",
        "url" => "https://cdn.example.com/#{file.name}",
        "name" => file.name,
        "mimeType" => file.mime_type,
        "size" => file.size * 1.0
      }
    end

    @impl true
    def collection_options(_b, _form, _field_id) do
      [
        %{value: "r1", label: "Gold", image: nil, match: %{"tier" => "premium"}},
        %{value: "r2", label: "Basic", image: nil, match: %{"tier" => "standard"}}
      ]
    end
  end

  defp controller(b), do: FormController.new(MockBackend.schema(b, "contact"), b)

  defp file(name, type, size \\ 10),
    do: %PickedFile{name: name, mime_type: type, size: size, path: "/dev/null"}

  defp set(c, id, value),
    do: FormController.set_value(c, Json.normalize(value), FieldPath.new(id))

  test "loads and submits with output keys" do
    b =
      MockBackend.new([
        %{
          "id" => "f1",
          "type" => "text",
          "label" => "Your name",
          "required" => true,
          "key" => "full_name"
        },
        %{"id" => "f2", "type" => "email", "label" => "Email", "required" => true},
        %{"id" => "t", "type" => "title", "label" => "Hello"}
      ])

    c = b |> controller() |> set("f1", "Ada") |> set("f2", "ada@example.com")
    {r, c} = FormController.submit(c)
    assert r.ok
    assert FormController.submitted?(c)
    assert MockBackend.last_data(b)["full_name"] == "Ada"
    assert MockBackend.last_data(b)["f2"] == "ada@example.com"
    refute Map.has_key?(MockBackend.last_data(b), "t")
    assert hd(MockBackend.state(b).submissions).source == "phoenix-starter"
  end

  test "required and format errors block submit" do
    b =
      MockBackend.new([
        %{"id" => "name", "type" => "text", "label" => "Name", "required" => true},
        %{"id" => "email", "type" => "email", "label" => "Email"}
      ])

    {r, c} = b |> controller() |> set("email", "not-an-email") |> FormController.submit()
    refute r.ok
    assert r.reason == "client_validation_failed"
    assert c.errors["name"] == "Name is required."
    assert c.errors["email"] == "Enter a valid email address."
    assert MockBackend.state(b).submissions == []
  end

  test "blur shows format but not required until attempted" do
    c =
      controller(
        MockBackend.new([
          %{"id" => "email", "type" => "email", "label" => "Email", "required" => true}
        ])
      )

    c = FormController.validate(c, FieldPath.new("email"))
    refute Map.has_key?(c.errors, "email"), "an untouched required field stays quiet on blur"
    c = c |> set("email", "bad") |> FormController.validate(FieldPath.new("email"))
    assert c.errors["email"] == "Enter a valid email address."
    c = set(c, "email", "good@example.com")
    refute Map.has_key?(c.errors, "email"), "fixing the value clears the error"
  end

  test "business email rule" do
    c =
      controller(
        MockBackend.new([
          %{
            "id" => "email",
            "type" => "email",
            "label" => "Work email",
            "emailConfig" => %{"businessOnly" => true}
          }
        ])
      )

    c = c |> set("email", "someone@gmail.com") |> FormController.validate(FieldPath.new("email"))
    assert c.errors["email"] == "Please use your work email address."
  end

  test "stepped form validates each step and follows conditions" do
    b =
      MockBackend.new(
        [
          %{
            "id" => "kind",
            "type" => "radio",
            "label" => "Kind",
            "required" => true,
            "options" => ["Home", "Business"]
          },
          %{
            "id" => "biz",
            "type" => "condition_block",
            "label" => "",
            "conditionRule" => %{"fieldId" => "kind", "operator" => "eq", "value" => "Business"},
            "children" => [
              %{"id" => "company", "type" => "text", "label" => "Company", "required" => true}
            ]
          },
          %{"id" => "notes", "type" => "textarea", "label" => "Notes"}
        ],
        %{"isConsecutive" => true}
      )

    c = controller(b)
    assert FormController.step_count(c) == 2, "the business page is hidden until chosen"
    {false, c} = FormController.next(c)
    assert c.errors["kind"] == "Kind is required."
    c = set(c, "kind", "Business")
    assert FormController.step_count(c) == 3
    {true, c} = FormController.next(c)
    assert FormController.current_step(c) == 1
    {false, c} = FormController.next(c)
    assert c.errors["company"] == "Company is required."
    c = FormController.back(c)
    assert c.errors == %{}
    c = set(c, "kind", "Home")
    assert FormController.step_count(c) == 2
    {r, _} = FormController.submit(c)
    assert r.ok, "a hidden required field doesn't block"
  end

  test "repeater errors land on the entry field" do
    b =
      MockBackend.new([
        %{
          "id" => "kids",
          "type" => "multi_populator",
          "label" => "Children",
          "populatorConfig" => %{"maxInstances" => 3},
          "children" => [
            %{"id" => "kname", "type" => "text", "label" => "Name", "required" => true},
            %{
              "id" => "kage",
              "type" => "number",
              "label" => "Age",
              "validation" => %{"min" => 0, "max" => 17}
            }
          ]
        }
      ])

    kids = FieldPath.new("kids")

    c =
      b
      |> controller()
      |> FormController.set_value("Sam", FieldPath.new("kname", FieldPath.entry(kids, 0)))
      |> FormController.add_entry(kids)
      |> FormController.set_value(30.0, FieldPath.new("kage", FieldPath.entry(kids, 1)))

    {_, c} = FormController.submit(c)
    assert c.errors["kids[1].kname"] == "Name is required."
    assert c.errors["kids[1].kage"] == "Enter 17 or less."
    c = FormController.remove_entry(c, 1, kids)
    assert length(FormController.entries(c, kids)) == 1
    {r, _} = FormController.submit(c)
    assert r.ok
    assert Json.encode!(MockBackend.last_data(b)["kids"]) == ~s([{"kname":"Sam"}])
  end

  test "calculations recompute on edit" do
    c =
      controller(
        MockBackend.new([
          %{"id" => "qty", "type" => "number", "label" => "Qty"},
          %{"id" => "price", "type" => "currency", "label" => "Price"},
          %{
            "id" => "total",
            "type" => "calculation",
            "label" => "Total",
            "calculationConfig" => %{
              "formula" => "q * p",
              "inputMap" => [
                %{"variable" => "q", "fieldId" => "qty"},
                %{"variable" => "p", "fieldId" => "price"}
              ]
            }
          }
        ])
      )

    c = c |> set("qty", 3) |> set("price", 2.5)
    assert c.values["total"] === 7.5
    c = set(c, "qty", nil)
    assert c.values["total"] == nil, "a missing input leaves the result empty"
  end

  test "files upload on submit and swap placeholders" do
    b =
      MockBackend.new([
        %{
          "id" => "docs",
          "type" => "file_upload",
          "label" => "Docs",
          "fileConfig" => %{"maxFiles" => 2, "allowedTypes" => ["application/pdf"]}
        }
      ])

    {taken, c} =
      FormController.add_files(
        controller(b),
        [{"p1", file("a.pdf", "application/pdf")}, {"p2", file("b.png", "image/png")}],
        FieldPath.new("docs")
      )

    assert taken == ["p1"]
    assert length(c.values["docs"]) == 1, "the png isn't an allowed type"
    assert c.errors["docs"] == "File type not allowed: image/png"
    {r, _} = FormController.submit(c)
    assert r.ok
    assert MockBackend.state(b).uploads == ["a.pdf"]
    assert hd(MockBackend.last_data(b)["docs"])["url"] == "https://cdn.example.com/a.pdf"
  end

  test "failed upload keeps the form open" do
    b = MockBackend.new([%{"id" => "docs", "type" => "file_upload", "label" => "Docs"}])
    MockBackend.put(b, :fail_uploads, true)

    {_, c} =
      FormController.add_files(
        controller(b),
        [{"x", file("x.txt", "text/plain", 1)}],
        FieldPath.new("docs")
      )

    {r, c} = FormController.submit(c)
    refute r.ok
    assert r.reason == "network_error"
    assert c.errors["docs"] == "Upload failed."
    assert MockBackend.state(b).submissions == []
    assert Rules.pending_upload?(hd(c.values["docs"])), "the file is still there to retry"
  end

  test "server issues map back to fields" do
    b = MockBackend.new([%{"id" => "f1", "type" => "text", "label" => "Code", "key" => "promo"}])

    MockBackend.put(
      b,
      :answer,
      {422,
       %{
         "error" => "validation_failed",
         "message" => "Bad",
         "issues" => [%{"id" => "promo", "label" => "Code", "reason" => "regex"}]
       }}
    )

    {r, c} = b |> controller() |> set("f1", "x") |> FormController.submit()
    assert r.reason == "validation_failed"
    assert c.errors["f1"] == "Code isn't in the expected format."
  end

  test "status codes map like the JS SDK" do
    reason = fn status, body -> SubmitResult.from_response(status, body).reason end
    assert reason.(401, %{}) == "unauthorized"
    assert reason.(403, %{}) == "forbidden"
    assert reason.(402, %{}) == "plan_required"
    assert reason.(402, %{"reason" => "payment_required"}) == "payment_required"
    assert reason.(402, %{"reason" => "service_suspended"}) == "service_suspended"
    assert reason.(429, %{}) == "rate_limited"
    assert reason.(404, %{}) == "not_found"
    assert reason.(400, %{}) == "invalid_request"
    assert reason.(400, %{"error" => "validation_failed"}) == "validation_failed"
    assert reason.(500, %{}) == "server_error"
  end

  test "collection match conditions" do
    c =
      controller(
        MockBackend.new([
          %{"id" => "plan", "type" => "collection_select", "label" => "Plan"},
          %{
            "id" => "vip",
            "type" => "condition_block",
            "label" => "",
            "conditionRule" => %{
              "fieldId" => "plan",
              "operator" => "eq",
              "value" => "premium",
              "matchField" => "tier"
            },
            "children" => [
              %{"id" => "concierge", "type" => "text", "label" => "Concierge", "required" => true}
            ]
          }
        ])
      )

    c = set(c, "plan", "r2")
    refute FormController.visible?(c, FormController.field(c, "vip"))
    c = set(c, "plan", "r1")
    assert FormController.visible?(c, FormController.field(c, "vip"))
    {r, c} = FormController.submit(c)
    refute r.ok
    assert Map.has_key?(c.errors, "concierge")
  end

  test "date range order" do
    c =
      controller(MockBackend.new([%{"id" => "trip", "type" => "date_range", "label" => "Trip"}]))

    c =
      c
      |> set("trip", %{"start" => "2026-12-10", "end" => "2026-12-01"})
      |> FormController.validate(FieldPath.new("trip"))

    assert c.errors["trip"] == "The end must come after the start."
  end

  test "custom messages" do
    c =
      controller(
        MockBackend.new([%{"id" => "n", "type" => "text", "label" => "Nom", "required" => true}])
      )

    c = %{
      c
      | messages: fn reason, label, _ ->
          if reason == "required", do: "#{label} est obligatoire.", else: reason
        end
    }

    {_, c} = FormController.submit(c)
    assert c.errors["n"] == "Nom est obligatoire."
  end

  test "seed applies defaults" do
    c =
      controller(
        MockBackend.new([
          %{"id" => "n", "type" => "text", "label" => "N", "defaultValue" => "hi"}
        ])
      )

    assert c.values["n"] == "hi"
  end

  test "an error type is raised as FormsError" do
    assert_raise FormsError, fn -> raise FormsError, message: "x" end
  end
end
