import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/state/auth_controller.dart';
import '../data/account_settings_repository.dart';

class NotificationPreferencesSection extends ConsumerStatefulWidget {
  const NotificationPreferencesSection({super.key});
  @override
  ConsumerState<NotificationPreferencesSection> createState() =>
      _NotificationPreferencesSectionState();
}

class _NotificationPreferencesSectionState
    extends ConsumerState<NotificationPreferencesSection> {
  Map<String, NotificationChannels>? _preferences;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final value = await ref
          .read(accountSettingsRepositoryProvider)
          .notificationPreferences();
      if (mounted) {
        setState(() {
          _preferences = value;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = apiErrorMessage(
            error,
            'Notification preferences could not be loaded.',
          ),
        );
      }
    }
  }

  Future<void> _toggle(String category, {bool? inApp, bool? email}) async {
    if (_saving || category == 'ACCOUNT_AND_SECURITY') return;
    final previous = _preferences!;
    final next = Map<String, NotificationChannels>.from(previous)
      ..[category] = previous[category]!.copyWith(inApp: inApp, email: email);
    setState(() {
      _preferences = next;
      _saving = true;
    });
    try {
      final saved = await ref
          .read(accountSettingsRepositoryProvider)
          .updateNotificationPreferences(next);
      if (mounted) {
        setState(() => _preferences = saved);
        showAppSnack(context, 'Notification preferences saved.');
      }
    } catch (error) {
      if (mounted) {
        setState(() => _preferences = previous);
        showAppSnack(
          context,
          apiErrorMessage(error, 'That preference could not be saved.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_preferences == null && _error == null) {
      return const _SettingsLoadingCard(
        label: 'Loading notification preferences…',
      );
    }
    if (_error != null) {
      return _SettingsErrorCard(message: _error!, onRetry: _load);
    }
    const rows = [
      (
        'SHIFT_OPPORTUNITIES',
        'Shift opportunities',
        'Nearby shifts matching your role and area.',
      ),
      (
        'SHIFT_UPDATES',
        'Applications and assignments',
        'Application, invitation, and assignment updates.',
      ),
      (
        'SCHEDULE_AND_TIMESHEETS',
        'Schedule and timesheets',
        'Attendance and timesheet activity.',
      ),
      (
        'REVIEWS_AND_DISPUTES',
        'Reviews and disputes',
        'Feedback and dispute updates.',
      ),
      (
        'ACCOUNT_AND_SECURITY',
        'Account and security',
        'Verification, password, and security alerts.',
      ),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              caption: 'Choose where you receive optional updates.',
            ),
            const Divider(height: 26),
            for (final row in rows) ...[
              _NotificationRow(
                title: row.$2,
                description: row.$3,
                channels: _preferences![row.$1]!,
                mandatory: row.$1 == 'ACCOUNT_AND_SECURITY',
                disabled: _saving,
                onInApp: (value) => _toggle(row.$1, inApp: value),
                onEmail: (value) => _toggle(row.$1, email: value),
              ),
              if (row != rows.last) const Divider(height: 22),
            ],
          ],
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.title,
    required this.description,
    required this.channels,
    required this.mandatory,
    required this.disabled,
    required this.onInApp,
    required this.onEmail,
  });
  final String title, description;
  final NotificationChannels channels;
  final bool mandatory, disabled;
  final ValueChanged<bool> onInApp, onEmail;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      const SizedBox(height: 3),
      Text(
        description,
        style: const TextStyle(color: AppColors.muted, fontSize: 12),
      ),
      if (mandatory)
        const Padding(
          padding: EdgeInsets.only(top: 5),
          child: Text(
            'Always on for your protection',
            style: TextStyle(
              color: AppColors.gold,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      const SizedBox(height: 8),
      Row(
        children: [
          Expanded(
            child: _ChannelSwitch(
              label: 'In app',
              value: channels.inApp,
              onChanged: mandatory || disabled ? null : onInApp,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _ChannelSwitch(
              label: 'Email',
              value: channels.email,
              onChanged: mandatory || disabled ? null : onEmail,
            ),
          ),
        ],
      ),
    ],
  );
}

class _ChannelSwitch extends StatelessWidget {
  const _ChannelSwitch({
    required this.label,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.only(left: 10),
    decoration: BoxDecoration(
      border: Border.all(color: Colors.black12),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ),
        Switch.adaptive(value: value, onChanged: onChanged),
      ],
    ),
  );
}

class AccountSecuritySection extends ConsumerStatefulWidget {
  const AccountSecuritySection({super.key});
  @override
  ConsumerState<AccountSecuritySection> createState() =>
      _AccountSecuritySectionState();
}

class _AccountSecuritySectionState
    extends ConsumerState<AccountSecuritySection> {
  TwoFactorAccountStatus? _status;
  List<TrustedDevice> _devices = const [];
  String? _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final repository = ref.read(accountSettingsRepositoryProvider);
      final values = await Future.wait([
        repository.twoFactorStatus(),
        repository.trustedDevices(),
      ]);
      if (mounted) {
        setState(() {
          _status = values[0] as TwoFactorAccountStatus;
          _devices = values[1] as List<TrustedDevice>;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = apiErrorMessage(
            error,
            'Security settings could not be loaded.',
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_status == null && _error == null) {
      return const _SettingsLoadingCard(label: 'Loading security settings…');
    }
    if (_error != null) {
      return _SettingsErrorCard(message: _error!, onRetry: _load);
    }
    final status = _status!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.shield_outlined,
              title: 'Security',
              caption: 'Protect your account and manage signed-in devices.',
            ),
            const Divider(height: 26),
            const _SecurityGroupLabel('SIGN-IN SECURITY'),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.password_outlined),
              title: const Text('Password'),
              subtitle: const Text('Use a unique password for MedShift.'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _busy ? null : _changePassword,
            ),
            const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.phonelink_lock_outlined),
              title: const Text('Two-factor authentication'),
              subtitle: Text(
                status.enabled
                    ? '${status.method == TwoFactorMethod.email ? 'Email codes' : 'Authenticator app'} · ${status.recoveryCodesRemaining} recovery codes'
                    : 'Add a second check when you sign in.',
              ),
              trailing: Chip(label: Text(status.enabled ? 'On' : 'Off')),
              onTap: _busy ? null : _configureTwoFactor,
            ),
            if (status.enabled)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(
                  spacing: 8,
                  children: [
                    TextButton.icon(
                      onPressed: _busy ? null : _regenerateCodes,
                      icon: const Icon(Icons.refresh),
                      label: const Text('New recovery codes'),
                    ),
                    TextButton.icon(
                      onPressed: _busy ? null : _disableTwoFactor,
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Disable'),
                    ),
                  ],
                ),
              ),
            const Divider(),
            const _SecurityGroupLabel('TRUSTED DEVICES'),
            const SizedBox(height: 4),
            const Text(
              'A trusted device can skip the second factor for 30 days after a correct password.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            if (_devices.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Text(
                  'No trusted devices.',
                  style: TextStyle(color: AppColors.muted),
                ),
              )
            else
              ..._devices.map(
                (device) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.devices_outlined),
                  title: Text(device.label),
                  subtitle: Text(
                    'Last used ${DateFormat.yMMMd().format(device.lastUsedAt)}',
                  ),
                  trailing: IconButton(
                    onPressed: _busy ? null : () => _revokeDevice(device.id),
                    icon: const Icon(Icons.close),
                    tooltip: 'Remove trusted device',
                  ),
                ),
              ),
            if (_devices.isNotEmpty)
              OutlinedButton(
                onPressed: _busy ? null : () => _revokeDevice(null),
                child: const Text('Remove all trusted devices'),
              ),
            const Divider(height: 28),
            const _SecurityGroupLabel('SESSIONS'),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _logoutAll,
              icon: const Icon(Icons.logout),
              label: const Text('Sign out on all devices'),
            ),
          ],
        ),
      ),
    );
  }

  Future<Map<String, String>?> _credentialsSheet({
    required String title,
    bool includeNewPassword = false,
    bool includeCode = true,
    TwoFactorMethod? initialMethod,
  }) async {
    if (includeCode && _status?.method == TwoFactorMethod.email) {
      try {
        await ref
            .read(accountSettingsRepositoryProvider)
            .sendTwoFactorManagementCode();
        if (mounted) {
          showAppSnack(context, 'A security code was sent to your email.');
        }
      } catch (error) {
        if (mounted) {
          showAppSnack(
            context,
            apiErrorMessage(error, 'Security code could not be sent.'),
            isError: true,
          );
        }
        return null;
      }
    }
    if (!mounted) return null;
    return showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => SecurityCredentialsSheet(
        title: title,
        includeCode: includeCode,
        includeNewPassword: includeNewPassword,
        initialMethod: initialMethod,
      ),
    );
  }

  Future<void> _configureTwoFactor() async {
    final values = await _credentialsSheet(
      title: _status!.enabled
          ? 'Switch two-factor method'
          : 'Enable two-factor authentication',
      includeCode: _status!.enabled,
      initialMethod: _status?.method ?? TwoFactorMethod.totp,
    );
    if (values == null) return;
    final method = values['method'] == 'email'
        ? TwoFactorMethod.email
        : TwoFactorMethod.totp;
    await _run(() async {
      final setup = await ref
          .read(accountSettingsRepositoryProvider)
          .beginTwoFactorSetup(
            method: method,
            currentPassword: values['password']!,
            currentCode: values['code'],
          );
      if (!mounted) return;
      final code = await _setupVerificationSheet(setup);
      if (code == null) return;
      final recoveryCodes = await ref
          .read(accountSettingsRepositoryProvider)
          .verifyTwoFactorSetup(setup.id, code);
      if (!mounted) return;
      await _showRecoveryCodes(recoveryCodes);
      await _load();
    });
  }

  Future<String?> _setupVerificationSheet(TwoFactorSetup setup) =>
      showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        useSafeArea: true,
        builder: (sheetContext) => SecurityVerificationSheet(setup: setup),
      );

  Future<void> _showRecoveryCodes(List<String> codes) =>
      showModalBottomSheet<void>(
        context: context,
        isDismissible: false,
        enableDrag: false,
        isScrollControlled: true,
        showDragHandle: true,
        useSafeArea: true,
        builder: (sheetContext) => RecoveryCodesSheet(codes: codes),
      );

  Future<void> _changePassword() async {
    final values = await _credentialsSheet(
      title: 'Change password',
      includeNewPassword: true,
      includeCode: false,
    );
    if (values == null) return;
    await _run(() async {
      await ref
          .read(accountSettingsRepositoryProvider)
          .changePassword(values['password']!, values['newPassword']!);
      if (mounted) {
        showAppSnack(context, 'Password updated. Sign in again.');
        await ref.read(authControllerProvider.notifier).logout();
        if (mounted) context.go('/login');
      }
    });
  }

  Future<void> _disableTwoFactor() async {
    final values = await _credentialsSheet(
      title: 'Disable two-factor authentication',
    );
    if (values == null) return;
    await _run(() async {
      await ref
          .read(accountSettingsRepositoryProvider)
          .disableTwoFactor(values['password']!, values['code']!);
      await _load();
      if (mounted) showAppSnack(context, 'Two-factor authentication disabled.');
    });
  }

  Future<void> _regenerateCodes() async {
    final values = await _credentialsSheet(
      title: 'Generate new recovery codes',
    );
    if (values == null) return;
    await _run(() async {
      final codes = await ref
          .read(accountSettingsRepositoryProvider)
          .regenerateRecoveryCodes(values['password']!, values['code']!);
      if (mounted) await _showRecoveryCodes(codes);
      await _load();
    });
  }

  Future<void> _revokeDevice(String? id) async {
    final confirmed = await _confirmSecurityAction(
      title: id == null ? 'Remove all trusted devices?' : 'Remove this device?',
      message: id == null
          ? 'Every trusted device will require two-factor verification at the next sign-in.'
          : 'This device will require two-factor verification at the next sign-in.',
      actionLabel: id == null ? 'Remove all devices' : 'Remove device',
    );
    if (!confirmed) return;
    await _run(() async {
      await ref.read(accountSettingsRepositoryProvider).revokeTrustedDevice(id);
      await _load();
      if (mounted) {
        showAppSnack(
          context,
          id == null
              ? 'All trusted devices removed.'
              : 'Trusted device removed.',
        );
      }
    });
  }

  Future<void> _logoutAll() async {
    final confirmed = await _confirmSecurityAction(
      title: 'Sign out on all devices?',
      message:
          'All MedShift sessions, including this one, will end immediately.',
      actionLabel: 'Sign out everywhere',
    );
    if (!confirmed) return;
    await _run(() async {
      await ref.read(accountSettingsRepositoryProvider).logoutAll();
      await ref.read(authControllerProvider.notifier).logout();
      if (mounted) context.go('/login');
    });
  }

  Future<bool> _confirmSecurityAction({
    required String title,
    required String message,
    required String actionLabel,
  }) async =>
      (await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        useSafeArea: true,
        builder: (sheetContext) => SecurityConfirmationSheet(
          title: title,
          message: message,
          actionLabel: actionLabel,
        ),
      )) ??
      false;
  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Security settings could not be updated.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class SecurityCredentialsSheet extends StatefulWidget {
  const SecurityCredentialsSheet({
    super.key,
    required this.title,
    required this.includeCode,
    required this.includeNewPassword,
    this.initialMethod,
  });

  final String title;
  final bool includeCode;
  final bool includeNewPassword;
  final TwoFactorMethod? initialMethod;

  @override
  State<SecurityCredentialsSheet> createState() =>
      _SecurityCredentialsSheetState();
}

