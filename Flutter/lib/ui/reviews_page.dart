import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';
import 'bd_scope.dart';
import 'shop_parts.dart';

/// The business's reviews: the rating and a bar per star over all of them,
/// a filter by platform, the reviews a page at a time, and "Write a review"
/// for a signed-in customer.
class ReviewsPage extends StatefulWidget {
  const ReviewsPage({super.key});

  @override
  State<ReviewsPage> createState() => _ReviewsPageState();
}

class _ReviewsPageState extends State<ReviewsPage> {
  BdClient? _client;
  ReviewTotals? _totals;
  List<String> _sources = const [];
  String? _source;

  List<Review>? _reviews;
  int? _nextOffset;
  int _total = 0;
  bool _failed = false;
  bool _loadingMore = false;
  int _ticket = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    if (client == null) return;
    client.reviewTotals().then((totals) {
      if (mounted) setState(() => _totals = totals);
    }, onError: (Object _) {});
    _load();
  }

  Future<void> _load() async {
    final client = _client;
    if (client == null) return;
    final ticket = ++_ticket;
    final source = _source;
    setState(() {
      _reviews = null;
      _failed = false;
    });
    try {
      final page = await client.reviewPage(source: source);
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _reviews = page.items;
        _nextOffset = page.nextOffset;
        _total = page.totalCount;
        // The platforms come from the unfiltered list, and stay put while
        // one is picked.
        if (source == null) _sources = Reviews.sourcesIn(page.items);
      });
    } on Exception {
      if (mounted && ticket == _ticket) setState(() => _failed = true);
    }
  }

  Future<void> _loadMore() async {
    final client = _client;
    final reviews = _reviews;
    final offset = _nextOffset;
    if (client == null || reviews == null || offset == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await client.reviewPage(offset: offset, source: _source);
      if (!mounted) return;
      final shown = reviews.map((review) => review.id).toSet();
      setState(() {
        _reviews = [...reviews, ...page.items.where((review) => !shown.contains(review.id))];
        _nextOffset = page.nextOffset;
      });
    } on Exception {
      // The button stays; trying again is the answer.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviews = _reviews;
    return Scaffold(
      appBar: AppBar(title: const Text('Reviews')),
      body: _client == null
          ? const Center(child: Text('Not connected to BD.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _SummaryCard(summary: Reviews.summarize(_totals, fallbackTotal: _total)),
                const SizedBox(height: 16),
                if (_sources.length > 1 || _source != null)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      spacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _source == null,
                          onSelected: (_) => setState(() {
                            _source = null;
                            _load();
                          }),
                        ),
                        for (final source in _sources)
                          ChoiceChip(
                            label: Text(Reviews.sourceLabel(source)),
                            selected: _source == source,
                            onSelected: (_) => setState(() {
                              _source = source;
                              _load();
                            }),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                if (_failed)
                  const _Note("Reviews aren't available right now. Please check back soon.")
                else if (reviews == null)
                  const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
                else if (reviews.isEmpty)
                  const _Note('No reviews yet', detail: "Write one in Business Dash and it'll appear here.")
                else ...[
                  for (final review in reviews) _ReviewCard(review: review),
                  if (_nextOffset != null)
                    OutlinedButton(
                      onPressed: _loadingMore ? null : _loadMore,
                      child: Text(_loadingMore ? 'Loading…' : 'Show more'),
                    ),
                ],
              ],
            ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});

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
            const _ReviewWriter(),
          ],
        ),
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

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
class _ReviewWriter extends StatefulWidget {
  const _ReviewWriter();

  @override
  State<_ReviewWriter> createState() => _ReviewWriterState();
}

class _ReviewWriterState extends State<_ReviewWriter> {
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

class _Note extends StatelessWidget {
  const _Note(this.title, {this.detail});

  final String title;
  final String? detail;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          spacing: 6,
          children: [
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            if (detail != null) Text(detail!, textAlign: TextAlign.center),
          ],
        ),
      );
}
