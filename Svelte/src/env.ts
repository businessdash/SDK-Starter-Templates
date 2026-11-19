import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Every variable is optional and read when the app starts (`static` defaults to
 * false). That is deliberate: the starter runs with no env at all and shows a
 * setup banner instead of failing, and one build can be deployed against
 * different BD sites. Add a validating `schema` to any variable your fork
 * cannot run without.
 */
export const variables = defineEnvVars({
	BD_API_KEY: { schema: (input) => input },
	BD_SITE_ID: { schema: (input) => input },
	BD_PACKAGE_API_BASE_URL: { schema: (input) => input },
	PUBLIC_BD_SITE_ID: { public: true, schema: (input) => input },
	PUBLIC_BD_PACKAGE_API_BASE_URL: { public: true, schema: (input) => input },
	NODE_ENV: { schema: (input) => input },
	BD_AUTH_CALLBACK_URL: { schema: (input) => input },
	BD_REVALIDATION_SECRET: { schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	PUBLIC_BD_PUBLIC_KEY: { public: true, schema: (input) => input },
	PUBLIC_BD_PK: { public: true, schema: (input) => input }
});
