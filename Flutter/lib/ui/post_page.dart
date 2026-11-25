import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'post_body.dart';
import 'shop_parts.dart';

/// The longest comment BD takes.
const _commentMax = 5000;

/// One post: its body drawn natively ([PostBody]), its call to action and
/// tags, likes, and comments. Liking and commenting are for the signed-in
/// customer; a members-only post asks them to sign in.
class PostPage extends StatefulWidget {
  const PostPage({super.key, required this.slug});

  final String slug;

  @override
  State<PostPage> createState() => _PostPageState();
}

class _PostPageState extends State<PostPage> {
  String? _loadedFor;
  BlogPostDetail? _detail;
  List<PostBlock> _blocks = const [];
  Object? _error;
  PostLikes? _likes;
  bool _liking = false;
  List<BlogComment> _comments = const [];
  final _draft = TextEditingController();
  bool _posting = false;
  ({String text, bool ok})? _note;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    final token = AppScope.of(context).sessionToken;
    // Signing in or out on the Account tab reloads it: signed in, a
    // members-only post comes with its body, and likes say whether this
    // customer liked it.
    final key = '${identityHashCode(client)}:$token';
    if (key == _loadedFor) return;
    _loadedFor = key;
    if (client != null) _load(client, token);
  }

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  Future<void> _load(BdClient client, String? token) async {
    final slug = widget.slug;
    client.postLikes(slug, sessionToken: token).then((likes) {
      if (mounted) setState(() => _likes = likes);
    }, onError: (Object _) {});
    _loadComments(client);
    try {
      final detail = await client.blogPost(slug, sessionToken: token);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _blocks = PostBlocks.from(detail.post.content);
        _error = null;
      });
    } on Exception catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _loadComments(BdClient client) async {
    try {
      final comments = await client.postComments(widget.slug);
      if (mounted) setState(() => _comments = comments);
    } on Exception {
      // The comments already shown stay.
    }
  }

  Future<void> _toggleLike(BdClient client, String token) async {
    setState(() => _liking = true);
    try {
      final likes = await client.togglePostLike(widget.slug, sessionToken: token);
      if (mounted) setState(() => _likes = likes);
    } on Exception {
      // The heart stays as it was.
    } finally {
      if (mounted) setState(() => _liking = false);
    }
  }

  Future<void> _postComment(BdClient client, String token) async {
    final content = _draft.text.trim();
    if (content.isEmpty) return;
    if (content.length > _commentMax) {
      setState(() => _note = (text: 'Comments are up to 5,000 characters.', ok: false));
      return;
    }
    setState(() {
      _posting = true;
      _note = null;
    });
    try {
      final posted = await client.postComment(widget.slug, content, sessionToken: token);
      _draft.clear();
      if (mounted) {
        setState(() => _note = (
              text: posted.isApproved ? 'Comment posted.' : "Thanks! Your comment shows once it's approved.",
              ok: true,
            ));
      }
      await _loadComments(client);
    } on Exception {
      if (mounted) setState(() => _note = (text: "Couldn't post your comment. Try again.", ok: false));
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  /// The call to action's link: web or mail only.
  static Uri? _safeCta(String? href) {
    final uri = href == null ? null : Uri.tryParse(href.trim());
    if (uri == null) return null;
    if ((uri.scheme == 'https' || uri.scheme == 'http') && uri.host.isNotEmpty) return uri;
    if (uri.scheme == 'mailto' && uri.path.isNotEmpty) return uri;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final client = BdScope.of(context).client;
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(title: Text(detail?.post.title ?? 'Blog')),
      body: switch ((client, detail, _error)) {
        (null, _, _) => const Center(child: Text("The blog isn't connected yet.")),
        (final client?, final detail?, _) => _post(context, client, detail),
        (_, null, final error?) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                error is BdHttpException && error.status == 404
                    ? 'This post is gone.'
                    : "The blog isn't available right now. Please check back soon.",
                textAlign: TextAlign.center,
              ),
            ),
          ),
        (_, null, null) => const Center(child: CircularProgressIndicator()),
      },
    );
  }

  Widget _post(BuildContext context, BdClient client, BlogPostDetail detail) {
    final theme = Theme.of(context);
    final app = AppScope.of(context);
    final token = app.sessionToken;
    final post = detail.post;
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    final cta = _safeCta(post.ctaHref);
    final likeCount = _likes?.count ?? post.likes;
    final liked = _likes?.liked ?? false;
    final note = _note;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Semantics(header: true, child: Text(post.title, style: theme.textTheme.headlineSmall)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (post.authorAvatarUrl?.isNotEmpty ?? false)
              CircleAvatar(
                radius: 12,
                backgroundImage: NetworkImage(post.authorAvatarUrl!),
                onBackgroundImageError: (_, _) {},
              ),
            if (post.authorName?.isNotEmpty ?? false) Text(post.authorName!, style: theme.textTheme.labelLarge),
            Text('${PostHtml.date(post.publishedAt)} · ${PostHtml.readingMinutes(post.content)} min read', style: muted),
          ],
        ),
        if (post.imageUrl?.isNotEmpty ?? false) ...[
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(aspectRatio: 16 / 9, child: Photo(post.imageUrl)),
          ),
        ],
        const SizedBox(height: 16),
        if (detail.isPaywalled)
          _Box(children: [
            Text('This post is for members.', style: theme.textTheme.titleMedium),
            FilledButton(
              onPressed: () => app.showTab(context, AppTab.account),
              child: const Text('Sign in to read it'),
            ),
          ])
        else
          PostBody(blocks: _blocks),
        if ((post.ctaLabel?.isNotEmpty ?? false) && cta != null) ...[
          const SizedBox(height: 16),
          _Box(children: [
            if (post.ctaDescription?.isNotEmpty ?? false) Text(post.ctaDescription!),
            FilledButton(
              onPressed: () => launchUrl(cta, mode: LaunchMode.externalApplication),
              child: Text(post.ctaLabel!),
            ),
          ]),
        ],
        if (post.tags.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(post.tags.map((tag) => '#$tag').join('  '), style: muted),
        ],
        const Divider(height: 40),
        Row(
          spacing: 12,
          children: [
            if (token != null)
              OutlinedButton.icon(
                onPressed: _liking ? null : () => _toggleLike(client, token),
                icon: Icon(liked ? Icons.favorite : Icons.favorite_border),
                label: Text(liked ? 'Liked' : 'Like'),
              )
            else
              OutlinedButton.icon(
                onPressed: () => app.showTab(context, AppTab.account),
                icon: const Icon(Icons.favorite_border),
                label: const Text('Sign in to like'),
              ),
            Text('$likeCount ${likeCount == 1 ? 'like' : 'likes'}', style: muted),
          ],
        ),
        const SizedBox(height: 24),
        Text(_comments.isNotEmpty ? 'Comments (${_comments.length})' : 'Comments', style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        if (token != null) ...[
          TextField(
            controller: _draft,
            minLines: 2,
            maxLines: 6,
            maxLength: _commentMax,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(hintText: 'Add a comment', border: OutlineInputBorder()),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              onPressed: _posting || _draft.text.trim().isEmpty ? null : () => _postComment(client, token),
              child: Text(_posting ? 'Posting…' : 'Post comment'),
            ),
          ),
        ] else
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: () => app.showTab(context, AppTab.account),
              child: const Text('Sign in to comment'),
            ),
          ),
        if (note != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(note.text, style: TextStyle(color: note.ok ? Colors.green.shade700 : theme.colorScheme.error)),
          ),
        for (final comment in _comments)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(
                  [
                    (comment.authorName?.isNotEmpty ?? false) ? comment.authorName! : 'Reader',
                    PostHtml.date(comment.createdAt),
                  ].where((part) => part.isNotEmpty).join(' · '),
                  style: theme.textTheme.labelLarge,
                ),
                Text(comment.content),
              ],
            ),
          ),
      ],
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: 10, children: children),
        ),
      );
}
