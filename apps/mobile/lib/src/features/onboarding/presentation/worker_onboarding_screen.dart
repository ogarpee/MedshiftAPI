import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../uploads/data/cloudinary_upload_service.dart';
import '../data/onboarding_draft_store.dart';
import '../state/worker_onboarding_controller.dart';
import '../../shifts/state/shift_board_controller.dart';
import '../../worker/data/worker_repository.dart';

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
        loading: () => const _OnboardingLoading(),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                apiErrorMessage(error, 'Onboarding could not load.'),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.go('/login'),
                child: const Text('Return to sign in'),
              ),
            ],
          ),
        ),
        data: (state) => _OnboardingForm(state: state),
      ),
    );
  }
}

class _OnboardingLoading extends StatelessWidget {
  const _OnboardingLoading();

  @override
  Widget build(BuildContext context) {
    final placeholder = Theme.of(
      context,
    ).colorScheme.onSurface.withValues(alpha: 0.08);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LinearProgressIndicator(
          minHeight: 3,
          color: Theme.of(context).colorScheme.primary,
          backgroundColor: placeholder,
        ),
        const SizedBox(height: 20),
        Container(
          height: 24,
          width: 180,
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: 0.55,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: placeholder,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        for (var index = 0; index < 3; index++) ...[
          Container(
            height: 56,
            decoration: BoxDecoration(
              color: placeholder,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _OnboardingNotice extends StatelessWidget {
  const _OnboardingNotice({required this.message, required this.isBlocking});

  final String message;
  final bool isBlocking;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: isBlocking
          ? colors.errorContainer
          : colors.secondaryContainer.withValues(alpha: 0.55),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isBlocking ? Icons.cloud_off_outlined : Icons.info_outline,
              color: isBlocking
                  ? colors.onErrorContainer
                  : colors.onSecondaryContainer,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  color: isBlocking
                      ? colors.onErrorContainer
                      : colors.onSecondaryContainer,
                ),
              ),
            ),
          ],
        ),
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

class _OnboardingFormState extends ConsumerState<_OnboardingForm>
    with WidgetsBindingObserver {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _latitude;
  late final TextEditingController _longitude;
  late final TextEditingController _radius;
  final Map<WorkerDocumentCategory, int> _uploadProgress = {};
  bool _isContinuing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final draft = widget.state.draft;
    _firstName = TextEditingController(text: draft.firstName);
    _lastName = TextEditingController(text: draft.lastName);
    _latitude = TextEditingController(text: draft.latitude.toString());
    _longitude = TextEditingController(text: draft.longitude.toString());
    _radius = TextEditingController(text: draft.maxDistanceKm.toString());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _firstName.dispose();
    _lastName.dispose();
    _latitude.dispose();
    _longitude.dispose();
    _radius.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      ref.read(workerOnboardingControllerProvider.notifier).syncNow();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(workerOnboardingControllerProvider).value ?? widget.state;
    final draft = state.draft;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (state.loadNotice != null) ...[
          _OnboardingNotice(
            message: state.loadNotice!,
            isBlocking: state.profileLoadBlocked,
          ),
          const SizedBox(height: 14),
        ],
        StatusPill(
          label: onboardingStatusToApi(state.status.verificationStatus),
        ),
        const SizedBox(height: 14),
        LinearProgressIndicator(value: (state.step + 1) / 5),
        const SizedBox(height: 6),
        Text(
          _saveStateLabel(state.saveState),
          style: Theme.of(context).textTheme.bodySmall,
          textAlign: TextAlign.right,
        ),
        if (state.syncError != null) ...[
          const SizedBox(height: 6),
          Text(
            state.syncError!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
            textAlign: TextAlign.right,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: state.saveState == OnboardingDraftSaveState.saving
                  ? null
                  : () => ref
                        .read(workerOnboardingControllerProvider.notifier)
                        .syncNow(),
              icon: const Icon(Icons.sync),
              label: const Text('Retry sync'),
            ),
          ),
        ],
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
            onChanged: (_) => _persist(draft),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _longitude,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Longitude'),
            onChanged: (_) => _persist(draft),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _radius,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Radius km'),
            onChanged: (_) => _persist(draft),
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
            title: 'Documents',
            caption: 'Upload the required private verification documents.',
          ),
          for (final category in const [
            WorkerDocumentCategory.governmentId,
            WorkerDocumentCategory.professionalCertificate,
            WorkerDocumentCategory.backgroundCheck,
          ]) ...[
            _DocumentCard(
              category: category,
              document: draft.documents.cast<WorkerDocument?>().firstWhere(
                (document) => document?.category == category,
                orElse: () => null,
              ),
              progress: _uploadProgress[category],
              onUpload: () => _uploadDocument(category),
              onRemove: (document) => _removeDocument(document),
              onView: (document) => _viewDocument(state, document),
            ),
            const SizedBox(height: 12),
          ],
          for (final document in draft.documents.where(
            (item) => item.category == WorkerDocumentCategory.other,
          )) ...[
            _DocumentCard(
              category: WorkerDocumentCategory.other,
              document: document,
              onUpload: () => _uploadDocument(WorkerDocumentCategory.other),
              onRemove: _removeDocument,
              onView: (item) => _viewDocument(state, item),
            ),
            const SizedBox(height: 12),
          ],
          if (draft.documents.length < 10)
            OutlinedButton.icon(
              onPressed: () => _uploadDocument(WorkerDocumentCategory.other),
              icon: const Icon(Icons.add),
              label: const Text('Add another document'),
            ),
        ],
        if (state.step == 4) ...[
          _StepTitle(
            title: 'Review',
            caption: 'Submit your worker profile for MedShift verification.',
          ),
          if (state.status.verificationStatus == OnboardingStatus.rejected &&
              state.status.rejectedReason != null)
            _ReviewAlert(
              title: 'Changes requested',
              message: state.status.rejectedReason!,
              isError: true,
            ),
          if (state.status.verificationStatus == OnboardingStatus.approved &&
              state.baseline != null &&
              _requiresVerificationReset(state.baseline!, draft))
            const _ReviewAlert(
              title: 'Verification review required',
              message:
                  'Changing your clinical role or required documents will return your profile to pending review.',
            ),
          _ReviewSection(
            title: 'Identity',
            error: _validateStep(0, draft),
            onEdit: () => _moveToStep(state, 0),
            children: [
              _ReviewValue(label: 'Legal first name', value: draft.firstName),
              _ReviewValue(label: 'Legal last name', value: draft.lastName),
              _ReviewValue(
                label: 'Clinical role',
                value: clinicalRoleToApi(draft.title),
              ),
            ],
          ),
          _ReviewSection(
            title: 'Service area',
            error: _validateStep(1, draft),
            onEdit: () => _moveToStep(state, 1),
            children: [
              _ReviewLocationMap(
                latitude: draft.latitude,
                longitude: draft.longitude,
              ),
              _ReviewValue(
                label: 'Latitude',
                value: draft.latitude.toStringAsFixed(6),
              ),
              _ReviewValue(
                label: 'Longitude',
                value: draft.longitude.toStringAsFixed(6),
              ),
              _ReviewValue(
                label: 'Search radius',
                value: '${draft.maxDistanceKm.toStringAsFixed(0)} km',
              ),
            ],
          ),
          _ReviewSection(
            title: 'Availability',
            error: _validateStep(2, draft),
            onEdit: () => _moveToStep(state, 2),
            children: [
              _ReviewValue(
                label: 'Available days',
                value: draft.availableDays.map(readableEnum).join(', '),
              ),
              _ReviewValue(
                label: 'Preferred shifts',
                value: draft.preferredShiftTypes.map(readableEnum).join(', '),
              ),
            ],
          ),
          _ReviewSection(
            title: 'Documents',
            error: _validateStep(3, draft),
            onEdit: () => _moveToStep(state, 3),
            children: draft.documents
                .map(
                  (document) => _ReviewDocument(
                    document: document,
                    onPreview: () => _viewDocument(state, document),
                  ),
                )
                .toList(),
          ),
        ],
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: state.step == 0 || _isContinuing
                    ? null
                    : () => _moveToStep(state, state.step - 1),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _isContinuing
                    ? null
                    : state.step == 4
                    ? state.profileLoadBlocked
                          ? null
                          : _submit
                    : () => _next(state),
                child: Text(
                  _isContinuing
                      ? 'Saving...'
                      : state.step == 4
                      ? _submitLabel(state)
                      : 'Save and continue',
                ),
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
    await _moveToStep(state, state.step + 1, draft: draft);
  }

  Future<void> _moveToStep(
    WorkerOnboardingViewState state,
    int step, {
    WorkerOnboardingDraft? draft,
  }) async {
    if (_isContinuing) return;
    setState(() => _isContinuing = true);
    try {
      await ref
          .read(workerOnboardingControllerProvider.notifier)
          .saveAndContinue(draft ?? _draftFromInputs(state.draft), step);
    } finally {
      if (mounted) setState(() => _isContinuing = false);
    }
  }

  Future<void> _submit() async {
    final current = ref.read(workerOnboardingControllerProvider).value;
    if (current == null) {
      return;
    }
    if (current.profileLoadBlocked) {
      if (mounted) {
        showAppSnack(
          context,
          'Your submitted profile must finish loading before changes can be submitted.',
          isError: true,
        );
      }
      return;
    }
    final draft = _draftFromInputs(current.draft);
    for (var step = 0; step < 4; step += 1) {
      final error = _validateStep(step, draft);
      if (error != null) {
        await ref
            .read(workerOnboardingControllerProvider.notifier)
            .updateDraft(draft);
        await ref
            .read(workerOnboardingControllerProvider.notifier)
            .setStep(step);
        if (mounted) showAppSnack(context, error, isError: true);
        return;
      }
    }
    await ref
        .read(workerOnboardingControllerProvider.notifier)
        .updateDraft(draft);
    try {
      await ref.read(workerOnboardingControllerProvider.notifier).submit();
      ref.invalidate(workerProfileSnapshotProvider);
      ref.invalidate(shiftBoardControllerProvider);
      if (mounted) {
        showAppSnack(
          context,
          current.profile == null
              ? 'Onboarding submitted for review.'
              : 'Worker profile changes saved.',
        );
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

  Future<void> _uploadDocument(WorkerDocumentCategory category) async {
    try {
      final document = await ref
          .read(cloudinaryUploadServiceProvider)
          .pickAndUploadDocument(
            category,
            onProgress: (value) {
              if (mounted) setState(() => _uploadProgress[category] = value);
            },
          );
      final current = ref.read(workerOnboardingControllerProvider).value;
      if (current != null) {
        final documents = [...current.draft.documents];
        if (category != WorkerDocumentCategory.other) {
          documents.removeWhere((item) => item.category == category);
        }
        documents.add(document);
        await _persist(
          _draftFromInputs(current.draft).copyWith(documents: documents),
        );
        await ref.read(workerOnboardingControllerProvider.notifier).syncNow();
      }
      if (mounted) {
        showAppSnack(context, '${_documentLabel(category)} uploaded securely.');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Document upload failed.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _uploadProgress.remove(category));
    }
  }

  Future<void> _removeDocument(WorkerDocument document) async {
    final current = ref.read(workerOnboardingControllerProvider).value;
    if (current == null) return;
    await _persist(
      current.draft.copyWith(
        documents: current.draft.documents
            .where((item) => item.id != document.id)
            .toList(),
      ),
    );
    await ref.read(workerOnboardingControllerProvider.notifier).syncNow();
  }

  Future<void> _viewDocument(
    WorkerOnboardingViewState state,
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
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Document could not be opened.'),
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
            draft.longitude > 180 ||
            draft.maxDistanceKm < 1 ||
            draft.maxDistanceKm > 250)) {
      return 'Enter valid coordinates and a radius between 1 and 250 km.';
    }
    if (step == 2 &&
        (draft.availableDays.isEmpty || draft.preferredShiftTypes.isEmpty)) {
      return 'Select at least one available day and preferred shift type.';
    }
    if (step == 3 &&
        !const [
          WorkerDocumentCategory.governmentId,
          WorkerDocumentCategory.professionalCertificate,
          WorkerDocumentCategory.backgroundCheck,
        ].every(
          (category) =>
              draft.documents.any((document) => document.category == category),
        )) {
      return 'Upload your government ID, professional certificate or licence, and background-check document.';
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

class _ReviewAlert extends StatelessWidget {
  const _ReviewAlert({
    required this.title,
    required this.message,
    this.isError = false,
  });

  final String title;
  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: isError ? Colors.red.shade50 : Colors.amber.shade50,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(message),
          ],
        ),
      ),
    );
  }
}

