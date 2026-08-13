import Leaf
import Vapor

public func configure(_ app: Application) async throws {
    app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory))
    app.views.use(.leaf)

    // Nil when BIAB isn't configured. That is a supported state, not an
    // error: every page falls back to local copy, so `swift run` on a fresh
    // clone serves a complete site with no credentials at all.
    app.biab = BiabClient.make(app: app)

    if app.biab == nil {
        app.logger.notice("BIAB is not configured — rendering local fallback content.")
    }

    try routes(app)
}
