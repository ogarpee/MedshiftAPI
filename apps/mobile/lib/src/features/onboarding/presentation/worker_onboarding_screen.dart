import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../uploads/data/cloudinary_upload_service.dart';
import '../data/onboarding_draft_store.dart';
import '../state/worker_onboarding_controller.dart';

const _weekDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const _shiftTypes = ['DAY', 'EVENING', 'NIGHT', 'WEEKEND'];

class WorkerOnboardingScreen extends ConsumerWidget {
  const WorkerOnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboarding = ref.watch(workerOnboardingControllerProvider);

    return ScreenScaffold(
      title: 'Worker onboarding',
      actions: [
        TextButton(
          onPressed: () => context.go('/home'),
          child: const Text('Dashboard', style: TextStyle(color: Colors.white)),
        ),
      ],
      child: onboarding.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(apiErrorMessage(error, 'Onboarding could not load.')),
        ),
        data: (state) => _OnboardingForm(state: state),
      ),
    );
  }
}

class _OnboardingForm extends ConsumerStatefulWidget {
  const _OnboardingForm({required this.state});

  final WorkerOnboardingViewState state;

  @override
  ConsumerState<_OnboardingForm> createState() => _OnboardingFormState();
}

class _OnboardingFormState extends ConsumerState<_OnboardingForm> {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _latitude;
  late final TextEditingController _longitude;
  late final TextEditingController _radius;
  late final TextEditingController _credentialType;
  late final TextEditingController _credentialUrl;

