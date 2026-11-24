import Vapor

/// BusinessDash quizzes, rendered here (`QuizPage`): a practice quiz or the
/// sample at /quiz, an invitation at /quiz-invite/<token> (the link BD's
/// invite emails carry when this site is the quiz's invite domain), and the
/// running clock each page re-reads.
enum QuizRoutes {
    struct PageContext: Content {
        let configured: Bool
        let title: String
        let quiz: String
    }

    /// `/quiz`: `BD_QUIZ` once BD is connected, else the sample.
    static var defaultSource: QuizPage.Source {
        guard Environment.get("BD_SITE_ID") != nil, Environment.get("BD_API_KEY") != nil,
              let slug = Environment.get("BD_QUIZ")?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        else { return .sample }
        return .practice(slug)
    }

    private static func source(_ req: Request) -> QuizPage.Source {
        // Route parameters arrive percent-decoded.
        if let token = req.parameters.get("token") { return .invitation(token) }
        guard let slug = req.parameters.get("slug") else { return defaultSource }
        return slug == QuizPage.sampleSlug ? .sample : .practice(slug)
    }

    private static func visitor(_ req: Request, _ source: QuizPage.Source) -> QuizPage.Visitor {
        QuizPage.Visitor(
            session: req.cookies[AccountController.sessionCookie]?.string.nilIfEmpty,
            signInHref: "\(SignInController.path)?next=\(source.path.uriComponent)",
            switchAccountHref: "/api/bd-auth/sign-out"
        )
    }

    static func page(req: Request) async throws -> Response {
        let source = source(req)
        let result = await QuizPage.page(source, visitor: visitor(req, source), runCookie: req.cookies[QuizPage.runCookie]?.string, bd: req.bd)
        return try await respond(req, result, fragment: false)
    }

    static func post(req: Request) async throws -> Response {
        let source = source(req)
        let post = try FormPost.read(req)
        let result = await QuizPage.handle(source, post: post, visitor: visitor(req, source), bd: req.bd)
        return try await respond(req, result, fragment: req.headers.first(name: "HX-Request") == "true")
    }

    /// `/quiz-timer/<run>`. Status 286 tells htmx to stop asking: the run is gone.
    static func timer(req: Request) async throws -> Response {
        guard let id = req.parameters.get("run"), let answer = await QuizPage.timer(id) else {
            return Response(status: .custom(code: 286, reasonPhrase: "Stop Polling"))
        }
        guard answer.wholeQuiz else { return htmlResponse(answer.body) }
        // Time's up: the whole quiz (sending, then the results) in place of the page's.
        return htmlResponse(answer.body, headers: [
            ("HX-Retarget", "#bd-quiz-\(answer.runId)"),
            ("HX-Reswap", "morph:{ignoreActiveValue:true}"),
        ])
    }

    private static func respond(_ req: Request, _ result: QuizPage.Result, fragment: Bool) async throws -> Response {
        let response = fragment
            ? htmlResponse(result.body)
            : try await req.view.render("quiz", PageContext(configured: req.application.bdConfigured, title: result.title, quiz: result.body))
                .encodeResponse(for: req)
        response.headers.replaceOrAdd(name: .cacheControl, value: "no-store")
        if let id = result.runCookie {
            // Brings a reload back to the same run.
            response.cookies[QuizPage.runCookie] = HTTPCookies.Value(
                string: id, maxAge: QuizPage.runSeconds, path: "/", isHTTPOnly: true, sameSite: .lax
            )
        }
        return response
    }
}
