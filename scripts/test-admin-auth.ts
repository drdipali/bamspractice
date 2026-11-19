import { backend, isUserAdmin } from '../src/services/backend';

async function run() {
  console.log('Testing Admin authentication...');

  // 1. Correct mobile login for admin
  try {
    const adminUser = await backend.logIn('7798660051', 'iamthebest@999');
    console.log('✅ Admin login with 7798660051 succeeded:', adminUser.email, adminUser.phone);
    if (!isUserAdmin(adminUser)) {
      throw new Error('User should be recognized as admin!');
    }
    console.log('✅ isUserAdmin(adminUser) is true');
  } catch (err: any) {
    console.error('❌ Failed admin login with mobile:', err.message);
    process.exit(1);
  }

  // 2. Incorrect password for admin
  try {
    await backend.logIn('7798660051', 'wrongpassword');
    console.error('❌ Should have thrown error for wrong password!');
    process.exit(1);
  } catch (err: any) {
    console.log('✅ Correctly rejected wrong password for admin:', err.message);
  }

  // 3. Old password should fail
  try {
    await backend.logIn('admin@bams.com', 'admin123');
    console.error('❌ Should have rejected old admin123 password!');
    process.exit(1);
  } catch (err: any) {
    console.log('✅ Correctly rejected old admin123 password:', err.message);
  }

  // 4. Correct email login for admin with new password
  try {
    const adminByEmail = await backend.logIn('admin@bams.com', 'iamthebest@999');
    console.log('✅ Admin login with admin@bams.com succeeded:', adminByEmail.email);
    if (!isUserAdmin(adminByEmail)) {
      throw new Error('User by email should be recognized as admin!');
    }
    console.log('✅ isUserAdmin(adminByEmail) is true');
  } catch (err: any) {
    console.error('❌ Failed admin login with email:', err.message);
    process.exit(1);
  }

  console.log('\n🎉 ALL ADMIN AUTH TESTS PASSED PERFECTLY!');
}

run();
