// =============================================================
// AVISOS (push) DO APP — reescrito em 07/10/2026
//
// O que estava errado na versão anterior, e por que o push da Naiarha
// nunca chegou:
//   1. Tudo falhava CALADO (só console.error). A assinatura dela no banco
//      era de maio, o Google respondia 410 "expirada" e ninguém via.
//   2. A cada abertura do app ele cancelava a assinatura e criava outra,
//      e apagava TODAS as linhas do usuário no banco — o computador
//      derrubava o celular e vice-versa.
//
// Agora:
//   - reaproveita a assinatura do aparelho se ela ainda vale;
//   - grava no banco só se aquele endereço ainda não estiver lá, sem
//     apagar os outros aparelhos (assinatura morta é apagada pelo servidor
//     quando o Google responde 404/410);
//   - mostra na tela, em português, se os avisos estão ativos ou o que
//     impediu, e tem o botão "Testar aviso".
// =============================================================
const VAPID_PUBLIC_KEY = 'BLSVJl_y2B0PZAl62N-GbcRrNOtYEx2VBwdahwTjNLWc0MA167wEUwQV2D5u5MCKI6WMGecp1uUZ0oE2BWwnG8o';
const _PUSH_URL = 'https://ggyngtqknonwnohbzkyj.supabase.co';
const _PUSH_KEY = 'sb_publishable_WJOo1uEpdSXTPoPDlErTJw_vPSe5x1S';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)));
}

function _pushHeaders(extra) {
  const sess = JSON.parse(localStorage.getItem('supa_sess') || '{}');
  return { apikey: _PUSH_KEY, Authorization: 'Bearer ' + (sess.access_token || ''),
           'Content-Type': 'application/json', ...(extra || {}) };
}

// Mostra a situação na tela (#push-status). estado: ok | aviso | erro
function _pushStatus(estado, texto, comBotaoAtivar) {
  const el = document.getElementById('push-status');
  const btn = document.getElementById('btn-ativar-notif');
  if (btn) { btn.style.display = comBotaoAtivar ? '' : 'none'; btn.disabled = false; btn.textContent = 'Ativar avisos neste aparelho'; }
  if (!el) return;
  const cor = { ok: 'var(--green)', aviso: 'var(--yellow)', erro: 'var(--red)' }[estado] || 'var(--text2)';
  const fundo = { ok: 'var(--green-bg)', aviso: 'var(--yellow-bg)', erro: 'var(--red-bg)' }[estado] || 'var(--paper2)';
  el.style.display = 'flex';
  el.style.background = fundo; el.style.color = cor;
  el.innerHTML = `<span style="flex:1">${texto}</span>` +
    (estado === 'ok' ? '<button class="btn btn-secondary" id="btn-testar-push" style="padding:7px 12px;font-size:12px" onclick="testarAviso()">Testar aviso</button>' : '');
}

// Chamada depois do login.
function verificarPush(userId, userEmail) {
  window._pushUserId = userId;
  window._pushEmail = userEmail;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    _pushStatus('aviso', 'Este navegador não recebe avisos. No Android, abra o app pelo Chrome ou pelo ícone instalado na tela inicial.');
    return;
  }
  if (Notification.permission === 'denied') {
    _pushStatus('erro', 'Os avisos estão bloqueados neste aparelho. Para liberar: Configurações do celular → Apps → Chrome (ou Diligências) → Notificações → Permitir. Depois feche e abra o app.');
    return;
  }
  if (Notification.permission === 'granted') {
    _executarRegistroPush(userId, userEmail);   // renova sozinho, sem pedir nada
  } else {
    _pushStatus('aviso', 'Avisos ainda não ativados neste aparelho.', true);
  }
}

// Clique em "Ativar avisos neste aparelho".
async function ativarNotificacoes() {
  const btn = document.getElementById('btn-ativar-notif');
  if (btn) { btn.textContent = 'Ativando…'; btn.disabled = true; }
  await _executarRegistroPush(window._pushUserId, window._pushEmail);
}

