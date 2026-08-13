import Vapor

/// Same-origin proxy for the `<biab-form>` web component.
///
/// The component renders the full schema client-side — conditional blocks,
/// availability pickers, uploads — which a hand-written Leaf fragment can't
/// match. It needs to reach the API, but the bearer key must not go to the
/// browser. So the browser talks to THIS route, and this route talks to BIAB.
///
/// That is the whole reason a Vapor consumer never reimplements the form
/// renderer.
enum BiabFormController {
    static func schema(req: Request) async throws -> Response {
        guard let biab = req.biab, let slug = req.parameters.get("slug") else {
            throw Abort(.serviceUnavailable, reason: "not_configured")
        }

        guard let schema = try? await biab.formSchema(slug: slug) else {
            throw Abort(.badGateway, reason: "form_unavailable")
        }

        return try await schema.encodeResponse(for: req)
    }

    static func submit(req: Request) async throws -> Response {
        guard let biab = req.biab, let slug = req.parameters.get("slug") else {
            throw Abort(.serviceUnavailable, reason: "not_configured")
        }

        struct Body: Content {
            let data: [String: String]
            let submitterEmail: String?
        }

        let body = try req.content.decode(Body.self)
        let input = FormSubmitInput(
            data: body.data,
            submitterEmail: body.submitterEmail,
            source: "vapor-starter"
        )

        guard let result = try? await biab.submitForm(slug: slug, input: input) else {
            throw Abort(.badGateway, reason: "transport_error")
        }

        return try await result.encodeResponse(for: req)
    }
}
