import 'client.dart';

/// `auth/customer/delete-account`'s answer. [signInKept] when the person's
/// sign-in stays because another business or a team still uses it.
class AccountDeleted {
  const AccountDeleted({required this.deleted, required this.signInKept});

  factory AccountDeleted.fromJson(Map<String, dynamic> json) => AccountDeleted(
        deleted: json['deleted'] == true,
        signInKept: json['signInKept'] == true,
      );

  final bool deleted;
  final bool signInKept;
}

/// The signed-in customer's own account with the business.
extension BdCustomerAccount on BdClient {
  /// Deletes the signed-in customer's account with this business: their
  /// customer record, applications, settings and cart, and their sign-in
  /// unless another business still uses it. Orders and invoices stay with the
  /// business. The token stops working. Google Play and the App Store both
  /// require every app that makes accounts to offer this in the app.
  ///
  /// Throws `BdHttpException` with status 401 when the session has already
  /// expired: sign in again, then delete.
  Future<AccountDeleted> deleteAccount(String sessionToken) async =>
      AccountDeleted.fromJson(
        await post('auth/customer/delete-account',
            headers: {'x-bd-session': sessionToken}),
      );
}