class _ReviewSection extends StatelessWidget {
  const _ReviewSection({
    required this.title,
    required this.onEdit,
    required this.children,
    this.error,
  });

  final String title;
  final VoidCallback onEdit;
  final List<Widget> children;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: error == null ? Colors.black12 : Colors.red),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                TextButton(onPressed: onEdit, child: const Text('Edit')),
              ],
            ),
            if (error != null) ...[
              Text(error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 8),
            ],
            ...children,
          ],
        ),
      ),
    );
  }
}

class _ReviewValue extends StatelessWidget {
  const _ReviewValue({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 2),
          Text(value.isEmpty ? 'Not provided' : value),
        ],
      ),
    );
  }
}

class _ReviewLocationMap extends ConsumerWidget {
  const _ReviewLocationMap({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(appConfigProvider).hasMapboxToken) {
      return Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.blueGrey.shade50,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          'Service area preview\n${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)}',
        ),
      );
    }
    return Container(
      height: 190,
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(10)),
      child: MapWidget(
        key: const ValueKey('worker-onboarding-review-map'),
        viewport: CameraViewportState(
          center: Point(coordinates: Position(longitude, latitude)),
          zoom: 10,
        ),
      ),
    );
  }
}

class _ReviewDocument extends StatelessWidget {
  const _ReviewDocument({required this.document, required this.onPreview});

