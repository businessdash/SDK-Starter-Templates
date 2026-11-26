import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'blog_parts.dart';
import 'post_body.dart';

/// One post: its body drawn natively ([PostBody]), its call to action and
/// tags, likes, and comments. Liking and commenting are for the signed-in
/// customer; a members-only post asks them to sign in.
///
/// It's laid out from the parts in blog_parts.dart: [PostMeta], [PostCover],
/// [PostBody] or [MembersOnly], [PostCta], [PostTags], [LikeButton] and
/// [PostComments].
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
      final likes =
          await client.togglePostLike(widget.slug, sessionToken: token);
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
    if (content.length > postCommentMax) {
      setState(() =>
          _note = (text: 'Comments are up to 5,000 characters.', ok: false));
      return;
    }
    setState(() {
      _posting = true;
      _note = null;
    });
    try {
      final posted =
          await client.postComment(widget.slug, content, sessionToken: token);
      _draft.clear();
      if (mounted) {
        setState(() => _note = (
              text: posted.isApproved
                  ? 'Comment posted.'
                  : "Thanks! Your comment shows once it's approved.",
              ok: true,
            ));
      }
      await _loadComments(client);
    } on Exception {
      if (mounted) {
        setState(() => _note =
            (text: "Couldn't post your comment. Try again.", ok: false));
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  /// The call to action's link: web or mail only.
  @override
  Widget build(BuildContext context) {
    final client = BdScope.of(context).client;
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(title: Text(detail?.post.title ?? 'Blog')),
      body: switch ((client, detail, _error)) {
        (null, _, _) =>
          const Center(child: Text("The blog isn't connected yet.")),
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
    final note = _note;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Semantics(
            header: true,
            child: Text(post.title, style: theme.textTheme.headlineSmall)),
        const SizedBox(height: 8),
        PostMeta(post: post),
        if (post.imageUrl?.isNotEmpty ?? false) ...[
          const SizedBox(height: 16),
          PostCover(url: post.imageUrl!),
        ],
        const SizedBox(height: 16),
        if (detail.isPaywalled)
          MembersOnly(onSignIn: () => app.showTab(context, AppTab.account))
        else
          PostBody(blocks: _blocks),
        if (PostCta.linkFor(post) != null) ...[
          const SizedBox(height: 16),
          PostCta(
              post: post,
              onOpen: (link) =>
                  launchUrl(link, mode: LaunchMode.externalApplication)),
        ],
        if (post.tags.isNotEmpty) ...[
          const SizedBox(height: 16),
          PostTags(tags: post.tags),
        ],
        const Divider(height: 40),
        LikeButton(
          signedIn: token != null,
          liked: _likes?.liked ?? false,
          count: _likes?.count ?? post.likes,
          liking: _liking,
          onToggle: () => _toggleLike(client, token!),
          onSignIn: () => app.showTab(context, AppTab.account),
        ),
        const SizedBox(height: 24),
        PostComments(
          comments: _comments,
          signedIn: token != null,
          draft: _draft,
          posting: _posting,
          note: note?.text,
          noteOk: note?.ok ?? true,
          onDraftChanged: (_) => setState(() {}),
          onPost: () => _postComment(client, token!),
          onSignIn: () => app.showTab(context, AppTab.account),
        ),
      ],
    );
  }
}
