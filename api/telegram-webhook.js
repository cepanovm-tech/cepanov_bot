const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

function clean(value) {
  return String(value ?? '').trim();
}

async function telegram(method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error(`Telegram ${method} error:`, result);
    return null;
  }

  return result.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

function extractClientId(text) {
  const match = String(text || '').match(/\[CLIENT_ID:(-?\d+)\]/);
  return match ? match[1] : null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        service: 'cepanovtech_bot',
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false });
    }

    if (!BOT_TOKEN || !OWNER_CHAT_ID) {
      console.error('Missing BOT_TOKEN or OWNER_CHAT_ID');

      return res.status(500).json({
        ok: false,
        error: 'Environment variables are missing',
      });
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

    // Заявка из формы сайта Cepanov Tech
    if (body?.source === 'cepanovtech-website') {
      const clientName = clean(body.name) || 'Не указано';
      const phone = clean(body.phone) || 'Не указан';
      const email = clean(body.email) || 'Не указана';
      const service = clean(body.service) || 'Не указана';
      const description = clean(body.description) || 'Без описания';

      const sent = await sendMessage(
        OWNER_CHAT_ID,
`📩 Новая заявка с сайта Cepanov Tech

Имя: ${clientName}
Телефон: ${phone}
Email: ${email}
Услуга: ${service}

Описание:
${description}`
      );

      return res.status(sent ? 200 : 502).json({
        ok: Boolean(sent),
      });
    }
    const message = body?.message;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const fromChatId = String(message.chat.id);
    const text = clean(message.text);

    const name =
      [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(' ') || 'Без имени';

    const username = message.from?.username
      ? `@${message.from.username}`
      : 'не указан';

    if (text === '/start') {
      await sendMessage(
        fromChatId,
`👋 Добро пожаловать в Cepanov Tech!

🚀 Мы помогаем бизнесу внедрять современные IT-решения:

💻 Разработка сайтов
📱 Веб-приложения
⚙️ Автоматизация бизнеса
🛠 IT-сопровождение
🎥 Видеонаблюдение
🌐 Локальные сети

✍️ Опишите вашу задачу одним сообщением.

Желательно указать:
• чем занимается ваша компания;
• что необходимо реализовать;
• есть ли сроки выполнения.

📩 Мы изучим обращение и ответим вам в этом чате.`
      );

      if (fromChatId !== String(OWNER_CHAT_ID)) {
        await sendMessage(
          OWNER_CHAT_ID,
`Новый пользователь

Имя: ${name}
Username: ${username}
Chat ID: ${fromChatId}

Чтобы ответить, нажмите «Ответить» на это сообщение.

[CLIENT_ID:${fromChatId}]`
        );
      }

      return res.status(200).json({ ok: true });
    }

    if (fromChatId === String(OWNER_CHAT_ID)) {
      const repliedText = message.reply_to_message?.text;
      const targetChatId = extractClientId(repliedText);

      if (targetChatId && text) {
        const sent = await sendMessage(targetChatId, text);

        await sendMessage(
          OWNER_CHAT_ID,
          sent
            ? 'Ответ отправлен клиенту.'
            : 'Не удалось отправить ответ клиенту.'
        );

        return res.status(200).json({ ok: true });
      }

      if (text.startsWith('/reply ')) {
        const [, fallbackChatId, ...replyParts] = text.split(' ');
        const replyText = replyParts.join(' ').trim();

        if (!fallbackChatId || !replyText) {
          await sendMessage(
            OWNER_CHAT_ID,
            'Формат:\n/reply CHAT_ID текст сообщения'
          );

          return res.status(200).json({ ok: true });
        }

        const sent = await sendMessage(fallbackChatId, replyText);

        await sendMessage(
          OWNER_CHAT_ID,
          sent
            ? 'Ответ отправлен клиенту.'
            : 'Не удалось отправить ответ клиенту.'
        );

        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    await sendMessage(
      OWNER_CHAT_ID,
`Сообщение от клиента

Имя: ${name}
Username: ${username}
Chat ID: ${fromChatId}

Сообщение:
${text || '[не текстовое сообщение]'}

Чтобы ответить, нажмите «Ответить» на это сообщение.

[CLIENT_ID:${fromChatId}]`
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);

    return res.status(200).json({
      ok: false,
      error: 'Webhook processing failed',
    });
  }
};