  @override
  void initState() {
    super.initState();
    final draft = widget.state.draft;
    _firstName = TextEditingController(text: draft.firstName);
    _lastName = TextEditingController(text: draft.lastName);
    _latitude = TextEditingController(text: draft.latitude.toString());
    _longitude = TextEditingController(text: draft.longitude.toString());
    _radius = TextEditingController(text: draft.maxDistanceKm.toString());
    _credentialType = TextEditingController(text: draft.credentialType);
    _credentialUrl = TextEditingController(text: draft.credentialUrl);
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _latitude.dispose();
    _longitude.dispose();
    _radius.dispose();
    _credentialType.dispose();
    _credentialUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(workerOnboardingControllerProvider).value ?? widget.state;
    final draft = state.draft;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        StatusPill(
          label: onboardingStatusToApi(state.status.verificationStatus),
        ),
        const SizedBox(height: 14),
        LinearProgressIndicator(value: (state.step + 1) / 5),
        const SizedBox(height: 18),
        if (state.step == 0) ...[
          _StepTitle(
            title: 'Identity',
            caption: 'Legal name and clinical role.',
          ),
          TextField(
            controller: _firstName,
            decoration: const InputDecoration(labelText: 'First name'),
            onChanged: (_) => _persist(draft),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lastName,
            decoration: const InputDecoration(labelText: 'Last name'),
            onChanged: (_) => _persist(draft),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<ClinicalRole>(
            initialValue: draft.title,
            decoration: const InputDecoration(labelText: 'Clinical role'),
            items: ClinicalRole.values
                .map(
                  (role) => DropdownMenuItem(
                    value: role,
                    child: Text(clinicalRoleToApi(role)),
                  ),
                )
                .toList(),
            onChanged: (role) => _persist(draft.copyWith(title: role)),
          ),
        ],
        if (state.step == 1) ...[
          _StepTitle(
            title: 'Service area',
            caption: 'Coordinates are used for nearby shift matching.',
          ),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Mapbox builds can replace this coordinate panel with the native map widget. Manual coordinates always remain available.',
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _latitude,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Latitude'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _longitude,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Longitude'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _radius,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Radius km'),
          ),
        ],
        if (state.step == 2) ...[
          _StepTitle(
            title: 'Availability',
            caption: 'Choose the days and shift types you prefer.',
          ),
          _ChoiceWrap(
            values: _weekDays,
            selected: draft.availableDays,
            onChanged: (values) =>
                _persist(draft.copyWith(availableDays: values)),
          ),
          const SizedBox(height: 16),
          _ChoiceWrap(
            values: _shiftTypes,
            selected: draft.preferredShiftTypes,
            onChanged: (values) =>
                _persist(draft.copyWith(preferredShiftTypes: values)),
          ),
        ],
        if (state.step == 3) ...[
          _StepTitle(
            title: 'Credentials',
            caption: 'Upload or paste your credential document link.',
          ),
          TextField(
            controller: _credentialType,
            decoration: const InputDecoration(labelText: 'Credential type'),
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
            label: const Text('Upload credential'),
          ),
          CheckboxListTile(
            value: draft.backgroundConsent,
            contentPadding: EdgeInsets.zero,
            onChanged: (value) =>
                _persist(draft.copyWith(backgroundConsent: value ?? false)),
            title: const Text('I consent to background-check review.'),
          ),
        ],
        if (state.step == 4) ...[
          _StepTitle(
            title: 'Review',
            caption: 'Submit your worker profile for MedShift verification.',
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${draft.firstName} ${draft.lastName}\n${clinicalRoleToApi(draft.title)} · ${draft.maxDistanceKm.toStringAsFixed(0)} km radius\n${draft.credentialType}',
              ),
            ),
          ),
        ],
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: state.step == 0
                    ? null
                    : () => ref
                          .read(workerOnboardingControllerProvider.notifier)
                          .setStep(state.step - 1),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: state.step == 4 ? _submit : () => _next(state),
                child: Text(state.step == 4 ? 'Submit' : 'Next'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _next(WorkerOnboardingViewState state) async {
    final draft = _draftFromInputs(state.draft);
    final error = _validateStep(state.step, draft);
    if (error != null) {
      showAppSnack(context, error, isError: true);
      return;
    }
    await ref
        .read(workerOnboardingControllerProvider.notifier)
        .updateDraft(draft);
    ref
        .read(workerOnboardingControllerProvider.notifier)
        .setStep(state.step + 1);
  }

  Future<void> _submit() async {
    final current = ref.read(workerOnboardingControllerProvider).value;
    if (current == null) {
      return;
    }
    await ref
        .read(workerOnboardingControllerProvider.notifier)
        .updateDraft(_draftFromInputs(current.draft));
    try {
      await ref.read(workerOnboardingControllerProvider.notifier).submit();
      if (mounted) {
        showAppSnack(context, 'Onboarding submitted for review.');
        context.go('/home');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Onboarding could not be submitted.'),
          isError: true,
        );
      }
    }
  }

  Future<void> _uploadCredential() async {
    try {
      final url = await ref
          .read(cloudinaryUploadServiceProvider)
          .pickAndUploadCredential();
      _credentialUrl.text = url;
      final current = ref.read(workerOnboardingControllerProvider).value;
      if (current != null) {
        await _persist(
          _draftFromInputs(current.draft).copyWith(credentialUrl: url),
        );
      }
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

  Future<void> _persist(WorkerOnboardingDraft draft) {
    return ref
        .read(workerOnboardingControllerProvider.notifier)
        .updateDraft(_draftFromInputs(draft));
  }

  WorkerOnboardingDraft _draftFromInputs(WorkerOnboardingDraft draft) {
    return draft.copyWith(
      firstName: _firstName.text,
      lastName: _lastName.text,
      latitude: double.tryParse(_latitude.text) ?? draft.latitude,
      longitude: double.tryParse(_longitude.text) ?? draft.longitude,
      maxDistanceKm: double.tryParse(_radius.text) ?? draft.maxDistanceKm,
      credentialType: _credentialType.text,
      credentialUrl: _credentialUrl.text,
    );
  }

  String? _validateStep(int step, WorkerOnboardingDraft draft) {
    if (step == 0 &&
        (draft.firstName.trim().length < 2 ||
            draft.lastName.trim().length < 2)) {
      return 'Enter your legal first and last name.';
    }
    if (step == 1 &&
        (draft.latitude < -90 ||
            draft.latitude > 90 ||
            draft.longitude < -180 ||
            draft.longitude > 180)) {
      return 'Enter valid coordinates.';
    }
    if (step == 3 &&
        (draft.credentialUrl.trim().isEmpty || !draft.backgroundConsent)) {
      return 'Add a credential document and background-check consent.';
    }
    return null;
  }
}

class _StepTitle extends StatelessWidget {
  const _StepTitle({required this.title, required this.caption});

  final String title;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(caption),
        ],
      ),
    );
  }
}

class _ChoiceWrap extends StatelessWidget {
  const _ChoiceWrap({
    required this.values,
    required this.selected,
    required this.onChanged,
  });

  final List<String> values;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: values.map((value) {
        final isSelected = selected.contains(value);
        return FilterChip(
          label: Text(readableEnum(value)),
          selected: isSelected,
          onSelected: (next) {
            final updated = [...selected];
            next ? updated.add(value) : updated.remove(value);
            onChanged(updated.toSet().toList());
          },
        );
      }).toList(),
    );
  }
}
