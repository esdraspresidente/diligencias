// =============================================
// CHAVE VAPID PÚBLICA
const VAPID_PUBLIC_KEY = 'BLSVJl_y2B0PZAl62N-GbcRrNOtYEx2VBwdahwTjNLWc0MA167wEUwQV2D5u5MCKI6WMGecp1uUZ0oE2BWwnG8o';
// =============================================

const _PUSH_URL = 'https://ggyngtqknonwnohbzkyj.supabase.co';
const _PUSH_KEY = 'sb_publishable_WJOo1uEpdSXTPoPDlErTJw_vPSe5x1S';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// Chamada após login
function verificarPush(userId, userEmail) {
  window._pushUserId = userId;
  window._pushEmail  = userEmail;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  if (Notification.permission === 'granted') {
    _executarRegistroPush(userId, userEmail);
  } else {
    const btn = document.getElementById('btn-ativar-notif');
    if (btn) btn.style.display = 'flex';
  }
}

// Chamada pelo clique do botão
async function ativarNotificacoes() {
  const btn = document.getElementById('btn-ativar-notif');
  if (btn) { btn.textContent = '⏳ Ativando...'; btn.disabled = true; }
  await _executarRegistroPush(window._pushUserId, window._pushEmail);
}

async function _executarRegistroPush(userId, userEmail) {
  const btn = document.getElementById('btn-ativar-notif');
  try {
    if (!userId) throw new Error('userId indefinido');

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (btn) { btn.textContent = '🔕 Notificações bloqueadas'; btn.disabled = false; }
        return;
      }
    }

    const swReg = await navigator.serviceWorker.register('/diligencias/sw.js', {
      scope: '/diligencias/'
    });
    await navigator.serviceWorker.ready;

    // Cancela assinatura antiga para garantir chaves novas
    const velha = await swReg.pushManager.getSubscription();
    if (velha) await velha.unsubscribe();

    // Cria assinatura nova com as chaves VAPID corretas
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const sess = JSON.parse(localStorage.getItem('supa_sess') || '{}');
    const authHeader = sess?.access_token ? 'Bearer ' + sess.access_token : 'Bearer ';

    // Remove registro antigo deste usuário
    await fetch(`${_PUSH_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'apikey': _PUSH_KEY, 'Authorization': authHeader }
    });

    // Salva nova assinatura
    const resp = await fetch(`${_PUSH_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': _PUSH_KEY,
        'Authorization': authHeader,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id:      userId,
        email:        userEmail,
        subscription: subscription.toJSON()
      })
    });

    if (!resp.ok) throw new Error('Supabase status ' + resp.status);

    if (btn) btn.style.display = 'none';
    console.log('✅ Push registrado com chaves novas!');

  } catch (err) {
    console.error('Erro ao registrar push:', err);
    if (btn) { btn.textContent = '🔔 Ativar Notificações'; btn.disabled = false; }
  }
}
