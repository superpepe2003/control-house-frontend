import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Registrar locale es-AR para que DatePipe, CurrencyPipe, etc. funcionen en español argentina
registerLocaleData(localeEsAr);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
