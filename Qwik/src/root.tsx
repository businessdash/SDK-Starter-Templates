import { component$, isDev } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { SdkSetupBanner } from "./components/bd/SdkSetupBanner";
import { RouterHead } from "./components/router-head/router-head";

import "./global.css";
// SDK form styles — file-upload box, multi-step progress header (steps + bar),
// and the availability/choice chips. Unstyled without this. The container
// background is intentionally transparent; the template owns it (`.bd-card`).
import "@businessdash/sdk/bd-forms.css";

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
      </head>
      <body lang="en">
        <RouterOutlet />
        <SdkSetupBanner />
      </body>
    </QwikCityProvider>
  );
});
