import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import '../../../core/config/app_config.dart';
import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../state/shift_board_controller.dart';

class ShiftBoardScreen extends ConsumerStatefulWidget {
  const ShiftBoardScreen({super.key});

  @override
  ConsumerState<ShiftBoardScreen> createState() => _ShiftBoardScreenState();
}

class _ShiftBoardScreenState extends ConsumerState<ShiftBoardScreen> {
  bool _mapMode = false;

  @override
  Widget build(BuildContext context) {
    final board = ref.watch(shiftBoardControllerProvider);

    return board.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorState(
        message: apiErrorMessage(error, 'Shift board could not load.'),
        onRetry: () => ref.refresh(shiftBoardControllerProvider),
      ),
      data: (state) => RefreshIndicator(
        onRefresh: () =>
            ref.read(shiftBoardControllerProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (state.invitations.any(
              (item) => item.status == ShiftInvitationStatus.pending,
            )) ...[
              _InvitationPanel(state: state),
              const SizedBox(height: 14),
            ],
            if (state.applications.isNotEmpty) ...[
              _ApplicationPanel(state: state),
              const SizedBox(height: 14),
            ],
            ShiftFilterPanel(state: state),
            if (state.isSearching) ...[
              const SizedBox(height: 8),
              const LinearProgressIndicator(minHeight: 2),
            ],
            if (state.searchError != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      state.searchError!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref
                        .read(shiftBoardControllerProvider.notifier)
                        .applyFilters(state.filters),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 14),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  icon: Icon(Icons.view_agenda_outlined),
                  label: Text('List'),
                ),
                ButtonSegment(
                  value: true,
                  icon: Icon(Icons.map_outlined),
                  label: Text('Map'),
                ),
              ],
              selected: {_mapMode},
              onSelectionChanged: (value) =>
                  setState(() => _mapMode = value.first),
            ),
            const SizedBox(height: 14),
            if (_mapMode)
              ShiftMapFallback(shifts: state.openShifts)
            else if (state.openShifts.isEmpty)
              const _EmptyBoard()
            else
              ...state.openShifts.map(
                (shift) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ShiftCard(
                    shift: shift,
                    onTap: () => _showDetails(
                      context,
                      shift,
                      state.onboarding.canAcceptShifts,
                      state.applications.any(
                        (application) => application.shiftId == shift.id,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showDetails(
    BuildContext context,
    ShiftSummary shift,
    bool canAccept,
    bool alreadyApplied,
  ) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => ShiftDetailsSheet(
        shift: shift,
        canAccept: canAccept,
        alreadyApplied: alreadyApplied,
        onAccept: () async {
          try {
            await ref
                .read(shiftBoardControllerProvider.notifier)
                .applyToShift(shift.id);
            if (context.mounted) {
              Navigator.of(context).pop();
              showAppSnack(context, 'Application submitted.');
            }
          } catch (error) {
            if (context.mounted) {
              showAppSnack(
                context,
                apiErrorMessage(error, 'Application could not be submitted.'),
                isError: true,
              );
            }
          }
        },
      ),
    );
  }
}

class ShiftFilterPanel extends ConsumerStatefulWidget {
  const ShiftFilterPanel({super.key, required this.state});

  final ShiftBoardState state;

  @override
  ConsumerState<ShiftFilterPanel> createState() => _ShiftFilterPanelState();
}

class _InvitationPanel extends ConsumerWidget {
  const _InvitationPanel({required this.state});

  final ShiftBoardState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = state.invitations
        .where(
          (invitation) => invitation.status == ShiftInvitationStatus.pending,
        )
        .toList();
    if (pending.isEmpty) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Invitations',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            ...pending.map(
              (invitation) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        invitation.message?.isNotEmpty == true
                            ? invitation.message!
                            : 'Facility invited you to a shift.',
                      ),
                    ),
                    TextButton(
                      onPressed: () => ref
                          .read(shiftBoardControllerProvider.notifier)
                          .respondToInvitation(
                            invitation.id,
                            ShiftInvitationStatus.declined,
                          ),
                      child: const Text('Decline'),
                    ),
                    ElevatedButton(
                      onPressed: () => ref
                          .read(shiftBoardControllerProvider.notifier)
                          .respondToInvitation(
                            invitation.id,
                            ShiftInvitationStatus.accepted,
                          ),
                      child: const Text('Accept'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ApplicationPanel extends StatelessWidget {
  const _ApplicationPanel({required this.state});

  final ShiftBoardState state;

  @override
  Widget build(BuildContext context) {
    if (state.applications.isEmpty) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Applications',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: state.applications.take(4).map((application) {
                return StatusPill(
                  label: readableEnum(application.status.name),
                  tone: AppColors.navy,
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShiftFilterPanelState extends ConsumerState<ShiftFilterPanel> {
  late final TextEditingController _search;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: widget.state.filters.search);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filters = widget.state.filters;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search facility, city, role, or description',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear search',
                          onPressed: () {
                            _search.clear();
                            _searchChanged('');
                            setState(() {});
                          },
                          icon: const Icon(Icons.close),
                        ),
                ),
                onChanged: (value) {
                  setState(() {});
                  _searchChanged(value);
                },
                onSubmitted: (value) => _applySearch(value),
              ),
            ),
            const SizedBox(width: 10),
            Badge(
              isLabelVisible: filters.activeFilterCount > 0,
              label: Text('${filters.activeFilterCount}'),
              child: OutlinedButton.icon(
                onPressed: () => _showFilters(filters),
                icon: const Icon(Icons.tune),
                label: const Text('Filters'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${widget.state.openShifts.length} result${widget.state.openShifts.length == 1 ? '' : 's'} near your search area',
          style: const TextStyle(color: AppColors.muted),
        ),
        if (filters.activeFilterCount > 0) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 7, runSpacing: 7, children: _chips(filters)),
        ],
      ],
    );
  }

  void _searchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 350),
      () => _applySearch(value),
    );
  }

  Future<void> _applySearch(String value) => ref
      .read(shiftBoardControllerProvider.notifier)
      .applyFilters(widget.state.filters.copyWith(search: value.trim()));

  Future<void> _showFilters(ShiftSearchFilters current) async {
    var draft = current;
    final radius = TextEditingController(
      text: current.radiusKm?.toStringAsFixed(0) ?? '',
    );
    final hours = TextEditingController(
      text: current.maxShiftHours?.toStringAsFixed(0) ?? '',
    );
    final rate = TextEditingController(
      text: current.minHourlyRate?.toStringAsFixed(0) ?? '',
    );
    final applied = await showModalBottomSheet<ShiftSearchFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              0,
              20,
              20 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Filter shifts',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                      TextButton(
                        onPressed: () => setSheetState(() {
                          draft = ShiftSearchFilters(search: current.search);
                          radius.clear();
                          hours.clear();
                          rate.clear();
                        }),
                        child: const Text('Clear all'),
                      ),
                    ],
                  ),
                  _filterHeading('Clinical role'),
                  Wrap(
                    spacing: 8,
                    children: ClinicalRole.values
                        .map(
                          (value) => FilterChip(
                            label: Text(clinicalRoleToApi(value)),
                            selected: draft.roles.contains(value),
                            onSelected: (_) => setSheetState(
                              () => draft = draft.copyWith(
                                roles: _toggle(draft.roles, value),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  _filterHeading('Facility type'),
                  Wrap(
                    spacing: 8,
                    children: FacilityType.values
                        .map(
                          (value) => FilterChip(
                            label: Text(readableEnum(facilityTypeToApi(value))),
                            selected: draft.facilityTypes.contains(value),
                            onSelected: (_) => setSheetState(
                              () => draft = draft.copyWith(
                                facilityTypes: _toggle(
                                  draft.facilityTypes,
                                  value,
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  _filterHeading('Shift period'),
                  Wrap(
                    spacing: 8,
                    children: ShiftSearchPeriod.values
                        .map(
                          (value) => FilterChip(
                            label: Text(
                              readableEnum(shiftSearchPeriodToApi(value)),
                            ),
                            selected: draft.shiftTypes.contains(value),
                            onSelected: (_) => setSheetState(
                              () => draft = draft.copyWith(
                                shiftTypes: _toggle(draft.shiftTypes, value),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: radius,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Radius km',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: hours,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Max hours',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: rate,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Min pay',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<ShiftSearchSort>(
                    initialValue: draft.sort,
                    decoration: const InputDecoration(labelText: 'Sort by'),
                    items: const [
                      DropdownMenuItem(
                        value: ShiftSearchSort.distance,
                        child: Text('Distance'),
                      ),
                      DropdownMenuItem(
                        value: ShiftSearchSort.startTime,
                        child: Text('Start time'),
                      ),
                      DropdownMenuItem(
                        value: ShiftSearchSort.hourlyRate,
                        child: Text('Pay'),
                      ),
                    ],
                    onChanged: (value) => setSheetState(
                      () => draft = draft.copyWith(sort: value),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(
                        context,
                        draft.copyWith(
                          radiusKm: double.tryParse(radius.text),
                          maxShiftHours: double.tryParse(hours.text),
                          minHourlyRate: double.tryParse(rate.text),
                          clearRadius: radius.text.trim().isEmpty,
                          clearMaxHours: hours.text.trim().isEmpty,
                          clearMinRate: rate.text.trim().isEmpty,
                        ),
                      ),
                      child: const Text('Apply filters'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    radius.dispose();
    hours.dispose();
    rate.dispose();
    if (applied != null) {
      await ref
          .read(shiftBoardControllerProvider.notifier)
          .applyFilters(applied);
    }
  }

  Widget _filterHeading(String label) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 8),
    child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
  );

  List<Widget> _chips(ShiftSearchFilters filters) => [
    ...filters.roles.map(
      (value) => _chip(
        clinicalRoleToApi(value),
        () => filters.copyWith(
          roles: filters.roles.where((item) => item != value).toList(),
        ),
      ),
    ),
    ...filters.facilityTypes.map(
      (value) => _chip(
        readableEnum(facilityTypeToApi(value)),
        () => filters.copyWith(
          facilityTypes: filters.facilityTypes
              .where((item) => item != value)
              .toList(),
        ),
      ),
    ),
    ...filters.shiftTypes.map(
      (value) => _chip(
        readableEnum(shiftSearchPeriodToApi(value)),
        () => filters.copyWith(
          shiftTypes: filters.shiftTypes
              .where((item) => item != value)
              .toList(),
        ),
      ),
    ),
    if (filters.radiusKm != null)
      _chip(
        '${filters.radiusKm!.toStringAsFixed(0)} km',
        () => filters.copyWith(clearRadius: true),
      ),
    if (filters.maxShiftHours != null)
      _chip(
        'Up to ${filters.maxShiftHours!.toStringAsFixed(0)}h',
        () => filters.copyWith(clearMaxHours: true),
      ),
    if (filters.minHourlyRate != null)
      _chip(
        '\$${filters.minHourlyRate!.toStringAsFixed(0)}+/hr',
        () => filters.copyWith(clearMinRate: true),
      ),
  ];

  Widget _chip(String label, ShiftSearchFilters Function() remove) => InputChip(
    label: Text(label),
    onDeleted: () =>
        ref.read(shiftBoardControllerProvider.notifier).applyFilters(remove()),
  );

  List<T> _toggle<T>(List<T> values, T value) => values.contains(value)
      ? values.where((item) => item != value).toList()
      : [...values, value];
}

class ShiftCard extends StatelessWidget {
  const ShiftCard({super.key, required this.shift, this.onTap});

  final ShiftSummary shift;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('MMM d · h:mm a').format(shift.startTime);
    final duration = _shiftDurationHours(shift);
    final estimatedPay = duration * shift.hourlyRate;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 42,
                    width: 42,
                    decoration: BoxDecoration(
                      color: AppColors.navy,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      clinicalRoleToApi(shift.roleRequired),
                      style: const TextStyle(
                        color: AppColors.lightGold,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          shift.facilityName ?? 'Healthcare facility',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${readableEnum(clinicalRoleToApi(shift.roleRequired))} coverage',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(
                    label: readableEnum(_shiftStatusApi(shift.status)),
                    tone: _shiftStatusTone(shift.status),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ShiftMetaPill(
                    icon: Icons.calendar_today_outlined,
                    label: time,
                  ),
                  _ShiftMetaPill(
                    icon: Icons.schedule_outlined,
                    label: '$duration hr',
                  ),
                  _ShiftMetaPill(
                    icon: Icons.location_on_outlined,
                    label: shift.distanceKm == null
                        ? (shift.facilityCity ?? 'Calgary area')
                        : '${shift.distanceKm!.toStringAsFixed(1)} km',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.offWhite,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Colors.black.withValues(alpha: 0.05),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '\$${shift.hourlyRate.toStringAsFixed(0)}/hr',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '\$${estimatedPay.toStringAsFixed(0)} est.',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ShiftDetailsSheet extends StatelessWidget {
  const ShiftDetailsSheet({
    super.key,
    required this.shift,
    required this.canAccept,
    required this.alreadyApplied,
    required this.onAccept,
  });

  final ShiftSummary shift;
  final bool canAccept;
  final bool alreadyApplied;
  final Future<void> Function() onAccept;

  @override
  Widget build(BuildContext context) {
    final duration = shift.endTime.difference(shift.startTime).inHours;
    final safeDuration = _shiftDurationHours(shift);
    final estimatedPay = safeDuration * shift.hourlyRate;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        8,
        20,
        20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusPill(
                      label: readableEnum(_shiftStatusApi(shift.status)),
                      tone: _shiftStatusTone(shift.status),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      shift.facilityName ?? 'Shift details',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${readableEnum(clinicalRoleToApi(shift.roleRequired))} coverage',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              Text(
                '\$${estimatedPay.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ShiftDetailGrid(
            items: [
              ('Start', DateFormat.yMMMd().add_jm().format(shift.startTime)),
              ('Duration', '${duration <= 0 ? safeDuration : duration} hours'),
              ('Rate', '\$${shift.hourlyRate.toStringAsFixed(0)}/hr'),
              ('Location', shift.facilityCity ?? 'Calgary area'),
            ],
          ),
          if (shift.facilityRating != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: StatusPill(
                label:
                    'Facility ${shift.facilityRating!.toStringAsFixed(1)} rating',
                tone: AppColors.navy,
              ),
            ),
          const SizedBox(height: 16),
          Text(
            shift.description ??
                'Facility details and arrival notes will appear here when available.',
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: canAccept && !alreadyApplied ? onAccept : null,
            child: Text(
              alreadyApplied
                  ? 'Application submitted'
                  : canAccept
                  ? 'Apply for shift'
                  : 'Approval required',
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftMetaPill extends StatelessWidget {
  const _ShiftMetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.navy.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppColors.navy),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftDetailGrid extends StatelessWidget {
  const _ShiftDetailGrid({required this.items});

  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      childAspectRatio: 2.45,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: items
          .map(
            (item) => Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    item.$1,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class ShiftMapFallback extends ConsumerWidget {
  const ShiftMapFallback({super.key, required this.shifts});

  final List<ShiftSummary> shifts;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(appConfigProvider).hasMapboxToken && shifts.isNotEmpty) {
      return _NativeShiftMap(shifts: shifts);
    }
    return Card(
      child: SizedBox(
        height: 320,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Map view',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              const Text(
                'Add MAPBOX_ACCESS_TOKEN to render native shift pins. Coordinates remain visible as a fallback.',
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView(
                  children: shifts
                      .map(
                        (shift) => ListTile(
                          leading: const Icon(Icons.place_outlined),
                          title: Text(shift.facilityName ?? 'Open shift'),
                          subtitle: Text(
                            '${shift.location.latitude}, ${shift.location.longitude}',
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NativeShiftMap extends StatefulWidget {
  const _NativeShiftMap({required this.shifts});

  final List<ShiftSummary> shifts;

  @override
  State<_NativeShiftMap> createState() => _NativeShiftMapState();
}

class _NativeShiftMapState extends State<_NativeShiftMap> {
  PointAnnotationManager? _annotations;

  @override
  Widget build(BuildContext context) {
    final first = widget.shifts.first.location;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: 320,
        child: MapWidget(
          key: const ValueKey('shift-mapbox-map'),
          viewport: CameraViewportState(
            center: Point(
              coordinates: Position(first.longitude, first.latitude),
            ),
            zoom: 10,
          ),
          onMapCreated: _createPins,
        ),
      ),
    );
  }

  Future<void> _createPins(MapboxMap map) async {
    _annotations = await map.annotations.createPointAnnotationManager();
    final bytes = await rootBundle.load('assets/brand/brand-logo-icon.png');
    if (!mounted) return;
    await _annotations?.createMulti(
      widget.shifts
          .map(
            (shift) => PointAnnotationOptions(
              geometry: Point(
                coordinates: Position(
                  shift.location.longitude,
                  shift.location.latitude,
                ),
              ),
              image: bytes.buffer.asUint8List(),
              iconSize: 0.12,
              textField: shift.facilityName ?? 'Open shift',
              textOffset: const [0, 2.1],
              textSize: 12,
              textColor: AppColors.navy.toARGB32(),
              textHaloColor: Colors.white.toARGB32(),
              textHaloWidth: 1.5,
            ),
          )
          .toList(),
    );
  }
}

class _EmptyBoard extends StatelessWidget {
  const _EmptyBoard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Text(
          'No nearby open shifts are available yet. Pull to refresh.',
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

int _shiftDurationHours(ShiftSummary shift) {
  final hours = shift.endTime.difference(shift.startTime).inHours;
  return hours <= 0 ? 1 : hours;
}

String _shiftStatusApi(ShiftStatus status) {
  return shiftStatusToApi(status);
}

Color _shiftStatusTone(ShiftStatus status) {
  return switch (status) {
    ShiftStatus.cancelled => AppColors.danger,
    ShiftStatus.disputed => AppColors.danger,
    ShiftStatus.completed => AppColors.success,
    ShiftStatus.facilityApproved => AppColors.success,
    ShiftStatus.paid => AppColors.success,
    ShiftStatus.open => AppColors.gold,
    ShiftStatus.published => AppColors.gold,
    ShiftStatus.matching => AppColors.gold,
    _ => AppColors.navy,
  };
}
