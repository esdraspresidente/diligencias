// =============================================
// CHAVE VAPID PÚBLICA
const VAPID_PUBLIC_KEY = 'BGR2CcH_T5bkMTcNWHZg7D7eAAJ-G9AQf26_Z87pMeX1iUg9Ms6l-7S8-dxCXnBk9MiWBeZWcX8pZ1WY2mBmzqc';
// =============================================

const _PUSH_URL = 'https://ggyngtqknonwnohbzkyj.supabase.co';
const _PUSH_KEY = 'sb_publishable_WJOo1uEpdSXTPoPDlErTJw_vPSe5x1S';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ── Chamada após login ──────────────────────────────────────
// Guarda os dados do usuário e decide se mostra o botão
function verificarPush(userId, userEmail) {
  window._pushUserId  = userId;
  window._pushEmail   = userEmail;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  if (Notification.permission === 'granted') {
    // Já autorizou antes — registra silenciosamente em background
    _executarRegistroPush(userId, userEmail);
  } else {
    // Mostra o botão para o usuário tocar
    const btn = document.getElementById('btn-ativar-notif');
    if (btn) btn.style.display = 'flex';
  }
}

// ── Chamada pelo clique do botão ────────────────────────────
// IMPORTANTE: Chrome só aceita Notification.requestPermission()
// quando vem de um toque/clique direto do usuário
async function ativarNotificacoes() {
  const btn = document.getElementById('btn-ativar-notif');
  if (btn) { btn.textContent = '⏳ Ativando...'; btn.disabled = true; }

  await _executarRegistroPush(window._pushUserId, window._pushEmail);
}

// ── Lógica principal (não chamar diretamente) ───────────────
async function _executarRegistroPush(userId, userEmail) {
  const btn = document.getElementById('btn-ativar-notif');
  try {
    if (!userId) throw new Error('userId indefinido');

    // Pede permissão (só funciona aqui pois veio de clique do usuário,
    // ou porque já era 'granted')
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (btn) {
          btn.textContent = '🔕 Notificações bloqueadas';
          btn.disabled = false;
        }
        return;
      }
    }

    // Registra o Service Worker com o path correto para GitHub Pages
    const swReg = await navigator.serviceWorker.register('/diligencias/sw.js', {
      scope: '/diligencias/'
    });
    await navigator.serviceWorker.ready;

    // Pega assinatura existente ou cria uma nova
    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Monta o header de autenticação
    const sess = JSON.parse(localStorage.getItem('supa_sess') || '{}');
    const authHeader = sess?.access_token ? 'Bearer ' + sess.access_token : 'Bearer ';

    // Remove registro antigo deste usuário (evita duplicatas)
    await fetch(`${_PUSH_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'apikey': _PUSH_KEY, 'Authorization': authHeader }
    });

    // Salva a nova assinatura no Supabase
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

    // Sucesso — esconde o botão
    if (btn) btn.style.display = 'none';
    console.log('✅ Notificações push registradas com sucesso!');

  } catch (err) {
    console.error('Erro ao registrar push:', err);
    if (btn) { btn.textContent = '🔔 Ativar Notificações'; btn.disabled = false; }
  }
}
