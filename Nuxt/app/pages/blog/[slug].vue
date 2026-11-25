<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * One post: its body (rebuilt from an allowlist on the server, see
 * `#shared/bd/blog`), likes and comments. Liking and commenting need a
 * signed-in customer; signed out, the buttons lead to sign-in and back.
 */
import { computed, ref, watch } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import { formatPostDate } from "#shared/bd/blog";
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
// Its own ref: `useFetch` data is shallow, so changing a field inside it
// wouldn't update the page.
const likes = ref(data.value.likes);
watch(
	() => data.value?.likes,
	(next) => {
		if (next) likes.value = next;
	},
);
const likeError = ref("");
const draft = ref("");
const commentNote = ref<{ kind: "ok" | "error"; text: string } | null>(null);
const posting = ref(false);

function failure(err: unknown, fallback: string): string {
	const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage;
	return message || fallback;
}

// Plain strings, so Nuxt doesn't try to match these against every route type.
const likeUrl = computed((): string => `/api/bd/blog/post/${slug.value}/like`);
const commentUrl = computed((): string => `/api/bd/blog/post/${slug.value}/comment`);

async function toggleLike() {
	if (!data.value) return;
	likeError.value = "";
	try {
		likes.value = await $fetch<{ liked: boolean; likesCount: number }>(likeUrl.value, {
			method: "POST",
		});
	} catch (err) {
		likeError.value = failure(err, "Couldn't save your like. Try again.");
	}
}

async function postComment() {
	const content = draft.value.trim();
	if (!content) return;
	posting.value = true;
	commentNote.value = null;
	try {
		const res = await $fetch<{ approved: boolean }>(commentUrl.value, {
			method: "POST",
			body: { content },
		});
		draft.value = "";
		commentNote.value = {
			kind: "ok",
			text: res.approved ? "Comment posted." : "Thanks! Your comment shows once it's approved.",
		};
		await refresh();
	} catch (err) {
		commentNote.value = { kind: "error", text: failure(err, "Couldn't post your comment. Try again.") };
	} finally {
		posting.value = false;
	}
}

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
					<p class="post__meta">
						<img
							v-if="data.post.authorAvatarUrl"
							:src="data.post.authorAvatarUrl"
							alt=""
							referrerpolicy="no-referrer"
						/>
						<span v-if="data.post.authorName">{{ data.post.authorName }}</span>
						<span>{{ formatPostDate(data.post.publishedAt) }}</span>
						<span>· {{ data.minutes }} min read</span>
					</p>
				</header>

				<img
					v-if="data.post.imageUrl"
					class="post__cover"
					:src="data.post.imageUrl"
					alt=""
					referrerpolicy="no-referrer"
				/>

				<div v-if="data.paywalled" class="bd-empty">
					This post is for members.
					<p><NuxtLink class="bd-btn" :to="signInHref">Sign in to read it</NuxtLink></p>
				</div>
				<!-- Rebuilt from an allowlist on the server: see #shared/bd/blog. -->
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-else class="post__body" v-html="data.html" />

				<aside v-if="data.post.ctaHref && data.post.ctaLabel" class="bd-card post__cta">
					<p v-if="data.post.ctaDescription">{{ data.post.ctaDescription }}</p>
					<a class="bd-btn" :href="data.post.ctaHref">{{ data.post.ctaLabel }}</a>
				</aside>

				<ul v-if="data.post.tags.length > 0" class="post__tags">
					<li v-for="tag in data.post.tags" :key="tag">
						<NuxtLink :to="{ path: '/blog', query: { tag } }">#{{ tag }}</NuxtLink>
					</li>
				</ul>

				<div class="post__like">
					<button
						v-if="data.signedIn"
						type="button"
						class="like"
						:class="{ 'like--on': likes.liked }"
						:aria-pressed="likes.liked"
						@click="toggleLike"
					>
						<span aria-hidden="true">{{ likes.liked ? "♥" : "♡" }}</span>
						{{ likes.liked ? "Liked" : "Like" }}
					</button>
					<NuxtLink v-else class="like" :to="signInHref">
						<span aria-hidden="true">♡</span> Sign in to like
					</NuxtLink>
					<span class="post__likes">
						{{ likes.likesCount }} {{ likes.likesCount === 1 ? "like" : "likes" }}
					</span>
					<span v-if="likeError" class="post__error" role="alert">{{ likeError }}</span>
				</div>
			</article>

			<section class="comments" aria-labelledby="comments-title">
				<h2 id="comments-title">
					{{ data.comments.length }} {{ data.comments.length === 1 ? "comment" : "comments" }}
				</h2>

				<form v-if="data.signedIn" class="comments__form" @submit.prevent="postComment">
					<label class="bd-label" for="comment">Add a comment</label>
					<textarea
						id="comment"
						v-model="draft"
						name="content"
						class="bd-textarea"
						rows="4"
						maxlength="5000"
						required
					/>
					<button class="bd-btn" type="submit" :disabled="posting">
						{{ posting ? "Posting…" : "Post comment" }}
					</button>
					<p
						v-if="commentNote"
						:class="commentNote.kind === 'ok' ? 'comments__ok' : 'post__error'"
						:role="commentNote.kind === 'ok' ? 'status' : 'alert'"
					>
						{{ commentNote.text }}
					</p>
				</form>
				<p v-else class="comments__signin">
					<NuxtLink class="bd-btn bd-btn--ghost" :to="signInHref">Sign in to comment</NuxtLink>
				</p>

				<ol v-if="data.comments.length > 0" class="comments__list">
					<li
						v-for="comment in data.comments"
						:key="comment.id"
						class="comment"
						:class="{ 'comment--reply': comment.parentId !== null }"
					>
						<p class="comment__head">
							<strong>{{ comment.authorName ?? "Reader" }}</strong>
							<span>{{ formatPostDate(comment.createdAt) }}</span>
						</p>
						<p class="comment__body">{{ comment.content }}</p>
					</li>
				</ol>
			</section>
		</main>
		<BdFooter />
	</div>
</template>
