import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../onboarding/data/onboarding_draft_store.dart';
import '../../onboarding/state/worker_onboarding_controller.dart';
import '../../uploads/data/cloudinary_upload_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _radius = TextEditingController();
  final _credentialUrl = TextEditingController();
  ClinicalRole _role = ClinicalRole.hca;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _radius.dispose();
    _credentialUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = ref.watch(workerOnboardingControllerProvider);

    return onboarding.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(apiErrorMessage(error, 'Settings could not load.')),
      ),
      data: (state) {
        _hydrateOnce(state.draft);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: StatusPill(
                    label: onboardingStatusToApi(
                      state.status.verificationStatus,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/onboarding'),
                  child: const Text('Onboarding'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Profile',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _firstName,
              decoration: const InputDecoration(labelText: 'First name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lastName,
              decoration: const InputDecoration(labelText: 'Last name'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<ClinicalRole>(
              initialValue: _role,
              decoration: const InputDecoration(labelText: 'Clinical role'),
              items: ClinicalRole.values
                  .map(
                    (role) => DropdownMenuItem(
                      value: role,
                      child: Text(clinicalRoleToApi(role)),
                    ),
                  )
                  .toList(),
              onChanged: (role) => setState(() => _role = role ?? _role),
            ),
            const SizedBox(height: 18),
            Text(
              'Matching',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _radius,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Radius km'),
            ),
            const SizedBox(height: 18),
            Text(
              'Credentials',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _credentialUrl,
              decoration: const InputDecoration(labelText: 'Document URL'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _uploadCredential,
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload replacement credential'),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => _save(state.draft),
              child: const Text('Save settings'),
            ),
          ],
        );
      },
    );
  }

  void _hydrateOnce(WorkerOnboardingDraft draft) {
    if (_firstName.text.isNotEmpty || _lastName.text.isNotEmpty) {
      return;
    }
    _firstName.text = draft.firstName;
    _lastName.text = draft.lastName;
    _radius.text = draft.maxDistanceKm.toString();
    _credentialUrl.text = draft.credentialUrl;
    _role = draft.title;
  }

  Future<void> _uploadCredential() async {
    try {
      final url = await ref
          .read(cloudinaryUploadServiceProvider)
          .pickAndUploadCredential();
      _credentialUrl.text = url;
      if (mounted) {
        showAppSnack(context, 'Credential uploaded.');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Credential upload failed.'),
          isError: true,
        );
      }
    }
  }

  Future<void> _save(WorkerOnboardingDraft draft) async {
    final updated = draft.copyWith(
      firstName: _firstName.text,
      lastName: _lastName.text,
      title: _role,
      maxDistanceKm: double.tryParse(_radius.text) ?? draft.maxDistanceKm,
      credentialUrl: _credentialUrl.text,
    );
    try {
      await ref
          .read(workerOnboardingControllerProvider.notifier)
          .updateDraft(updated);
      await ref.read(workerOnboardingControllerProvider.notifier).submit();
      if (mounted) {
        showAppSnack(context, 'Worker settings saved.');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Settings could not be saved.'),
          isError: true,
        );
      }
    }
  }
}
