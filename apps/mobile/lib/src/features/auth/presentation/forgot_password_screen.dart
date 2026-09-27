import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import 'auth_page_layout.dart';
import '../data/auth_repository.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  int _step = 0;
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    _otp.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AuthPageLayout(
      title: _step == 0
          ? 'Request reset code'
          : _step == 1
          ? 'Verify code'
          : 'Choose new password',
      caption: 'Use your email OTP to reset your MedShift worker password.',
      children: [
        if (_step == 0)
          TextField(
            controller: _email,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
        if (_step == 1)
          TextField(
            controller: _otp,
            decoration: const InputDecoration(labelText: 'Six digit code'),
          ),
        if (_step == 2)
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'New password'),
          ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _loading ? null : _next,
          child: _loading
              ? const CircularProgressIndicator()
              : Text(_step == 2 ? 'Reset password' : 'Continue'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.go('/login'),
          child: const Text('Back to sign in'),
        ),
      ],
    );
  }

  Future<void> _next() async {
    setState(() => _loading = true);
    try {
      final repository = ref.read(authRepositoryProvider);
      if (_step == 0) {
        await repository.requestPasswordReset(_email.text);
        setState(() => _step = 1);
      } else if (_step == 1) {
        await repository.verifyPasswordResetOtp(
          email: _email.text,
          otp: _otp.text,
        );
        setState(() => _step = 2);
      } else {
        await repository.resetPassword(
          email: _email.text,
          otp: _otp.text,
          password: _password.text,
        );
        if (mounted) {
          showAppSnack(
            context,
            'Password reset. Sign in with the new password.',
          );
          context.go('/login');
        }
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Password reset could not continue.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}
