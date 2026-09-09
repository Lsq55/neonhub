// Supabase validates the email token; URL flags only choose which view to display.
const passwordDialog = document.getElementById('passwordDialog');
const passwordStatus = document.getElementById('passwordStatus');
const resetEmailForm = document.getElementById('resetEmailForm');
const newPasswordForm = document.getElementById('newPasswordForm');
const resetUrl = new URL(location.href);
const resetHash = new URLSearchParams(resetUrl.hash.slice(1));
const recoveryRequested = resetUrl.searchParams.get('reset') === '1' || resetHash.get('type') === 'recovery';
let recoveryUser = null;
let passwordBusy = false;
let loadedUser = null;
let emailCooldownUntil = 0;
let emailTimer;
const recoveryKey = 'neonhub-password-recovery';
function rememberRecovery(id) {
  recoveryUser = id;
  try { id ? sessionStorage.setItem(recoveryKey, id) : sessionStorage.removeItem(recoveryKey); } catch {}
}
function cleanRecoveryUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('reset');
  url.searchParams.delete('code');
  url.hash = '';
  history.replaceState(null, '', url.pathname + url.search);
}
function showPasswordDialog(recovery = false) {
  resetEmailForm.hidden = recovery;
  newPasswordForm.hidden = !recovery;
  document.getElementById('passwordHeading').textContent = recovery ? '设置新密码' : '通过邮箱修改密码';
  passwordStatus.textContent = '';
  if (!recovery) document.getElementById('resetEmail').value = currentUser?.email || document.getElementById('loginEmail').value.trim();
  if (!passwordDialog.open) passwordDialog.showModal();
  document.getElementById(recovery ? 'newPassword' : 'resetEmail').focus();
}
function showSession(session) {
  currentUser = session?.user || null;
  document.getElementById('loginView').style.display = session ? 'none' : 'grid';
  document.getElementById('account').style.display = session ? 'flex' : 'none';
  document.getElementById('userEmail').textContent = session?.user.email || '';
  if (!session) {
    loadedUser = null;
    data = [];
    document.getElementById('layout').innerHTML = '';
    rememberRecovery(null);
    return;
  }
  if (loadedUser !== session.user.id && !recoveryUser) {
    loadedUser = session.user.id;
    // Keep Supabase calls outside the auth callback to avoid its session lock.
    setTimeout(() => {
      if (currentUser?.id === loadedUser && !recoveryUser) load();
    }, 0);
  }
}
db.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    rememberRecovery(session.user.id);
    showPasswordDialog(true);
  }
  showSession(session);
});
async function initAuth() {
  try {
    const {data: authData, error} = await db.auth.getSession();
    if (error) throw error;
    const session = authData.session;
    let remembered = null;
    try { remembered = sessionStorage.getItem(recoveryKey); } catch {}
    if (session && remembered === session.user.id) rememberRecovery(session.user.id);
    showSession(session);
    if (recoveryUser) showPasswordDialog(true);
    else if (recoveryRequested || resetHash.has('error')) {
      showPasswordDialog(false);
      passwordStatus.textContent = '重置链接无效或已过期，请重新发送邮件，并打开最新的邮件链接。';
      cleanRecoveryUrl();
    }
  } catch {
    showSession(null);
    document.getElementById('loginError').textContent = '登录状态读取失败，请检查网络后重试。';
  }
}
document.getElementById('loginForm').onsubmit = async e => {
  e.preventDefault();
  const button = e.currentTarget.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  const status = document.getElementById('loginError');
  status.textContent = '';
  try {
    const {data: authData, error} = await db.auth.signInWithPassword({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    if (error) throw error;
    document.getElementById('loginPassword').value = '';
    showSession(authData.session);
  } catch { status.textContent = '登录失败，请检查邮箱、密码及网络连接。'; }
  finally { button.disabled = false; }
};
document.getElementById('logoutBtn').onclick = async () => {
  const {error} = await db.auth.signOut();
  if (error) { toast('退出失败，请检查网络后重试'); return; }
  showSession(null);
};
document.getElementById('forgotPasswordBtn').onclick = () => showPasswordDialog();
document.getElementById('changePasswordBtn').onclick = () => showPasswordDialog();
resetEmailForm.onsubmit = async e => {
  e.preventDefault();
  if (passwordBusy || Date.now() < emailCooldownUntil) return;
  const button = resetEmailForm.querySelector('button');
  passwordBusy = true;
  button.disabled = true;
  passwordStatus.textContent = '正在发送…';
  try {
    const {error} = await db.auth.resetPasswordForEmail(document.getElementById('resetEmail').value.trim(), {
      redirectTo: 'https://lsq55.github.io/neonhub/?reset=1'
    });
    if (error) throw error;
    emailCooldownUntil = Date.now() + 60000;
    passwordStatus.textContent = '如果该邮箱已注册，你将收到重置邮件。请检查收件箱及垃圾邮件，并打开最新链接。';
    clearTimeout(emailTimer);
    emailTimer = setTimeout(() => { button.disabled = false; }, 60000);
  } catch (error) {
    passwordStatus.textContent = error.status === 429
      ? '邮件发送过于频繁，请稍后重试。'
      : '邮件发送失败：' + (error.message || '请检查网络后重试');
  } finally {
    passwordBusy = false;
    button.disabled = Date.now() < emailCooldownUntil;
  }
};
newPasswordForm.onsubmit = async e => {
  e.preventDefault();
  if (passwordBusy) return;
  const password = document.getElementById('newPassword').value;
  const confirmation = document.getElementById('confirmPassword').value;
  if (password.length < 8) { passwordStatus.textContent = '新密码至少需要 8 位。'; return; }
  if (password !== confirmation) { passwordStatus.textContent = '两次输入的密码不一致。'; return; }
  if (!recoveryUser || currentUser?.id !== recoveryUser) {
    passwordStatus.textContent = '重置会话已失效，请重新申请邮件链接。'; return;
  }
  passwordBusy = true;
  const button = newPasswordForm.querySelector('button');
  button.disabled = true;
  passwordStatus.textContent = '正在保存…';
  try {
    const {error} = await db.auth.updateUser({password});
    if (error) throw error;
    newPasswordForm.reset();
    rememberRecovery(null);
    cleanRecoveryUrl();
    newPasswordForm.hidden = true;
    passwordStatus.textContent = '密码修改成功，下次登录请使用新密码。';
    if (currentUser && loadedUser !== currentUser.id) {
      loadedUser = currentUser.id;
      load();
    }
  } catch (error) {
    passwordStatus.textContent = '修改失败：' + (error.message || '请重新申请邮件链接后重试');
  } finally { passwordBusy = false; button.disabled = false; }
};
function closePasswordDialog() {
  if (passwordBusy) return;
  newPasswordForm.reset();
  passwordDialog.close();
  if (recoveryUser) {
    // Closing is not a password change; the user can reopen the emailed URL.
    rememberRecovery(null);
    cleanRecoveryUrl();
    if (currentUser) showSession({user: currentUser});
  }
}
document.getElementById('closePasswordBtn').onclick = closePasswordDialog;
passwordDialog.addEventListener('cancel', e => { e.preventDefault(); closePasswordDialog(); });
initAuth();
