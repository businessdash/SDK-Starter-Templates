import Vapor

/// `/forms/<slug>`: any form from your dashboard, on a page of its own.
/// GET draws it; POST is each change and button, from htmx (the form alone)
/// or a plain browser post (the whole page again).
enum FormRoutes {
    struct PageContext: Content {
        let configured: Bool
        let title: String
        let form: String
    }

    static func page(req: Request) async throws -> View {
        let slug = req.parameters.get("slug") ?? FormPage.sampleSlug
        let bd = req.bd
        let form = await FormPage.render(slug, bd: bd)
        return try await req.view.render("form", PageContext(configured: req.application.bdConfigured, title: "Form", form: form))
    }

    static func post(req: Request) async throws -> Response {
        let slug = req.parameters.get("slug") ?? FormPage.sampleSlug
        let post = try FormPost.read(req)
        let bd = req.bd
        let form = await FormPage.handle(slug, post: post, bd: bd)
        if req.headers.first(name: "HX-Request") == "true" { return htmlResponse(form) }
        return try await req.view.render("form", PageContext(configured: req.application.bdConfigured, title: "Form", form: form))
            .encodeResponse(for: req)
    }

    /// The form the home page's contact section shows: `BD_CONTACT_FORM`
    /// (default `general-inquiry`), or the sample until BD is connected.
    static var contactSlug: String {
        guard Environment.get("BD_SITE_ID") != nil, Environment.get("BD_API_KEY") != nil else { return FormPage.sampleSlug }
        return Environment.get("BD_CONTACT_FORM")?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "general-inquiry"
    }
}
