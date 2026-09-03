# BusinessDash SDK — Kotlin

Official Kotlin/JVM client for the BusinessDash Package API.

```kotlin
implementation("us.businessdash:sdk:0.9.81")
```

Pure Kotlin/JVM — no Android dependency, so it builds and tests without the
Android SDK and stays usable from a server or a Kotlin Multiplatform target.

```kotlin
val client = BdClient(baseUrl = BASE_URL, apiKey = API_KEY)

val products = client.products(limit = 20)
val portal = client.portal(sessionToken, organizationId = orgId)
val booking = client.scheduling(siteId).eventTypes()
```

See <https://businessdash.us/docs> for the full surface.

## Publishing

Requires `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_PASSWORD`, `SIGNING_KEY` and
`SIGNING_PASSWORD` in the environment. Without them the module still builds and
tests — signing is only needed to publish, and needing a GPG key to compile
would make this hostile to anyone cloning the starter.

```sh
./gradlew :bd:publishAllPublicationsToCentralPortalRepository
```
