import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'post_page.dart';
import 'shop_parts.dart';

// The blog's parts. [BlogTab] and [PostPage] lay them out; each takes plain
// values and callbacks, so you can move, restyle, drop or replace any of
// them. The post's body is [PostBody] (post_body.dart).

/// The longest comment BD takes.
const postCommentMax = 5000;

/// All and a chip per category, then a chip per tag; choosing the chosen tag
/// again clears it.
class BlogFilters extends StatelessWidget {
  const BlogFilters({
    super.key,
    required this.categories,
    required this.tags,
    required this.categoryId,
    required this.tag,
    required this.onCategory,
    required this.onTag,
  });

  final List<BlogCategory> categories;
  final List<String> tags;
  final String? categoryId;
  final String? tag;
  final ValueChanged<String?> onCategory;
  final ValueChanged<String?> onTag;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (categories.isNotEmpty)
            ChipRow(
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: categoryId == null,
                  onSelected: (_) => onCategory(null),
                ),
                for (final category in categories)
                  ChoiceChip(
                    label: Text(category.name),
                    selected: categoryId == category.id,
                    onSelected: (_) => onCategory(category.id),
                  ),
              ],
            ),
          if (tags.isNotEmpty)
            ChipRow(
              children: [
                for (final each in tags)
                  FilterChip(
                    label: Text('#$each'),
                    selected: tag == each,
                    showCheckmark: false,
                    onSelected: (_) => onTag(tag == each ? null : each),
                  ),
              ],
            ),
        ],
      );
}

/// A row of chips that scrolls sideways when it's too wide.
class ChipRow extends StatelessWidget {
  const ChipRow({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(spacing: 8, children: children),
        ),
      );
}

/// A post in the list: cover, Pinned, title, excerpt, date and reading
/// time. Tapping it opens the post.
class PostCard extends StatelessWidget {
  const PostCard({super.key, required this.post});

  final BlogPost post;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PostPage(slug: post.slug))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 6,
          children: [
            if (post.imageUrl?.isNotEmpty ?? false)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(aspectRatio: 16 / 9, child: Photo(post.imageUrl)),
              ),
            if (post.isPinned)
              Text('Pinned', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary)),
            Text(post.title, style: theme.textTheme.titleMedium),
            if (post.excerpt?.isNotEmpty ?? false) Text(post.excerpt!, maxLines: 3, overflow: TextOverflow.ellipsis),
            Text('${PostHtml.date(post.publishedAt)} · ${PostHtml.readingMinutes(post.content)} min read', style: muted),
          ],
        ),
      ),
    );
  }
}

/// The author with their photo, the date and the reading time.
class PostMeta extends StatelessWidget {
  const PostMeta({super.key, required this.post});

  final BlogPost post;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    return Wrap(
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
    );
  }
}

/// The post's cover photo, 16:9.
class PostCover extends StatelessWidget {
  const PostCover({super.key, required this.url});

  final String url;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: AspectRatio(aspectRatio: 16 / 9, child: Photo(url)),
      );
}

/// A tinted, rounded panel: the members-only notice, the call to action.
class InfoBox extends StatelessWidget {
  const InfoBox({super.key, required this.children});

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

/// In place of a members' post for visitors: Sign in to read it.
class MembersOnly extends StatelessWidget {
  const MembersOnly({super.key, required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) => InfoBox(children: [
        Text('This post is for members.', style: Theme.of(context).textTheme.titleMedium),
        FilledButton(onPressed: onSignIn, child: const Text('Sign in to read it')),
      ]);
}

/// The post's call to action. Only web and mail links open; [linkFor] says
/// whether a post has one to show.
class PostCta extends StatelessWidget {
  const PostCta({super.key, required this.post, required this.onOpen});

  final BlogPost post;
  final ValueChanged<Uri> onOpen;

  /// The call to action's link when it's safe to open, else null (and
  /// nothing shows).
  static Uri? linkFor(BlogPost post) {
    if (post.ctaLabel?.isEmpty ?? true) return null;
    final href = post.ctaHref;
    final uri = href == null ? null : Uri.tryParse(href.trim());
    if (uri == null) return null;
    if ((uri.scheme == 'https' || uri.scheme == 'http') && uri.host.isNotEmpty) return uri;
    if (uri.scheme == 'mailto' && uri.path.isNotEmpty) return uri;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final link = linkFor(post);
    if (link == null) return const SizedBox.shrink();
    return InfoBox(children: [
      if (post.ctaDescription?.isNotEmpty ?? false) Text(post.ctaDescription!),
      FilledButton(onPressed: () => onOpen(link), child: Text(post.ctaLabel!)),
    ]);
  }
}

/// The post's tags, as "#gear  #running".
class PostTags extends StatelessWidget {
  const PostTags({super.key, required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(tags.map((tag) => '#$tag').join('  '), style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor));
  }
}

/// ♡ Like with the count. Signed out, Sign in to like.
class LikeButton extends StatelessWidget {
  const LikeButton({
    super.key,
    required this.signedIn,
    required this.liked,
    required this.count,
    this.liking = false,
    required this.onToggle,
    required this.onSignIn,
  });

  final bool signedIn;
  final bool liked;
  final int count;
  final bool liking;
  final VoidCallback onToggle;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      spacing: 12,
      children: [
        if (signedIn)
          OutlinedButton.icon(
            onPressed: liking ? null : onToggle,
            icon: Icon(liked ? Icons.favorite : Icons.favorite_border),
            label: Text(liked ? 'Liked' : 'Like'),
          )
        else
          OutlinedButton.icon(
            onPressed: onSignIn,
            icon: const Icon(Icons.favorite_border),
            label: const Text('Sign in to like'),
          ),
        Text('$count ${count == 1 ? 'like' : 'likes'}', style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
      ],
    );
  }
}

/// The comments and, signed in, a box to add one; signed out, Sign in to
/// comment.
class PostComments extends StatelessWidget {
  const PostComments({
    super.key,
    required this.comments,
    required this.signedIn,
    required this.draft,
    this.posting = false,
    this.note,
    this.noteOk = true,
    required this.onDraftChanged,
    required this.onPost,
    required this.onSignIn,
  });

  final List<BlogComment> comments;
  final bool signedIn;
  final TextEditingController draft;
  final bool posting;
  /// After posting: what happened, and whether it went well.
  final String? note;
  final bool noteOk;
  final ValueChanged<String> onDraftChanged;
  final VoidCallback onPost;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final note = this.note;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(comments.isNotEmpty ? 'Comments (${comments.length})' : 'Comments', style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        if (signedIn) ...[
          TextField(
            controller: draft,
            minLines: 2,
            maxLines: 6,
            maxLength: postCommentMax,
            onChanged: onDraftChanged,
            decoration: const InputDecoration(hintText: 'Add a comment', border: OutlineInputBorder()),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              onPressed: posting || draft.text.trim().isEmpty ? null : onPost,
              child: Text(posting ? 'Posting…' : 'Post comment'),
            ),
          ),
        ] else
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(onPressed: onSignIn, child: const Text('Sign in to comment')),
          ),
        if (note != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(note, style: TextStyle(color: noteOk ? Colors.green.shade700 : theme.colorScheme.error)),
          ),
        for (final comment in comments) CommentTile(comment: comment),
      ],
    );
  }
}

/// One comment: who and when, then what they said.
class CommentTile extends StatelessWidget {
  const CommentTile({super.key, required this.comment});

  final BlogComment comment;

  @override
  Widget build(BuildContext context) => Padding(
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
              style: Theme.of(context).textTheme.labelLarge,
            ),
            Text(comment.content),
          ],
        ),
      );
}
