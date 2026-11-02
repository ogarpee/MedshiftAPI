import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../onboarding/state/worker_onboarding_controller.dart';
import '../../worker/data/worker_repository.dart';
import '../../auth/state/auth_controller.dart';
import 'account_preferences_sections.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(workerProfileSnapshotProvider);
    final draftState = ref.watch(workerOnboardingControllerProvider);

    return snapshot.when(
      loading: () => const _ProfileSkeleton(),
      error: (error, _) => _ProfileError(
        message: apiErrorMessage(
          error,
          'Your worker profile could not be loaded.',
        ),
        onRetry: () => ref.invalidate(workerProfileSnapshotProvider),
      ),
      data: (data) {
        final profile = data.profile;
        final onboarding = data.onboarding;
        if (profile == null) {
          return _IncompleteProfile(
            error: data.profileError,
            onContinue: () => context.go('/onboarding'),
            onRetry: () => ref.invalidate(workerProfileSnapshotProvider),
            accountSections: const [
              SizedBox(height: 14),
              _AccountSettingsShortcuts(),
            ],
          );
        }
        final draft = draftState.value;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(workerProfileSnapshotProvider);
            ref.invalidate(workerOnboardingControllerProvider);
            await ref.read(workerProfileSnapshotProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (data.hasError)
                _NoticeCard(
                  message: data.profileError ?? data.onboardingError!,
                  action: 'Retry',
                  onPressed: () =>
                      ref.invalidate(workerProfileSnapshotProvider),
                  isError: true,
                ),
              if (draft?.saveState == OnboardingDraftSaveState.device ||
                  draft?.saveState == OnboardingDraftSaveState.error)
                _NoticeCard(
                  message:
                      draft?.syncError ??
                      'Profile changes are saved on this device and still need to sync.',
                  action: 'Retry sync',
                  onPressed: () => ref
                      .read(workerOnboardingControllerProvider.notifier)
                      .syncNow(),
                ),
              _ProfileHeader(
                profile: profile,
                onboarding: onboarding,
                email: ref.watch(authControllerProvider).value?.user?.email,
              ),
              const SizedBox(height: 14),
              WorkerOnboardingProfileCard(
                onboarding:
                    onboarding ??
                    OnboardingState(
                      verificationStatus: profile.onboardingStatus,
                    ),
                onPressed: () => context.go('/onboarding'),
              ),
              const SizedBox(height: 14),
              const _AccountSettingsShortcuts(),
              const SizedBox(height: 14),
              _ProfileSection(
                title: 'Identity',
                icon: Icons.badge_outlined,
                children: [
                  _ProfileRow(label: 'Legal name', value: profile.displayName),
                  _ProfileRow(
                    label: 'Clinical role',
                    value: clinicalRoleToApi(profile.title),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ProfileSection(
                title: 'Service area',
                icon: Icons.location_on_outlined,
                children: [
                  _ProfileRow(
                    label: 'Search radius',
                    value: '${profile.maxDistanceKm.toStringAsFixed(0)} km',
                  ),
                  _ProfileRow(
                    label: 'Coordinates',
                    value:
                        '${profile.location.latitude.toStringAsFixed(5)}, ${profile.location.longitude.toStringAsFixed(5)}',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ProfileSection(
                title: 'Availability',
                icon: Icons.event_available_outlined,
                children: [
                  _ProfileRow(
                    label: 'Days',
                    value: profile.availableDays.isEmpty
                        ? 'Not selected'
                        : profile.availableDays.map(readableEnum).join(', '),
                  ),
                  _ProfileRow(
                    label: 'Preferred shifts',
                    value: profile.preferredShiftTypes.isEmpty
                        ? 'Not selected'
                        : profile.preferredShiftTypes
                              .map(readableEnum)
                              .join(', '),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ProfileSection(
                title: 'Documents',
                icon: Icons.folder_copy_outlined,
                children: profile.documents.isEmpty
                    ? const [
                        Text(
                          'Required documents have not been uploaded yet.',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ]
                    : profile.documents
                          .map(
                            (document) => _DocumentRow(
                              document: document,
                              onPreview: () =>
                                  _previewDocument(context, ref, document),
                            ),
                          )
                          .toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _previewDocument(
    BuildContext context,
    WidgetRef ref,
    WorkerDocument document,
  ) async {
    try {
      final response = await ref
          .read(dioProvider)
          .get<Map<String, dynamic>>(
            '/uploads/worker-documents/${document.id}/access-url',
          );
      final url = Uri.tryParse(response.data?['url']?.toString() ?? '');
      if (url == null ||
          !await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw const ApiException('Document could not be opened.');
      }
    } catch (error) {
      if (context.mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Document could not be opened.'),
          isError: true,
        );
      }
    }
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.profile,
    required this.onboarding,
    this.email,
  });
  final WorkerProfile profile;
  final OnboardingState? onboarding;
  final String? email;

  @override
  Widget build(BuildContext context) {
    final status = onboarding?.verificationStatus ?? profile.onboardingStatus;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: AppColors.navy,
              child: Text(
                _initials(profile.displayName),
                style: const TextStyle(
                  color: AppColors.lightGold,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profile.displayName.isEmpty
                        ? 'Worker profile'
                        : profile.displayName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    clinicalRoleToApi(profile.title),
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  if (email?.isNotEmpty == true) ...[
                    const SizedBox(height: 3),
                    Text(
                      email!,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  StatusPill(
                    label: readableEnum(onboardingStatusToApi(status)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class WorkerOnboardingProfileCard extends StatelessWidget {
  const WorkerOnboardingProfileCard({
    super.key,
    required this.onboarding,
    required this.onPressed,
  });

  final OnboardingState onboarding;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final status = onboarding.verificationStatus;
    final rejected = status == OnboardingStatus.rejected;
    final pending = status == OnboardingStatus.pendingReview;
    final approved = status == OnboardingStatus.approved;
    final title = rejected
        ? 'Onboarding needs updates'
        : pending
        ? 'Onboarding under review'
        : approved
        ? 'Onboarding approved'
        : 'Complete your onboarding';
    final detail = rejected
        ? (onboarding.rejectedReason?.isNotEmpty == true
              ? onboarding.rejectedReason!
              : 'Review the requested changes and resubmit your information.')
        : pending
        ? 'Review the information currently submitted to MedShift.'
        : approved
        ? 'Review your submitted information or make changes when needed.'
        : 'Finish your identity, service area, availability, and documents.';
    final action = rejected
        ? 'Update onboarding'
        : pending
        ? 'Review submitted information'
        : approved
        ? 'Review and edit onboarding'
        : 'Continue onboarding';

    return Semantics(
      button: true,
      label: '$title. $action',
      child: Card(
        color: AppColors.gold.withValues(alpha: 0.12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.verified_user_outlined, color: AppColors.navy),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        detail,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        action,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.title,
    required this.icon,
    required this.children,
  });
  final String title;
  final IconData icon;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.navy),
              const SizedBox(width: 9),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const Divider(height: 24),
          ...children,
        ],
      ),
    ),
  );
}

class _AccountSettingsShortcuts extends StatelessWidget {
  const _AccountSettingsShortcuts();

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: Text(
              'Account settings',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notification preferences'),
            subtitle: const Text('Choose in-app and email updates.'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _openAccountPage(
              context,
              title: 'Notification preferences',
              child: const NotificationPreferencesSection(),
            ),
          ),
          const Divider(height: 1, indent: 16, endIndent: 16),
          ListTile(
            leading: const Icon(Icons.security_outlined),
            title: const Text('Security & 2FA'),
            subtitle: const Text(
              'Enable two-factor authentication and manage trusted devices.',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _openAccountPage(
              context,
              title: 'Security & 2FA',
              child: const AccountSecuritySection(),
            ),
          ),
        ],
      ),
    ),
  );

  void _openAccountPage(
    BuildContext context, {
    required String title,
    required Widget child,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          appBar: AppBar(title: Text(title)),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [child],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 112,
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

class _DocumentRow extends StatelessWidget {
  const _DocumentRow({required this.document, required this.onPreview});
  final WorkerDocument document;
  final VoidCallback onPreview;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.description_outlined),
    title: Text(
      document.originalFilename ??
          readableEnum(workerDocumentCategoryToApi(document.category)),
    ),
    subtitle: Text(readableEnum(document.verificationStatus ?? 'PENDING')),
    trailing: IconButton(
      onPressed: onPreview,
      tooltip: 'Preview document',
      icon: const Icon(Icons.open_in_new),
    ),
  );
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.message,
    required this.action,
    required this.onPressed,
    this.isError = false,
  });
  final String message;
  final String action;
  final VoidCallback onPressed;
  final bool isError;
  @override
  Widget build(BuildContext context) => Card(
    color: isError
        ? Colors.red.withValues(alpha: 0.08)
        : AppColors.gold.withValues(alpha: 0.12),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(child: Text(message)),
          TextButton(onPressed: onPressed, child: Text(action)),
        ],
      ),
    ),
  );
}

class _IncompleteProfile extends StatelessWidget {
  const _IncompleteProfile({
    required this.onContinue,
    required this.onRetry,
    this.error,
    this.accountSections = const [],
  });
  final VoidCallback onContinue;
  final VoidCallback onRetry;
  final String? error;
  final List<Widget> accountSections;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      if (error == null)
        WorkerOnboardingProfileCard(
          onboarding: const OnboardingState(
            verificationStatus: OnboardingStatus.incomplete,
          ),
          onPressed: onContinue,
        )
      else
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const Icon(
                  Icons.cloud_off_outlined,
                  size: 48,
                  color: AppColors.navy,
                ),
                const SizedBox(height: 14),
                Text(
                  'Profile could not be loaded',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(error!, textAlign: TextAlign.center),
                const SizedBox(height: 18),
                OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      ...accountSections,
    ],
  );
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Icon(Icons.cloud_off_outlined, size: 46),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ),
        ),
      ),
      const SizedBox(height: 14),
      const _AccountSettingsShortcuts(),
    ],
  );
}

class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: List.generate(
      4,
      (index) => Container(
        height: index == 0 ? 112 : 150,
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
  );
}

String _initials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'MS';
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}
