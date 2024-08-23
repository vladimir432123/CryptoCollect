declare global {
  interface Window {
    Telegram: any;
  }
}

export {}; // Это важно для превращения файла в модуль и предотвращения ошибок TypeScript
