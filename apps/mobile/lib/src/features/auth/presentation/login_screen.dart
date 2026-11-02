import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import 'auth_page_layout.dart';
import '../state/auth_controller.dart';
import '../../../core/models/medshift_models.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _securityCode = TextEditingController();
  bool _obscure = true;
  bool _trustDevice = true;
  bool _useRecoveryCode = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _securityCode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final challenge = auth.value?.twoFactorChallenge;

    return AuthPageLayout(
      title: challenge == null ? 'Worker sign in' : 'Security check',
      caption: challenge == null
          ? 'Access your shift board, onboarding status, and caregiver settings.'
          : _useRecoveryCode
          ? 'Enter one of your unused recovery codes.'
          : challenge.method == TwoFactorMethod.email
          ? 'Enter the code sent to ${challenge.maskedEmail ?? 'your email'}.'
          : 'Enter the current code from your authenticator app.',
      children: [
        if (challenge != null) ...[
          TextField(
            controller: _securityCode,
            autofocus: true,
            keyboardType: _useRecoveryCode
                ? TextInputType.text
                : TextInputType.number,
            maxLength: _useRecoveryCode ? 20 : 6,
            autofillHints: const [AutofillHints.oneTimeCode],
            decoration: InputDecoration(
              labelText: _useRecoveryCode ? 'Recovery code' : 'Security code',
              counterText: '',
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _trustDevice,
            onChanged: (value) => setState(() => _trustDevice = value ?? true),
            title: const Text('Trust this device for 30 days'),
            subtitle: const Text('Only use this on a personal device.'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: auth.isLoading ? null : _verifyTwoFactor,
            child: auth.isLoading
                ? const CircularProgressIndicator()
                : const Text('Verify and sign in'),
          ),
          if (challenge.method == TwoFactorMethod.email && !_useRecoveryCode)
            TextButton(
              onPressed: auth.isLoading ? null : _resendTwoFactor,
              child: const Text('Resend email code'),
            ),
          TextButton(
            onPressed: () => setState(() {
              _useRecoveryCode = !_useRecoveryCode;
              _securityCode.clear();
            }),
            child: Text(
              _useRecoveryCode ? 'Use security code' : 'Use a recovery code',
            ),
          ),
          TextButton(
            onPressed: () {
              ref.read(authControllerProvider.notifier).cancelTwoFactor();
              _securityCode.clear();
            },
            child: const Text('Back to sign in'),
          ),
        ] else ...[
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _password,
            obscureText: _obscure,
            decoration: InputDecoration(
              labelText: 'Password',
              suffixIcon: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => context.go('/forgot-password'),
              child: const Text('Forgot password?'),
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: auth.isLoading ? null : _submit,
            child: auth.isLoading
                ? const CircularProgressIndicator()
                : const Text('Sign in'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => context.go('/register'),
            child: const Text('Create worker account'),
          ),
        ],
      ],
    );
  }

  Future<void> _submit() async {
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(_email.text, _password.text);
      final result = ref.read(authControllerProvider);
      if (result.hasError) throw result.error!;
      if (mounted && result.value?.isSignedIn == true) {
        context.go('/home');
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Unable to sign in.'),
          isError: true,
        );
      }
    }
  }

  Future<void> _verifyTwoFactor() async {
    final code = _securityCode.text.trim();
    if ((_useRecoveryCode && code.length < 8) ||
        (!_useRecoveryCode && !RegExp(r'^\d{6}$').hasMatch(code))) {
      showAppSnack(
        context,
        _useRecoveryCode
            ? 'Enter a valid recovery code.'
            : 'Enter the six-digit security code.',
        isError: true,
      );
      return;
    }
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyTwoFactor(code, trustDevice: _trustDevice);
      final result = ref.read(authControllerProvider);
      if (mounted && result.value?.isSignedIn == true) context.go('/home');
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Security code could not be verified.'),
          isError: true,
        );
      }
    }
  }

  Future<void> _resendTwoFactor() async {
    try {
      await ref.read(authControllerProvider.notifier).resendTwoFactor();
      if (mounted) showAppSnack(context, 'A new security code was sent.');
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Security code could not be resent.'),
          isError: true,
        );
      }
    }
  }
}
