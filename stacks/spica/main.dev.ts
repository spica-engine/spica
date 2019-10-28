/**
 * Used to launch the application under Bazel development mode.
 */
import {platformBrowser} from '@angular/platform-browser';
import {AppModule} from './src/app.module';

platformBrowser().bootstrapModule(AppModule);
