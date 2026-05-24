import webpush from "npm:web-push@3.6.7";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================
// SUBSTITUA PELOS SEUS VALORES:
const VAPID_PUBLIC_KEY  = 'BGR2CcH_T5bkMTcNWHZg7D7eAAJ-G9AQf26_Z87pMeX1iUg9Ms61-7S8-dxCXnBk9MiWBeZWcX8pZ1WY2mBmzqc';
const VAPID_PRIVATE_KEY = 's6o5AVXotALnSgdMYYaRyTFeGk-IM5CAXp0eJKygZfg';
const VAPID_EMAIL       = 'mailto:esdraspresidente@gmail.com';
// =============================================

const SUPABASE_URL = 'https://ggyngtqknonwnohbzkyj.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function db(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  return r.json();
}

async function enviarPush(subscription: object, title: string, body: string) {
  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify({ title, body })
    );
    console.log('Push enviado:', title);
  } catch (e) {
    console.error('Erro ao enviar push:', e);
  }
}

Deno.serve(async (req) => {
  // Responde ao preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Verifica se é uma notificação imediata (nova diligência)
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch(_) { /* sem body */ }

    if (body?.tipo === 'nova_diligencia' && body?.subscription && body?.title && body?.body) {
      await enviarPush(body.subscription as object, body.title as string, body.body as string);
      return new Response(JSON.stringify({ ok: true, tipo: 'imediata' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Notificações agendadas diárias
    const hoje = new Date().toISOString().split('T')[0];

    const assinaturas = await db('push_subscriptions?select=*');
    const diligenciasHoje = await db(`demandas?data=eq.${hoje}&select=descricao,local,responsavel`);
    const pagamentosHoje = await db(`demandas?previsao_pagamento=eq.${hoje}&status=neq.pago&select=descricao,valor,responsavel`);

    const mapaAssinaturas: Record<string, object> = {};
    for (const a of assinaturas) {
      if (a.email) mapaAssinaturas[a.email] = a.subscription;
    }

    for (const d of diligenciasHoje) {
      const sub = Object.entries(mapaAssinaturas).find(
        ([email]) => email.toLowerCase().includes((d.responsavel||'').toLowerCase().split(' ')[0])
      );
      if (sub) await enviarPush(sub[1], '📋 Diligência hoje!', `${d.descricao} — ${d.local}`);
    }

    for (const p of pagamentosHoje) {
      const valor = parseFloat(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const sub = Object.entries(mapaAssinaturas).find(
        ([email]) => email.toLowerCase().includes((p.responsavel||'').toLowerCase().split(' ')[0])
      );
      if (sub) await enviarPush(sub[1], '💰 Pagamento previsto hoje!', `${valor} — ${p.descricao}`);
    }

    return new Response(JSON.stringify({ ok: true, hoje }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Erro na função:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
