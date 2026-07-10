const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

function clean(value) {
  return String(value ?? '').trim();
}

async function sendMessage(chatId, text) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error('Telegram sendMessage error:', result);
    return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  try {
    console.log('Webhook method:', req.method);
    console.log('Webhook body:', JSON.stringify(req.body));

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

    const message =
      typeof req.body === 'string'
        ? JSON.parse(req.body).message
        : req.body?.message;

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
        '👋 Добро пожаловать в Cepanov Tech!

💻 Разработка сайтов
📱 Веб-приложения
⚙️ Автоматизация бизнеса
🎥 Видеонаблюдение
🌐 Локальные сети
🛠 IT-сопровождение

Опишите вашу задачу одним сообщением.
Мы ответим вам в этом чате в ближайшее время.'
      );

      if (fromChatId !== String(OWNER_CHAT_ID)) {
        await sendMessage(
          OWNER_CHAT_ID,
          `Новый пользователь

Имя: ${name}
Username: ${username}
Chat ID: ${fromChatId}

Для ответа:
/reply ${fromChatId} текст ответа`
        );
      }

      return res.status(200).json({ ok: true });
    }

    if (
      fromChatId === String(OWNER_CHAT_ID) &&
      text.startsWith('/reply ')
    ) {
      const [, targetChatId, ...replyParts] = text.split(' ');
      const replyText = replyParts.join(' ').trim();

      if (!targetChatId || !replyText) {
        await sendMessage(
          OWNER_CHAT_ID,
          'Правильный формат:\n/reply CHAT_ID текст сообщения'
        );

        return res.status(200).json({ ok: true });
      }

      const sent = await sendMessage(targetChatId, replyText);

      await sendMessage(
        OWNER_CHAT_ID,
        sent
          ? 'Ответ отправлен клиенту.'
          : 'Не удалось отправить ответ клиенту.'
      );

      return res.status(200).json({ ok: true });
    }

    if (fromChatId !== String(OWNER_CHAT_ID)) {
      await sendMessage(
        OWNER_CHAT_ID,
        `Сообщение от клиента

Имя: ${name}
Username: ${username}
Chat ID: ${fromChatId}

Сообщение:
${text || '[не текстовое сообщение]'}

Ответить:
/reply ${fromChatId} ваш текст`
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error:', error);

    return res.status(200).json({
      ok: false,
      error: 'Webhook processing failed',
    });
  }
};
