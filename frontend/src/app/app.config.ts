import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // IMPORTANTE
import { routes } from './app.routes';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // [INTEGRAÇÃO - ITEM 1] Configuração já existente, mantida: no Angular standalone,
    // provideHttpClient() habilita HTTP no lugar de HttpClientModule em app.module.ts.
    provideHttpClient(),
    provideCharts(withDefaultRegisterables())
  ]
};
