const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

function clean(value) {
  return String(value || '').trim();
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

  return response.ok;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  const message = req.body?.message;

  if (!message || !BOT_TOKEN || !OWNER_CHAT_ID) {
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
      'Здравствуйте! Напишите ваш вопрос или опишите задачу. Я отвечу вам здесь от лица Cepanov Tech.'
    );

    if (fromChatId !== String(OWNER_CHAT_ID)) {
      await sendMessage(
        OWNER_CHAT_ID,
        `Новый пользователь\n\nИмя: ${name}\nUsername: ${username}\nChat ID: ${fromChatId}\n\nДля ответа:\n/reply ${fromChatId} текст ответа`
      );
    }

    return res.status(200).json({ ok: true });
  }

  if (
    fromChatId === String(OWNER_CHAT_ID) &&
    text.startsWith('/reply ')
  ) {
    const parts = text.split(' ');
    const targetChatId = parts[1];
    const replyText = parts.slice(2).join(' ').trim();

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
        : 'Не удалось отправить ответ.'
    );

    return res.status(200).json({ ok: true });
  }

  if (fromChatId !== String(OWNER_CHAT_ID)) {
    await sendMessage(
      OWNER_CHAT_ID,
      `Сообщение от клиента\n\nИмя: ${name}\nUsername: ${username}\nChat ID: ${fromChatId}\n\nСообщение:\n${text || '[не текстовое сообщение]'}\n\nОтветить:\n/reply ${fromChatId} ваш текст`
    );
  }

  return res.status(200).json({ ok: true });
};