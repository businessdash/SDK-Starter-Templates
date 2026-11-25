import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';

// The reviews' parts. [ReviewsPage] lays them out; you can move, restyle,
// drop or replace any of them. The store's rating strip is [ReviewStrip]
// (shop_parts.dart).

/// All, then a chip per platform (Google, Yelp…).
class ReviewSourceFilter extends StatelessWidget {
  const ReviewSourceFilter({super.key, required this.sources, required this.selected, required this.onSelect});

  final List<String> sources;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          spacing: 8,
          children: [
            ChoiceChip(
              label: const Text('All'),
              selected: selected == null,
              onSelected: (_) => onSelect(null),
            ),
            for (final source in sources)
              ChoiceChip(
                label: Text(Reviews.sourceLabel(source)),
                selected: selected == source,
                onSelected: (_) => onSelect(source),
              ),
          ],
        ),
      );
}

/// The average with its stars and the number of reviews, a bar per star,
/// and [ReviewWriter].
class ReviewSummaryCard extends StatelessWidget {
  const ReviewSummaryCard({super.key, required this.summary});

  final ReviewSummary summary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final average = summary.average;
    return Card.outlined(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 12,
          children: [
            if (average != null)
              Row(
                spacing: 12,
                children: [
                  Text(average.toStringAsFixed(1), style: theme.textTheme.displaySmall),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      StarRating(average, size: 18),
                      Text('${summary.total} ${summary.total == 1 ? 'review' : 'reviews'}', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
            if (summary.histogram.any((row) => row.count > 0))
              Column(
                spacing: 6,
                children: [
                  for (final row in summary.histogram)
                    Semantics(
                      label: '${row.stars} ${row.stars == 1 ? 'star' : 'stars'}: ${row.count}',
                      excludeSemantics: true,
                      child: Row(
                        spacing: 8,
                        children: [
                          SizedBox(width: 32, child: Text('${row.stars} ★', style: theme.textTheme.bodySmall)),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(value: row.share, minHeight: 8),
                            ),
                          ),
                          SizedBox(
                            width: 28,
                            child: Text('${row.count}', textAlign: TextAlign.end, style: theme.textTheme.bodySmall),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            const ReviewWriter(),
          ],
        ),
      ),
    );
  }
}

/// One review: photo or initial, name, stars, date, the words, the
/// reviewer's photos, where it came from and a link to it there.
class ReviewCard extends StatelessWidget {
  const ReviewCard({super.key, required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    final platform = Reviews.platformName(review.source);
    final link = Reviews.link(review);
    final avatar = Reviews.safeWebUrl(review.reviewerImageUrl);
    final photos = review.photos.map(Reviews.safeWebUrl).whereType<String>().toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          Row(
            spacing: 10,
            children: [
              CircleAvatar(
                radius: 18,
                foregroundImage: avatar == null ? null : NetworkImage(avatar),
                // A photo that won't load leaves the initial showing.
                onForegroundImageError: avatar == null ? null : (_, _) {},
                child: Text(Reviews.reviewerInitial(review)),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(Reviews.reviewerName(review), style: theme.textTheme.titleSmall),
                    Text(
                      [Reviews.date(review.timeCreated), ?platform].where((part) => part.isNotEmpty).join(' · '),
                      style: muted,
                    ),
                  ],
                ),
              ),
              if (review.verified ?? false)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 2,
                  children: [
                    Icon(Icons.verified, size: 14, color: theme.colorScheme.primary),
                    Text('Verified', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary)),
                  ],
                ),
            ],
          ),
          StarRating(review.rating),
          if (review.text?.trim().isNotEmpty ?? false) Text(review.text!.trim()),
          if (photos.isNotEmpty)
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, index) => ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox.square(dimension: 84, child: Photo(photos[index], label: 'Photo from the reviewer')),
                ),
              ),
            ),
          if (link != null && platform != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                onPressed: () => launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication),
                child: Text('Read on $platform'),
              ),
            ),
        ],
      ),
    );
  }
}

/// "Write a review": stars, an optional title and the review, sent through
/// the customer portal as the signed-in customer. The business approves it
/// before it shows.
class ReviewWriter extends StatefulWidget {
  const ReviewWriter({super.key});

  @override
  State<ReviewWriter> createState() => _ReviewWriterState();
}

class _ReviewWriterState extends State<ReviewWriter> {
  bool _open = false;
  int _rating = 0;
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _sending = false;
  String? _problem;
  bool _sent = false;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _send(BdClient client, AppState app) async {
    final token = app.sessionToken;
    if (token == null) return;
    final check = Reviews.check(rating: _rating, title: _title.text, body: _body.text);
    final review = check.review;
    if (review == null) {
      setState(() => _problem = check.error);
      return;
    }
    setState(() {
      _sending = true;
      _problem = null;
    });
    try {
      await client.portal(token, organizationId: app.organizationId).submitReview(review);
      if (mounted) {
        setState(() {
          _sent = true;
          _open = false;
        });
      }
    } on Exception catch (error) {
      if (mounted) setState(() => _problem = bdProblem(error, "Couldn't send your review. Try again."));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final app = AppScope.of(context);
    final client = BdScope.of(context).client;
    if (_sent) return Text(Reviews.sent, style: TextStyle(color: Colors.green.shade700));
    if (!app.signedIn || client == null) {
      return OutlinedButton(
        onPressed: () => app.showTab(context, AppTab.account),
        child: const Text('Sign in to write a review'),
      );
    }
    if (!_open) {
      return FilledButton(onPressed: () => setState(() => _open = true), child: const Text('Write a review'));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 10,
      children: [
        Text('Your rating', style: theme.textTheme.labelLarge),
        Row(
          children: [
            for (var stars = 1; stars <= 5; stars++)
              IconButton(
                tooltip: '$stars ${stars == 1 ? 'star' : 'stars'}',
                isSelected: _rating == stars,
                icon: Icon(stars <= _rating ? Icons.star : Icons.star_border, color: theme.colorScheme.primary),
                onPressed: () => setState(() => _rating = stars),
              ),
          ],
        ),
        TextField(
          controller: _title,
          maxLength: Reviews.maxTitleLength,
          decoration: const InputDecoration(labelText: 'Title (optional)', border: OutlineInputBorder()),
        ),
        TextField(
          controller: _body,
          minLines: 3,
          maxLines: 8,
          maxLength: Reviews.maxLength,
          decoration: const InputDecoration(
            labelText: 'Your review',
            hintText: 'What was it like?',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
        ),
        if (_problem != null) Text(_problem!, style: TextStyle(color: theme.colorScheme.error)),
        Row(
          spacing: 8,
          children: [
            FilledButton(
              onPressed: _sending ? null : () => _send(client, app),
              child: Text(_sending ? 'Sending…' : 'Send review'),
            ),
            TextButton(onPressed: _sending ? null : () => setState(() => _open = false), child: const Text('Cancel')),
          ],
        ),
      ],
    );
  }
}