class _SecurityCredentialsSheetState extends State<SecurityCredentialsSheet> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  late TwoFactorMethod _method;
  bool _showCurrentPassword = false;
  bool _showNewPassword = false;
  bool _showConfirmPassword = false;

  @override
  void initState() {
    super.initState();
    _method = widget.initialMethod ?? TwoFactorMethod.totp;
  }

  @override
  void dispose() {
    _password.dispose();
    _code.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedPadding(
    duration: const Duration(milliseconds: 180),
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SheetHeader(
              icon: widget.includeNewPassword
                  ? Icons.password_outlined
                  : Icons.phonelink_lock_outlined,
              title: widget.title,
              caption: widget.includeNewPassword
                  ? 'Confirm your current password, then choose a new one.'
                  : 'Confirm your identity before changing account security.',
            ),
            if (widget.initialMethod != null) ...[
              const SizedBox(height: 20),
              const Text(
                'Verification method',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<TwoFactorMethod>(
                  segments: const [
                    ButtonSegment(
                      value: TwoFactorMethod.totp,
                      label: Text('Authenticator'),
                      icon: Icon(Icons.key_outlined),
                    ),
                    ButtonSegment(
                      value: TwoFactorMethod.email,
                      label: Text('Email'),
                      icon: Icon(Icons.email_outlined),
                    ),
                  ],
                  selected: {_method},
                  onSelectionChanged: (value) =>
                      setState(() => _method = value.first),
                ),
              ),
            ],
            const SizedBox(height: 18),
            TextFormField(
              key: const ValueKey('security-current-password'),
              controller: _password,
              obscureText: !_showCurrentPassword,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: 'Current password',
                suffixIcon: IconButton(
                  onPressed: () => setState(
                    () => _showCurrentPassword = !_showCurrentPassword,
                  ),
                  tooltip: _showCurrentPassword
                      ? 'Hide password'
                      : 'Show password',
                  icon: Icon(
                    _showCurrentPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                  ),
                ),
              ),
              validator: (value) => value == null || value.isEmpty
                  ? 'Enter your current password.'
                  : null,
            ),
            if (widget.includeCode) ...[
              const SizedBox(height: 14),
              TextFormField(
                key: const ValueKey('security-current-code'),
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Current 2FA or recovery code',
                  helperText: 'Use your current factor or a recovery code.',
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Enter your verification code.'
                    : null,
              ),
            ],
            if (widget.includeNewPassword) ...[
              const SizedBox(height: 14),
              TextFormField(
                key: const ValueKey('security-new-password'),
                controller: _newPassword,
                obscureText: !_showNewPassword,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'New password',
                  helperText: 'Use at least 8 characters.',
                  suffixIcon: IconButton(
                    onPressed: () =>
                        setState(() => _showNewPassword = !_showNewPassword),
                    tooltip: _showNewPassword
                        ? 'Hide password'
                        : 'Show password',
                    icon: Icon(
                      _showNewPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                ),
                validator: (value) => value == null || value.length < 8
                    ? 'Use at least 8 characters.'
                    : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                key: const ValueKey('security-confirm-password'),
                controller: _confirmPassword,
                obscureText: !_showConfirmPassword,
                autofillHints: const [AutofillHints.newPassword],
                decoration: InputDecoration(
                  labelText: 'Confirm new password',
                  suffixIcon: IconButton(
                    onPressed: () => setState(
                      () => _showConfirmPassword = !_showConfirmPassword,
                    ),
                    tooltip: _showConfirmPassword
                        ? 'Hide password'
                        : 'Show password',
                    icon: Icon(
                      _showConfirmPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                ),
                validator: (value) => value != _newPassword.text
                    ? 'Passwords do not match.'
                    : null,
              ),
            ],
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                key: const ValueKey('security-sheet-continue'),
                onPressed: _submit,
                child: Text(
                  widget.includeNewPassword ? 'Update password' : 'Continue',
                ),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(context, {
      'password': _password.text,
      'code': _code.text.trim(),
      'newPassword': _newPassword.text,
      'method': _method.name,
    });
  }
}

class SecurityVerificationSheet extends StatefulWidget {
  const SecurityVerificationSheet({super.key, required this.setup});

  final TwoFactorSetup setup;

  @override
  State<SecurityVerificationSheet> createState() =>
      _SecurityVerificationSheetState();
}

class _SecurityVerificationSheetState extends State<SecurityVerificationSheet> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedPadding(
    duration: const Duration(milliseconds: 180),
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SheetHeader(
              icon: Icons.verified_user_outlined,
              title: 'Verify your setup',
              caption: 'Enter a fresh six-digit code to finish enabling 2FA.',
            ),
            const SizedBox(height: 18),
            if (widget.setup.otpauthUri != null) ...[
              Center(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: QrImageView(
                      data: widget.setup.otpauthUri!,
                      size: 190,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Scan this QR code with your authenticator app, or enter the key manually.',
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SelectableText(
                  widget.setup.manualKey ?? '',
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ] else
              Text(
                'Enter the code sent to ${widget.setup.maskedEmail ?? 'your email'}.',
              ),
            const SizedBox(height: 16),
            TextFormField(
              key: const ValueKey('security-setup-code'),
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                labelText: 'Six-digit code',
                counterText: '',
              ),
              validator: (value) => value?.trim().length == 6
                  ? null
                  : 'Enter the complete six-digit code.',
              onFieldSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                key: const ValueKey('security-verify-setup'),
                onPressed: _submit,
                child: const Text('Verify and enable'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel setup'),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(context, _code.text.trim());
  }
}

class RecoveryCodesSheet extends StatelessWidget {
  const RecoveryCodesSheet({super.key, required this.codes});

  final List<String> codes;

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SheetHeader(
            icon: Icons.key_outlined,
            title: 'Save your recovery codes',
            caption:
                'Each code works once and will not be shown again. Store them somewhere safe.',
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: codes
                  .map(
                    (code) => SizedBox(
                      width: 130,
                      child: SelectableText(
                        code,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: codes.join('\n')));
                if (context.mounted) {
                  showAppSnack(context, 'Recovery codes copied.');
                }
              },
              icon: const Icon(Icons.copy_outlined),
              label: const Text('Copy all codes'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              key: const ValueKey('recovery-codes-saved'),
              onPressed: () => Navigator.pop(context),
              child: const Text('I saved them'),
            ),
          ),
        ],
      ),
    ),
  );
}

class SecurityConfirmationSheet extends StatelessWidget {
  const SecurityConfirmationSheet({
    super.key,
    required this.title,
    required this.message,
    required this.actionLabel,
  });

  final String title;
  final String message;
  final String actionLabel;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SheetHeader(
          icon: Icons.warning_amber_rounded,
          title: title,
          caption: message,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(actionLabel),
          ),
        ),
        SizedBox(
          width: double.infinity,
          child: TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
        ),
      ],
    ),
  );
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({
    required this.icon,
    required this.title,
    required this.caption,
  });

  final IconData icon;
  final String title;
  final String caption;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppColors.navy),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(
              caption,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    ],
  );
}

class _SecurityGroupLabel extends StatelessWidget {
  const _SecurityGroupLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: const TextStyle(
      color: AppColors.muted,
      fontSize: 11,
      fontWeight: FontWeight.w900,
      letterSpacing: 0.8,
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.title,
    required this.caption,
  });
  final IconData icon;
  final String title, caption;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, color: AppColors.navy),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 3),
            Text(
              caption,
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    ],
  );
}

class _SettingsLoadingCard extends StatelessWidget {
  const _SettingsLoadingCard({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 12),
          Text(label),
        ],
      ),
    ),
  );
}

class _SettingsErrorCard extends StatelessWidget {
  const _SettingsErrorCard({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    ),
  );
}