  final WorkerDocument document;
  final VoidCallback onPreview;

  @override
  Widget build(BuildContext context) {
    final metadata = [
      document.format?.toUpperCase(),
      if (document.bytes != null) _formatBytes(document.bytes!),
      if (document.uploadedAt != null) _formatDate(document.uploadedAt!),
    ].whereType<String>().where((value) => value.isNotEmpty).join(' · ');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.black12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _documentLabel(document.category),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          Text(document.originalFilename ?? 'Uploaded document'),
          if (metadata.isNotEmpty) Text(metadata),
          Text(
            'Status: ${readableEnum(document.verificationStatus ?? 'PENDING')}',
          ),
          if (document.rejectionReason != null)
            Text(
              document.rejectionReason!,
              style: const TextStyle(color: Colors.red),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onPreview,
              child: const Text('Preview'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.category,
    required this.onUpload,
    required this.onRemove,
    required this.onView,
    this.document,
    this.progress,
  });

  final WorkerDocumentCategory category;
  final WorkerDocument? document;
  final int? progress;
  final VoidCallback onUpload;
  final ValueChanged<WorkerDocument> onRemove;
  final ValueChanged<WorkerDocument> onView;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _documentLabel(category),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              document?.originalFilename ??
                  'PDF, JPG, PNG, or WEBP · maximum 10 MB',
            ),
            if (progress != null) ...[
              const SizedBox(height: 10),
              LinearProgressIndicator(value: progress! / 100),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton(
                  onPressed: progress == null ? onUpload : null,
                  child: Text(document == null ? 'Upload' : 'Replace'),
                ),
                if (document != null)
                  TextButton(
                    onPressed: () => onView(document!),
                    child: const Text('View'),
                  ),
                if (document != null)
                  TextButton(
                    onPressed: () => onRemove(document!),
                    child: const Text('Remove'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _documentLabel(WorkerDocumentCategory category) => switch (category) {
  WorkerDocumentCategory.governmentId => 'Government ID',
  WorkerDocumentCategory.professionalCertificate =>
    'Professional certificate or licence',
  WorkerDocumentCategory.backgroundCheck => 'Background-check document',
  WorkerDocumentCategory.other => 'Additional document',
};

String _saveStateLabel(OnboardingDraftSaveState state) => switch (state) {
  OnboardingDraftSaveState.idle => 'Autosave ready',
  OnboardingDraftSaveState.saving => 'Saving...',
  OnboardingDraftSaveState.saved => 'Saved',
  OnboardingDraftSaveState.device => 'Saved on this device',
  OnboardingDraftSaveState.error =>
    'Sync failed — changes remain on this device',
};

String _submitLabel(WorkerOnboardingViewState state) {
  if (state.profile == null) return 'Submit for review';
  if (state.status.verificationStatus == OnboardingStatus.rejected) {
    return 'Resubmit for review';
  }
  return 'Save changes';
}

bool _requiresVerificationReset(
  WorkerOnboardingDraft baseline,
  WorkerOnboardingDraft current,
) {
  if (baseline.title != current.title) return true;
  const required = [
    WorkerDocumentCategory.governmentId,
    WorkerDocumentCategory.professionalCertificate,
    WorkerDocumentCategory.backgroundCheck,
  ];
  for (final category in required) {
    final before = baseline.documents
        .where((document) => document.category == category)
        .map((document) => document.id)
        .firstOrNull;
    final after = current.documents
        .where((document) => document.category == category)
        .map((document) => document.id)
        .firstOrNull;
    if (before != after) return true;
  }
  return false;
}

String _formatBytes(int bytes) => bytes >= 1024 * 1024
    ? '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB'
    : '${(bytes / 1024).round().clamp(1, 1024)} KB';

String _formatDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return '';
  return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
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
