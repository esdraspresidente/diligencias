// =============================================
// SUBSTITUA PELO SEU PUBLIC KEY VAPID
const VAPID_PUBLIC_KEY = 'BGR2CcH_T5bkMTcNWHZg7D7eAAJ-G9AQf26_Z87pMeX1iUg9Ms6l-7S8-dxCXnBk9MiWBeZWcX8pZ1WY2mBmzqc';
// =============================================

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

async function registrarPush(userEmail, userId) {
  try {
    // Verifica suporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push não suportado neste navegador');
      return;
    }

    // Pede permissão
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      console.log('Permissão negada para notificações');
      return;
    }

    // Obtém o service worker registrado
    const registro = await navigator.serviceWorker.ready;

    // Cria a assinatura push
    const assinatura = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Salva a assinatura no Supabase
    const SUPABASE_URL = 'https://ggyngtqknonwnohbzkyj.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_WJOo1uEpdSXTPoPDlErTJw_vPSe5x1S';

    // Primeiro remove assinatura antiga deste usuário (se houver)
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('supa_sess'))?.access_token
      }
    });

    // Salva a nova
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem('supa_sess'))?.access_token
      },
      body: JSON.stringify({
        user_id: userId,
        email: userEmail,
        subscription: assinatura.toJSON()
      })
    });

    console.log('✅ Notificações push registradas com sucesso!');
  } catch (err) {
    console.error('Erro ao registrar push:', err);
  }
}