async function _executarRegistroPush(userId, userEmail) {
  try {
    if (!userId) throw new Error('faça login de novo');
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        _pushStatus('erro', 'Permissão de aviso negada. Para liberar: Configurações do celular → Apps → Chrome (ou Diligências) → Notificações → Permitir.');
        return;
      }
    }
    const reg = await navigator.serviceWorker.register('/diligencias/sw.js', { scope: '/diligencias/' });
    await navigator.serviceWorker.ready;

    // Reaproveita a assinatura se ela foi feita com a NOSSA chave; se foi
    // feita com outra (chave antiga), troca — senão o Google recusa o envio.
    let sub = await reg.pushManager.getSubscription();
    const chave = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    if (sub && sub.options && sub.options.applicationServerKey) {
      const atual = new Uint8Array(sub.options.applicationServerKey);
      if (atual.length !== chave.length || atual.some((b, i) => b !== chave[i])) { await sub.unsubscribe(); sub = null; }
    }

    // Já está no banco? (RLS: cada um só enxerga as próprias linhas.)
    const r = await fetch(`${_PUSH_URL}/rest/v1/push_subscriptions?select=id,subscription&user_id=eq.${encodeURIComponent(userId)}`, { headers: _pushHeaders() });
    if (r.status === 401) throw new Error('sessão expirada — saia da conta e entre de novo');
    if (!r.ok) throw new Error('banco respondeu ' + r.status);
    const linhas = await r.json();
    const jaTem = !!sub && linhas.some(l => l.subscription && l.subscription.endpoint === sub.endpoint);
    if (!jaTem) {
      // Assinatura do aparelho que NÃO está no banco foi apagada pelo
      // servidor porque o Google disse que morreu (404/410). Regravar a
      // mesma daria o mesmo erro: troca por uma nova.
      if (sub) { try { await sub.unsubscribe(); } catch (e) {} }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
      const json = sub.toJSON();
      const ins = await fetch(`${_PUSH_URL}/rest/v1/push_subscriptions`, {
        method: 'POST', headers: _pushHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ user_id: userId, email: userEmail, subscription: json })
      });
      if (!ins.ok) throw new Error('não consegui gravar no banco (' + ins.status + ')');
    }
    _pushStatus('ok', 'Avisos ativos neste aparelho.');
    return true;
  } catch (err) {
    console.error('Erro ao registrar push:', err);
    _pushStatus('erro', 'Não consegui ativar os avisos: ' + (err && err.message ? err.message : err) + '.', true);
    return false;
  }
}

// "Testar aviso": o banco chama a function, que manda um push de verdade
// e devolve o que o Google respondeu. Resultado aparece na tela.
async function testarAviso() {
  const btn = document.getElementById('btn-testar-push');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  const fim = (estado, texto) => { _pushStatus(estado, texto); };
  try {
    const r = await fetch(`${_PUSH_URL}/rest/v1/rpc/tarefas_testar_push`, { method: 'POST', headers: _pushHeaders(), body: '{}' });
    const id = await r.json();
    if (!r.ok) throw new Error((id && id.message) || ('HTTP ' + r.status));
    for (let i = 0; i < 12; i++) {
      await new Promise(ok => setTimeout(ok, 2500));
      const q = await fetch(`${_PUSH_URL}/rest/v1/rpc/tarefas_resultado_teste`, { method: 'POST', headers: _pushHeaders(), body: JSON.stringify({ p_id: id }) });
      const d = await q.json();
      if (!q.ok) throw new Error((d && d.message) || ('HTTP ' + q.status));
      if (!d.pronto) continue;
      const res = d.resultado;
      if (res && res.ok > 0) return fim('ok', 'Aviso de teste enviado. Se não apareceu no celular em 1 minuto, veja se o modo "Não perturbe" ou a economia de bateria estão segurando as notificações do Chrome.');
      const cod = res && res.falhas && res.falhas.map(f => f.http).join(', ');
      const morta = res && (res.assinaturas === 0 || (res.falhas || []).some(f => f.http === 404 || f.http === 410));
      if (morta) {
        // O servidor já apagou a assinatura morta; o registro cria outra.
        if (await _executarRegistroPush(window._pushUserId, window._pushEmail))
          fim('aviso', 'A assinatura deste aparelho tinha expirado e foi renovada agora. Toque em "Testar aviso" de novo daqui a 1 minuto.');
        return;
      }
      return fim('erro', 'O serviço de avisos recusou o envio (' + (cod || d.http || d.erro) + ').');
    }
    fim('aviso', 'O teste não respondeu a tempo. Tente de novo em 1 minuto.');
  } catch (e) {
    fim('erro', 'Teste falhou: ' + e.message);
  }
}
