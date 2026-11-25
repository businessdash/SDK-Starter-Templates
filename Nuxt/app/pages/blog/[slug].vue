<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * One post: its body (rebuilt from an allowlist on the server, see
 * `#shared/bd/blog`), likes and comments. Liking and commenting need a
 * signed-in customer; signed out, the buttons lead to sign-in and back.
 * The page is laid out from the blog's parts in `components/bd/blog/`.
 */
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import Comments from "~/components/bd/blog/Comments.vue";
import LikeButton from "~/components/bd/blog/LikeButton.vue";
import MembersOnly from "~/components/bd/blog/MembersOnly.vue";
import PostBody from "~/components/bd/blog/PostBody.vue";
import PostCta from "~/components/bd/blog/PostCta.vue";
import PostMeta from "~/components/bd/blog/PostMeta.vue";
import PostTags from "~/components/bd/blog/PostTags.vue";
import type { BlogPostResult } from "../../../server/api/bd/blog/post/[slug].get";

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const { data, refresh } = await useFetch<BlogPostResult>(
	() => `/api/bd/blog/post/${slug.value}`,
);
if (!data.value) {
	throw createError({ statusCode: 404, statusMessage: "Post not found", fatal: true });
}

const signInHref = computed(() => `/my-account?next=${encodeURIComponent(route.path)}`);
// Plain strings, so Nuxt doesn't try to match these against every route type.
const likeUrl = computed((): string => `/api/bd/blog/post/${slug.value}/like`);
const commentUrl = computed((): string => `/api/bd/blog/post/${slug.value}/comment`);

const url = useRequestURL();
useHead(() => {
	const post = data.value?.post;
	return {
		title: post?.title ?? "Post",
		meta: [
			...(post?.excerpt ? [{ name: "description", content: post.excerpt }] : []),
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: post?.title ?? "" },
			{ property: "og:url", content: url.origin + url.pathname },
			...(post?.imageUrl ? [{ property: "og:image", content: post.imageUrl }] : []),
		],
		link: [{ rel: "canonical", href: url.origin + url.pathname }],
	};
});
</script>

<template>
	<div>
		<BdHeader />
		<main v-if="data" class="bd-section bd-section--narrow">
			<article class="post">
				<NuxtLink class="post__back" to="/blog">← All posts</NuxtLink>
				<header class="post__head">
					<h1>{{ data.post.title }}</h1>
					<PostMeta :post="data.post" :minutes="data.minutes" />
				</header>

				<img
					v-if="data.post.imageUrl"
					class="post__cover"
					:src="data.post.imageUrl"
					alt=""
					referrerpolicy="no-referrer"
				/>

				<MembersOnly v-if="data.paywalled" :sign-in-href="signInHref" />
				<!-- Rebuilt from an allowlist on the server: see #shared/bd/blog. -->
				<PostBody v-else :html="data.html" />

				<PostCta :post="data.post" />
				<PostTags :tags="data.post.tags" />
				<LikeButton
					:likes="data.likes"
					:signed-in="data.signedIn"
					:sign-in-href="signInHref"
					:like-url="likeUrl"
				/>
			</article>

			<Comments
				:comments="data.comments"
				:signed-in="data.signedIn"
				:sign-in-href="signInHref"
				:comment-url="commentUrl"
				:refresh="refresh"
			/>
		</main>
		<BdFooter />
	</div>
</template>
