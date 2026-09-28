/** Mensajes de notificación (fallback al crear + claves i18n para la UI). */
const ACTION_MESSAGE_KEYS: Record<number, string> = {
  1: 'notifications.messages.goal',
  2: 'notifications.messages.assist',
  5: 'notifications.messages.shotOnTarget',
  10: 'notifications.messages.interception',
  11: 'notifications.messages.tackle',
  13: 'notifications.messages.ballRecovery',
  14: 'notifications.messages.save',
};

const ACTION_TITLES_ES: Record<number, string> = {
  1: '¡Gol!',
  2: '¡Asistencia!',
  5: 'Tiro al arco',
  10: 'Intercepción',
  11: 'Quite destacado',
  13: 'Recuperación del balón',
  14: '¡Atajada!',
};

const ACTION_BODIES_ES: Record<number, (playerName: string, minute: number) => string> = {
  1: (name, min) => `¡${name} marcó un gol en el minuto ${min}!`,
  2: (name, min) => `¡${name} dio una asistencia de gol en el minuto ${min}!`,
  5: (name, min) => `${name} tuvo un tiro al arco en el minuto ${min}.`,
  10: (name, min) => `${name} interceptó un pase en el minuto ${min}.`,
  11: (name, min) => `${name} recuperó el balón con un quite en el minuto ${min}.`,
  13: (name, min) => `${name} recuperó el balón en el minuto ${min}.`,
  14: (name, min) => `¡${name} hizo una atajada en el minuto ${min}!`,
};

export interface BuiltNotificationMessage {
  title: string;
  body: string;
  payload: {
    messageKey: string;
    params: Record<string, string | number>;
  };
}

export function buildGameActionNotificationMessage(
  playerFirstName: string,
  actionCode: number,
  actionName: string,
  minute: number,
): BuiltNotificationMessage {
  const playerName = playerFirstName.trim() || 'Tu hijo';
  const messageKey = ACTION_MESSAGE_KEYS[actionCode] ?? 'notifications.messages.highlight';
  const title = ACTION_TITLES_ES[actionCode] ?? '¡Momento destacado!';
  const bodyFn = ACTION_BODIES_ES[actionCode];
  const body = bodyFn
    ? bodyFn(playerName, minute)
    : `¡${playerName} tuvo un momento destacado: ${actionName} (min ${minute})!`;

  return {
    title,
    body,
    payload: {
      messageKey,
      params: { playerName, actionName, minute, actionCode },
    },
  };
}

export function buildVoidedNotificationSuffix(): { titleSuffix: string; bodySuffix: string } {
  return {
    titleSuffix: ' (corregido)',
    bodySuffix: ' Esta acción fue corregida por el entrenador.',
  };
}

const ACTION_TITLES_EN: Record<number, string> = {
  1: 'Goal!',
  2: 'Assist!',
  5: 'Shot on target',
  10: 'Interception',
  11: 'Great tackle',
  13: 'Ball recovery',
  14: 'Save!',
};

const ACTION_BODIES_EN: Record<number, (playerName: string, minute: number) => string> = {
  1: (name, min) => `${name} scored a goal in minute ${min}!`,
  2: (name, min) => `${name} provided an assist in minute ${min}!`,
  5: (name, min) => `${name} had a shot on target in minute ${min}.`,
  10: (name, min) => `${name} intercepted a pass in minute ${min}.`,
  11: (name, min) => `${name} won the ball back with a tackle in minute ${min}.`,
  13: (name, min) => `${name} recovered the ball in minute ${min}.`,
  14: (name, min) => `${name} made a save in minute ${min}!`,
};

/** Mismo mensaje que la notificación in-app, en el idioma del correo. */
export function buildGameActionEmailCopy(
  locale: 'es' | 'en',
  playerFirstName: string,
  actionCode: number,
  actionName: string,
  minute: number,
): { subject: string; body: string } {
  if (locale === 'es') {
    const message = buildGameActionNotificationMessage(playerFirstName, actionCode, actionName, minute);
    return { subject: message.title, body: message.body };
  }
  const playerName = playerFirstName.trim() || 'Your child';
  const bodyFn = ACTION_BODIES_EN[actionCode];
  return {
    subject: ACTION_TITLES_EN[actionCode] ?? 'Highlight!',
    body: bodyFn
      ? bodyFn(playerName, minute)
      : `${playerName} had a highlight: ${actionName} (min ${minute})!`,
  };
}
